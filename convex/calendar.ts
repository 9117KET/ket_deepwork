declare const process: { env: Record<string, string | undefined> }

import { action, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import {
  GOOGLE_AUTH_BASE,
  GOOGLE_TOKEN_URL,
  GOOGLE_CALENDAR_BASE,
  GOOGLE_SCOPES,
  buildRedirectUri,
  getGoogleAccessToken,
} from "./_shared/google"
import { encryptToEnvelope, decryptFromEnvelope } from "./_shared/crypto"
import { getUserId } from "./_shared/auth"
import { toLocalIsoDay, hhmmFromDate, zonedWallTimeToUtc } from "./_shared/calendarTime"

// ─── Connection status (client-readable, no secrets) ───────────────────────────

export const connectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { connected: false as const }
    const userId = getUserId(identity.subject)
    const conn = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!conn) return { connected: false as const }
    return {
      connected: true as const,
      selectedCalendarId: conn.selectedCalendarId,
      selectedCalendarSummary: conn.selectedCalendarSummary,
    }
  },
})

// ─── OAuth ────────────────────────────────────────────────────────────────────

export const googleOauthStart = action({
  args: { origin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID")

    const redirectUri = buildRedirectUri(args.origin)
    const state = crypto.randomUUID()
    const url = new URL(GOOGLE_AUTH_BASE)
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", GOOGLE_SCOPES.join(" "))
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
    url.searchParams.set("include_granted_scopes", "true")
    url.searchParams.set("state", state)

    return { url: url.toString(), state }
  },
})

export const googleOauthCallback = action({
  args: { code: v.string(), origin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET")

    const redirectUri = buildRedirectUri(args.origin)
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: args.code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    })

    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
    if (!resp.ok) throw new Error(`Token exchange failed (${resp.status})`)
    const data = (await resp.json()) as { refresh_token?: string }
    if (!data.refresh_token) {
      throw new Error("No refresh token returned. Try disconnecting and reconnecting with consent.")
    }

    const encrypted = await encryptToEnvelope(data.refresh_token)
    await ctx.runMutation(internal.calendarInternal.storeOAuthConnection, {
      userId,
      encryptedRefreshToken: encrypted,
    })
  },
})

// ─── Calendar list ────────────────────────────────────────────────────────────

export const listCalendars = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const conn = await ctx.runQuery(internal.calendarInternal.getConnection, { userId })
    if (!conn) throw new Error("Google Calendar not connected")

    const clientId = process.env.GOOGLE_CLIENT_ID ?? ""
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""
    const refreshToken = await decryptFromEnvelope(conn.encryptedRefreshToken)
    const { accessToken } = await getGoogleAccessToken({ refreshToken, clientId, clientSecret })

    const resp = await fetch(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) throw new Error(`Failed to list calendars (${resp.status})`)
    const data = (await resp.json()) as {
      items?: Array<{ id: string; summary: string; primary?: boolean }>
    }

    return (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: Boolean(c.primary),
    }))
  },
})

// ─── Select calendar ──────────────────────────────────────────────────────────

export const selectCalendar = mutation({
  args: { calendarId: v.string(), calendarSummary: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)
    const conn = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!conn) throw new Error("Google Calendar not connected")
    await ctx.db.patch(conn._id, {
      selectedCalendarId: args.calendarId,
      selectedCalendarSummary: args.calendarSummary,
    })
  },
})

// ─── Sync pull (Google → planner) ─────────────────────────────────────────────

export const syncFromGoogle = action({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const conn = await ctx.runQuery(internal.calendarInternal.getConnection, { userId })
    if (!conn?.selectedCalendarId) throw new Error("No calendar selected")

    const clientId = process.env.GOOGLE_CLIENT_ID ?? ""
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""
    const refreshToken = await decryptFromEnvelope(conn.encryptedRefreshToken)
    const { accessToken } = await getGoogleAccessToken({ refreshToken, clientId, clientSecret })

    const userTimezone = args.timezone || "UTC"
    const now = new Date()
    // Build the fetch window from the user's LOCAL day boundaries, not the
    // server's UTC clock, so a "Jun 14–28" import covers Jun 14 00:00 → Jun 28
    // 23:59 in the user's zone (was off by the UTC offset → wrong-day imports).
    const start = args.startDate
      ? zonedWallTimeToUtc(args.startDate, "00:00:00", userTimezone)
      : new Date(now)
    const end = args.endDate
      ? zonedWallTimeToUtc(args.endDate, "23:59:59", userTimezone)
      : new Date(now.getTime() + 14 * 864e5)

    const url = new URL(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selectedCalendarId)}/events`,
    )
    url.searchParams.set("singleEvents", "true")
    url.searchParams.set("orderBy", "startTime")
    url.searchParams.set("timeMin", start.toISOString())
    url.searchParams.set("timeMax", end.toISOString())

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) throw new Error(`Failed to fetch events (${resp.status})`)
    const data = (await resp.json()) as {
      items?: Array<{
        id: string
        summary?: string
        etag?: string
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
      }>
    }

    const items = data.items ?? []
    let imported = 0

    for (const ev of items) {
      const startDt = ev.start?.dateTime
      const endDt = ev.end?.dateTime
      if (!startDt || !endDt) continue // skip all-day events

      const startDateObj = new Date(startDt)
      const endDateObj = new Date(endDt)
      const isoDay = toLocalIsoDay(startDateObj, userTimezone)
      const scheduledAt = hhmmFromDate(startDateObj, userTimezone)
      const durationMinutes = Math.max(
        1,
        Math.round((endDateObj.getTime() - startDateObj.getTime()) / 60000),
      )

      const link = await ctx.runQuery(internal.calendarInternal.getEventLink, {
        userId,
        googleCalendarId: conn.selectedCalendarId,
        googleEventId: ev.id,
      })

      let updatedExisting = false
      if (link?.taskId && link.taskDate !== isoDay) {
        // The event moved to a different day in Google. Take the task out of
        // the day the link points at and carry it (same id, done-state etc.)
        // to the event's new day; looking up only the new day would miss the
        // task entirely and silently leave it on the old day forever.
        const oldDays = await ctx.runQuery(internal.calendarInternal.getPlannerDaysInRange, {
          userId,
          startDate: link.taskDate,
          endDate: link.taskDate,
        })
        const oldDay = oldDays[0]
        const oldTasks = (oldDay?.tasks as Array<Record<string, unknown>>) ?? []
        const moved = oldTasks.find((t) => t.id === link.taskId)
        if (moved) {
          await ctx.runMutation(internal.calendarInternal.upsertPlannerDay, {
            userId,
            date: link.taskDate,
            tasks: oldTasks.filter((t) => t.id !== link.taskId),
          })
          const newDays = await ctx.runQuery(internal.calendarInternal.getPlannerDaysInRange, {
            userId,
            startDate: isoDay,
            endDate: isoDay,
          })
          const newDay = newDays[0]
          const newTasks = (newDay?.tasks as Array<Record<string, unknown>>) ?? []
          await ctx.runMutation(internal.calendarInternal.upsertPlannerDay, {
            userId,
            date: isoDay,
            tasks: [
              ...newTasks,
              { ...moved, title: ev.summary ?? moved.title, date: isoDay, scheduledAt, durationMinutes },
            ],
            deepWorkSessions: newDay?.deepWorkSessions ?? [],
            habitCompletions: newDay?.habitCompletions,
            sleepHours: newDay?.sleepHours,
            mood: newDay?.mood,
          })
          await ctx.runMutation(internal.calendarInternal.upsertEventLink, {
            userId,
            taskId: link.taskId,
            taskDate: isoDay,
            googleCalendarId: conn.selectedCalendarId,
            googleEventId: ev.id,
            etag: ev.etag,
          })
          updatedExisting = true
        } else {
          // The linked task vanished from its day: drop the link and re-import.
          await ctx.runMutation(internal.calendarInternal.deleteEventLink, {
            userId,
            googleCalendarId: conn.selectedCalendarId,
            googleEventId: ev.id,
          })
        }
      } else if (link?.taskId) {
        // Update existing linked task - we need to modify the day's tasks array
        const days = await ctx.runQuery(internal.calendarInternal.getPlannerDaysInRange, {
          userId,
          startDate: isoDay,
          endDate: isoDay,
        })
        const day = days[0]
        const tasks = (day?.tasks as Array<Record<string, unknown>>) ?? []
        if (tasks.some((t) => t.id === link.taskId)) {
          const next = tasks.map((t) =>
            t.id === link.taskId
              ? { ...t, title: ev.summary ?? t.title, scheduledAt, durationMinutes }
              : t,
          )
          await ctx.runMutation(internal.calendarInternal.upsertPlannerDay, {
            userId,
            date: isoDay,
            tasks: next,
          })
          updatedExisting = true
        } else {
          // The linked task no longer exists (deleted or overwritten by a
          // client sync). Drop the stale link so the event re-imports below
          // instead of being silently unreachable forever.
          await ctx.runMutation(internal.calendarInternal.deleteEventLink, {
            userId,
            googleCalendarId: conn.selectedCalendarId,
            googleEventId: ev.id,
          })
        }
      }
      if (!updatedExisting) {
        const taskId = crypto.randomUUID()
        const days = await ctx.runQuery(internal.calendarInternal.getPlannerDaysInRange, {
          userId,
          startDate: isoDay,
          endDate: isoDay,
        })
        const day = days[0]
        const existingTasks = (day?.tasks as Array<Record<string, unknown>>) ?? []
        const newTask = {
          id: taskId,
          title: ev.summary ?? "(Calendar event)",
          sectionId: "highPriority",
          date: isoDay,
          isDone: false,
          scheduledAt,
          durationMinutes,
        }
        await ctx.runMutation(internal.calendarInternal.upsertPlannerDay, {
          userId,
          date: isoDay,
          tasks: [...existingTasks, newTask],
          deepWorkSessions: day?.deepWorkSessions ?? [],
          habitCompletions: day?.habitCompletions,
          sleepHours: day?.sleepHours,
          mood: day?.mood,
        })
        await ctx.runMutation(internal.calendarInternal.upsertEventLink, {
          userId,
          taskId,
          taskDate: isoDay,
          googleCalendarId: conn.selectedCalendarId,
          googleEventId: ev.id,
          etag: ev.etag,
        })
        imported += 1
      }
    }

    return { ok: true, imported }
  },
})

// ─── Sync push (planner → Google) ─────────────────────────────────────────────

function localEndDateTime(isoDay: string, hhmm: string, durationMins: number): string {
  const [hh, mm] = hhmm.split(":").map(Number)
  const endTotal = (hh ?? 0) * 60 + (mm ?? 0) + durationMins
  const endH = Math.floor(endTotal / 60) % 24
  const endM = endTotal % 60
  const overflowDays = Math.floor(endTotal / (24 * 60))
  if (overflowDays > 0) {
    const d = new Date(`${isoDay}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + overflowDays)
    const newDay = d.toISOString().slice(0, 10)
    return `${newDay}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`
  }
  return `${isoDay}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`
}

export const syncToGoogle = action({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const conn = await ctx.runQuery(internal.calendarInternal.getConnection, { userId })
    if (!conn?.selectedCalendarId) throw new Error("No calendar selected")

    const clientId = process.env.GOOGLE_CLIENT_ID ?? ""
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""
    const refreshToken = await decryptFromEnvelope(conn.encryptedRefreshToken)
    const { accessToken } = await getGoogleAccessToken({ refreshToken, clientId, clientSecret })

    const userTimezone = args.timezone ?? "UTC"
    const now = new Date()
    const startDate = args.startDate ?? now.toISOString().slice(0, 10)
    const endDate = args.endDate ?? new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10)

    const dayRows = await ctx.runQuery(internal.calendarInternal.getPlannerDaysInRange, {
      userId,
      startDate,
      endDate,
    })

    let created = 0
    let updated = 0
    let skipped = 0

    for (const row of dayRows) {
      const isoDay = row.date
      const tasks = (row.tasks as Array<Record<string, unknown>>) ?? []
      const schedulable = tasks.filter(
        (t) => !t.parentId && t.scheduledAt && t.durationMinutes && (t.durationMinutes as number) > 0,
      )

      for (const t of schedulable) {
        const scheduledAt = t.scheduledAt as string
        const durationMinutes = t.durationMinutes as number
        const taskId = t.id as string

        const startDateTime = `${isoDay}T${scheduledAt}:00`
        const endDateTime = localEndDateTime(isoDay, scheduledAt, durationMinutes)

        const link = await ctx.runQuery(internal.calendarInternal.getTaskEventLink, {
          userId,
          taskDate: isoDay,
          taskId,
        })

        const eventBody = {
          summary: t.title,
          start: { dateTime: startDateTime, timeZone: userTimezone },
          end: { dateTime: endDateTime, timeZone: userTimezone },
        }

        if (!link?.googleEventId) {
          const resp = await fetch(
            `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selectedCalendarId)}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(eventBody),
            },
          )
          if (!resp.ok) { skipped += 1; continue }
          const createdEv = (await resp.json()) as { id: string; etag?: string }
          await ctx.runMutation(internal.calendarInternal.upsertEventLink, {
            userId,
            taskId,
            taskDate: isoDay,
            googleCalendarId: conn.selectedCalendarId,
            googleEventId: createdEv.id,
            etag: createdEv.etag,
          })
          created += 1
        } else {
          const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selectedCalendarId)}/events/${encodeURIComponent(link.googleEventId)}`
          const putEvent = (etag?: string) =>
            fetch(url, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "content-type": "application/json",
                ...(etag ? { "If-Match": etag } : {}),
              },
              body: JSON.stringify(eventBody),
            })
          let resp = await putEvent(link.etag ? String(link.etag) : undefined)
          if (resp.status === 412) {
            // Stale etag: the event changed in Google since we stored it.
            // Push is planner-wins, so refresh the etag and retry once —
            // skipping while keeping the stale etag would make every future
            // push of this task 412 as well, deadlocking it permanently.
            const current = await fetch(url, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (current.ok) {
              const currentEv = (await current.json()) as { etag?: string }
              resp = await putEvent(currentEv.etag)
            }
          }
          if (!resp.ok) { skipped += 1; continue }
          const updatedEv = (await resp.json()) as { etag?: string }
          await ctx.runMutation(internal.calendarInternal.updateEventLinkEtag, {
            userId,
            googleCalendarId: conn.selectedCalendarId,
            googleEventId: link.googleEventId,
            etag: updatedEv.etag,
          })
          updated += 1
        }
      }
    }

    return { ok: true, created, updated, skipped }
  },
})

// ─── Disconnect ────────────────────────────────────────────────────────────────

export const disconnectGoogle = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    const links = await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_task", (q) => q.eq("userId", userId))
      .collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    const conn = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (conn) await ctx.db.delete(conn._id)
  },
})
