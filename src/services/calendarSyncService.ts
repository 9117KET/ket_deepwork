/**
 * services/calendarSyncService.ts
 *
 * Frontend wrapper around the Convex Google Calendar actions.
 * Replaces the old Supabase Edge Function invocations.
 */

import { convex } from "../lib/convex"
import { api } from "../../convex/_generated/api"

export interface CalendarListItem {
  id: string
  summary: string
  primary: boolean
}

export interface CalendarConnectionStatus {
  connected: boolean
  selectedCalendarId?: string
  selectedCalendarSummary?: string
}

const OAUTH_STATE_KEY = "deepblock_gcal_oauth_state"

export async function getConnectionStatus(): Promise<CalendarConnectionStatus> {
  return await convex.query(api.calendar.connectionStatus, {})
}

/**
 * Kicks off the Google OAuth flow: fetches the consent URL, stashes the CSRF
 * `state` in sessionStorage so the callback can verify it, then returns the URL
 * for the caller to redirect to.
 */
export async function startGoogleOAuth(): Promise<{ url: string; state: string }> {
  const origin = window.location.origin
  const result = await convex.action(api.calendar.googleOauthStart, { origin })
  try {
    sessionStorage.setItem(OAUTH_STATE_KEY, result.state)
  } catch {
    // sessionStorage unavailable (private mode) — proceed without CSRF check.
  }
  return result
}

export async function completeGoogleOAuth(code: string, returnedState?: string): Promise<void> {
  const expected = (() => {
    try {
      return sessionStorage.getItem(OAUTH_STATE_KEY)
    } catch {
      return null
    }
  })()
  // If we issued a state for this connect, the callback must echo it exactly.
  // A missing returned state is treated as a mismatch — accepting it would let
  // a forged callback (login-CSRF) skip the check simply by omitting `state`.
  // Only when sessionStorage itself is unavailable (expected === null) do we
  // proceed unverified.
  if (expected && expected !== returnedState) {
    throw new Error("OAuth state mismatch — possible CSRF. Please try connecting again.")
  }
  try {
    sessionStorage.removeItem(OAUTH_STATE_KEY)
  } catch {
    // ignore
  }
  const origin = window.location.origin
  await convex.action(api.calendar.googleOauthCallback, { code, origin })
}

export async function listGoogleCalendars(): Promise<CalendarListItem[]> {
  return await convex.action(api.calendar.listCalendars, {})
}

export async function selectGoogleCalendar(params: {
  calendarId: string
  calendarSummary?: string
}): Promise<void> {
  await convex.mutation(api.calendar.selectCalendar, {
    calendarId: params.calendarId,
    calendarSummary: params.calendarSummary,
  })
}

export async function disconnectGoogle(): Promise<void> {
  // Action (not mutation): the backend also revokes the token at Google.
  await convex.action(api.calendar.disconnectGoogle, {})
}

/** The device's IANA zone; every calendar call is phrased in local days. */
function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export interface CalendarEvent {
  id: string
  title: string
  allDay: boolean
  /** ISO instants; null for all-day events. */
  start: string | null
  end: string | null
  htmlLink: string | null
  /** Set when the event was created by Schedule for a planner task. */
  taskId: string | null
}

export async function listCalendarEvents(date: string): Promise<CalendarEvent[]> {
  return await convex.action(api.calendar.listEvents, { date, timezone: timezone() })
}

export interface ScheduledSlot {
  eventId: string
  htmlLink: string | null
  date: string
  /** "HH:MM", local. */
  startTime: string
}

/** Put a task on the calendar: the next free slot, or exactly `startTime`. */
export async function scheduleTaskInCalendar(params: {
  taskId: string
  taskDate: string
  title: string
  durationMinutes: number
  startTime?: string
}): Promise<ScheduledSlot> {
  return await convex.action(api.calendar.scheduleTask, { ...params, timezone: timezone() })
}

export async function unscheduleTaskFromCalendar(params: {
  taskId: string
  taskDate: string
}): Promise<void> {
  await convex.action(api.calendar.unscheduleTask, params)
}

export async function logWorkBlockToCalendar(params: {
  sessionId: string
  title: string
  startedAt: string
  finishedAt: string
}): Promise<void> {
  await convex.action(api.calendar.logWorkBlock, { ...params, timezone: timezone() })
}
