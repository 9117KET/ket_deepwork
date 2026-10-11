declare const process: { env: Record<string, string | undefined> }

import { action, mutation, query, type ActionCtx } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  GOOGLE_AUTH_BASE,
  GOOGLE_TOKEN_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_CALENDAR_BASE,
  GOOGLE_SCOPES,
  buildRedirectUri,
  getGoogleAccessToken,
} from "./_shared/google"
import { encryptToEnvelope, decryptFromEnvelope } from "./_shared/crypto"
import { getUserId } from "./_shared/auth"
import { toLocalIsoDay, hhmmFromDate, zonedWallTimeToUtc } from "./_shared/calendarTime"
import { findFreeSlot, sessionEventId } from "./_shared/freeSlot"

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

// ─── Shared: a connected user's access token + calendar ────────────────────────

/**
 * Everything an action needs to talk to Google for the signed-in user. The
 * calendar defaults to `primary`: a fresh connection works before anyone has
 * picked a calendar, which is the whole point of "connect and forget".
 */
async function connectedCalendar(ctx: ActionCtx): Promise<{
  userId: string
  conn: Doc<"googleCalendarConnections">
  accessToken: string
  calendarId: string
}> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  const userId = getUserId(identity.subject)

  const conn: Doc<"googleCalendarConnections"> | null = await ctx.runQuery(internal.calendarInternal.getConnection, { userId })
  if (!conn) throw new Error("Google Calendar not connected")

  const refreshToken = await decryptFromEnvelope(conn.encryptedRefreshToken)
  const { accessToken } = await getGoogleAccessToken({
    refreshToken,
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  })
  return {
    userId,
    conn,
    accessToken,
    calendarId: conn.selectedCalendarId ?? "primary",
  }
}

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

/** The planner's working window. A task is never auto-placed outside it. */
const DAY_START = "08:00:00"
const DAY_END = "22:00:00"
const REMINDER_MINUTES = 10

// ─── Today's events (read-only timeline) ───────────────────────────────────────

/**
 * The day as the calendar sees it. Read-only and writes nothing: the calendar
 * stays the source of truth for time, and the planner only shows it beside
 * the task list. (The old import copied every event into the planner as a
 * task, which duplicated the schedule and rewrote planner rows on each sync.)
 */
export const listEvents = action({
  args: { date: v.string(), timezone: v.string() },
  handler: async (ctx, args) => {
    const { accessToken, calendarId } = await connectedCalendar(ctx)

    const url = new URL(eventsUrl(calendarId))
    url.searchParams.set("singleEvents", "true")
    url.searchParams.set("orderBy", "startTime")
    url.searchParams.set("maxResults", "100")
    url.searchParams.set("timeMin", zonedWallTimeToUtc(args.date, "00:00:00", args.timezone).toISOString())
    url.searchParams.set("timeMax", zonedWallTimeToUtc(args.date, "23:59:59", args.timezone).toISOString())

    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!resp.ok) throw new Error(`Failed to fetch events (${resp.status})`)
    const data = (await resp.json()) as {
      items?: Array<{
        id: string
        status?: string
        summary?: string
        htmlLink?: string
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
        extendedProperties?: { private?: { deepblockTaskId?: string } }
      }>
    }

    return (data.items ?? [])
      .filter((ev) => ev.status !== "cancelled")
      .map((ev) => ({
        id: ev.id,
        title: ev.summary ?? "(No title)",
        allDay: !ev.start?.dateTime,
        start: ev.start?.dateTime ?? null,
        end: ev.end?.dateTime ?? null,
        htmlLink: ev.htmlLink ?? null,
        taskId: ev.extendedProperties?.private?.deepblockTaskId ?? null,
      }))
  },
})

// ─── Schedule a task into the calendar ─────────────────────────────────────────

/**
 * Put a task on the calendar as a real event with a reminder, so the calendar
 * does the reminding — its notifications reach every device, which a web app
 * cannot promise.
 *
 * With `startTime` the task goes exactly there; without it, into the first gap
 * that fits between now (or the start of the working day) and its end, read
 * from Google's free/busy across the chosen calendar and `primary`. A task
 * that is already scheduled is moved, never duplicated.
 */
export const scheduleTask = action({
  args: {
    taskId: v.string(),
    taskDate: v.string(),
    title: v.string(),
    durationMinutes: v.number(),
    timezone: v.string(),
    startTime: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ eventId: string; htmlLink: string | null; date: string; startTime: string }> => {
    const { userId, accessToken, calendarId } = await connectedCalendar(ctx)
    const durationMs = Math.round(Math.max(5, Math.min(args.durationMinutes, 12 * 60)) * 60_000)

    let startMs: number
    if (args.startTime) {
      if (!/^\d{2}:\d{2}$/.test(args.startTime)) throw new Error("startTime must be HH:MM")
      startMs = zonedWallTimeToUtc(args.taskDate, `${args.startTime}:00`, args.timezone).getTime()
    } else {
      const dayStart = zonedWallTimeToUtc(args.taskDate, DAY_START, args.timezone).getTime()
      const dayEnd = zonedWallTimeToUtc(args.taskDate, DAY_END, args.timezone).getTime()
      const from = Math.max(dayStart, Date.now())
      if (from >= dayEnd) throw new Error("No time left in this day to schedule it")

      const items = [...new Set([calendarId, "primary"])].map((id) => ({ id }))
      const fb = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          timeMin: new Date(from).toISOString(),
          timeMax: new Date(dayEnd).toISOString(),
          timeZone: args.timezone,
          items,
        }),
      })
      if (!fb.ok) throw new Error(`Failed to read free/busy (${fb.status})`)
      const fbData = (await fb.json()) as {
        calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
      }
      const busy = Object.values(fbData.calendars ?? {}).flatMap((c) =>
        (c.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
      )
      const slot = findFreeSlot({ busy, from, to: dayEnd, durationMs })
      if (slot === null) {
        throw new Error(`No free ${Math.round(durationMs / 60_000)}-minute slot left in this day`)
      }
      startMs = slot
    }

    const start = new Date(startMs)
    const end = new Date(startMs + durationMs)
    const eventBody = {
      summary: args.title,
      start: { dateTime: start.toISOString(), timeZone: args.timezone },
      end: { dateTime: end.toISOString(), timeZone: args.timezone },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: REMINDER_MINUTES }] },
      extendedProperties: { private: { deepblockTaskId: args.taskId } },
    }
    const headers = { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }

    const link: Doc<"calendarEventLinks"> | null = await ctx.runQuery(internal.calendarInternal.getTaskEventLink, {
      userId,
      taskDate: args.taskDate,
      taskId: args.taskId,
    })

    let event: { id: string; etag?: string; htmlLink?: string } | null = null
    if (link && link.googleCalendarId === calendarId) {
      const resp = await fetch(eventsUrl(calendarId, link.googleEventId), {
        method: "PATCH",
        headers,
        body: JSON.stringify(eventBody),
      })
      // Deleted in Google since: fall through and create a fresh one.
      if (resp.ok) event = await resp.json()
      else if (resp.status !== 404 && resp.status !== 410) {
        throw new Error(`Failed to move the event (${resp.status})`)
      }
    }
    if (!event) {
      const resp = await fetch(eventsUrl(calendarId), {
        method: "POST",
        headers,
        body: JSON.stringify(eventBody),
      })
      if (!resp.ok) throw new Error(`Failed to create the event (${resp.status})`)
      event = await resp.json()
    }

    await ctx.runMutation(internal.calendarInternal.upsertEventLink, {
      userId,
      taskId: args.taskId,
      taskDate: args.taskDate,
      googleCalendarId: calendarId,
      googleEventId: event!.id,
      etag: event!.etag,
    })

    return {
      eventId: event!.id,
      htmlLink: event!.htmlLink ?? null,
      date: toLocalIsoDay(start, args.timezone),
      startTime: hhmmFromDate(start, args.timezone),
    }
  },
})

/** Take a scheduled task off the calendar. Already gone in Google is fine. */
export const unscheduleTask = action({
  args: { taskId: v.string(), taskDate: v.string() },
  handler: async (ctx, args) => {
    const { userId, accessToken } = await connectedCalendar(ctx)
    const link: Doc<"calendarEventLinks"> | null = await ctx.runQuery(internal.calendarInternal.getTaskEventLink, {
      userId,
      taskDate: args.taskDate,
      taskId: args.taskId,
    })
    if (!link) return { removed: false }

    const resp = await fetch(eventsUrl(link.googleCalendarId, link.googleEventId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
      throw new Error(`Failed to remove the event (${resp.status})`)
    }
    await ctx.runMutation(internal.calendarInternal.deleteEventLink, {
      userId,
      googleCalendarId: link.googleCalendarId,
      googleEventId: link.googleEventId,
    })
    return { removed: true }
  },
})

// ─── Worked time → "Deepblock log" calendar ────────────────────────────────────

const LOG_CALENDAR_NAME = "Deepblock log"

/**
 * Record a finished focus block as an event on its own calendar.
 *
 * The calendar shows what was planned; this puts what was actually done next
 * to it, where an assistant reading the calendar can see both. A separate
 * calendar keeps the log out of the way (hide it in one click) and out of
 * free/busy, so logged work never blocks scheduling.
 *
 * Idempotent: the event id is derived from the session id, so a retry, a
 * second device or a re-run of the client's catch-up gets a 409, not a copy.
 */
export const logWorkBlock = action({
  args: {
    sessionId: v.string(),
    title: v.string(),
    startedAt: v.string(),
    finishedAt: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, conn, accessToken } = await connectedCalendar(ctx)
    const start = Date.parse(args.startedAt)
    const end = Date.parse(args.finishedAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error("A logged block needs a start before its finish")
    }
    if (end - start > 12 * 3_600_000) throw new Error("A logged block cannot exceed 12 hours")

    const headers = { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" }

    const createLogCalendar = async (): Promise<string> => {
      const resp = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          summary: LOG_CALENDAR_NAME,
          description: "Focus blocks recorded by Deepblock — what was actually worked, not what was planned.",
          timeZone: args.timezone,
        }),
      })
      if (!resp.ok) throw new Error(`Failed to create the log calendar (${resp.status})`)
      const created = (await resp.json()) as { id: string }
      await ctx.runMutation(internal.calendarInternal.setLogCalendar, { userId, logCalendarId: created.id })
      return created.id
    }

    const insert = (calendarId: string) =>
      fetch(eventsUrl(calendarId), {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: sessionEventId(args.sessionId),
          summary: `✓ ${Math.round((end - start) / 60_000)}m · ${args.title}`,
          start: { dateTime: new Date(start).toISOString(), timeZone: args.timezone },
          end: { dateTime: new Date(end).toISOString(), timeZone: args.timezone },
          transparency: "transparent",
          reminders: { useDefault: false, overrides: [] },
        }),
      })

    let calendarId = conn.logCalendarId ?? (await createLogCalendar())
    let resp = await insert(calendarId)
    // The user deleted the log calendar: make a new one and try once more.
    if (resp.status === 404) {
      calendarId = await createLogCalendar()
      resp = await insert(calendarId)
    }
    if (resp.status === 409) return { logged: true, alreadyLogged: true }
    if (!resp.ok) throw new Error(`Failed to log the block (${resp.status})`)
    return { logged: true, alreadyLogged: false }
  },
})

// ─── Disconnect ────────────────────────────────────────────────────────────────

export const disconnectGoogle = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)

    // Best-effort revoke at Google before deleting our copy: without it the
    // refresh token stays valid indefinitely even though the user asked to
    // disconnect. Failures (already revoked, network) never block disconnect.
    const conn = await ctx.runQuery(internal.calendarInternal.getConnection, { userId })
    if (conn) {
      try {
        const refreshToken = await decryptFromEnvelope(conn.encryptedRefreshToken)
        await fetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
        })
      } catch {
        // Revoke is hygiene, not a precondition — always finish disconnecting.
      }
    }

    await ctx.runMutation(internal.calendarInternal.deleteConnection, { userId })
  },
})
