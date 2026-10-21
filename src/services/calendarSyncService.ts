/**
 * services/calendarSyncService.ts
 *
 * Frontend wrapper around the Convex Google Calendar actions.
 * Replaces the old Supabase Edge Function invocations.
 */

import { convex } from "../lib/convex"
import { api } from "../../convex/_generated/api"
import { ConvexError } from "convex/values"
import { GOOGLE_RECONNECT } from "../../convex/_shared/google"

export interface CalendarListItem {
  id: string
  summary: string
  primary: boolean
}

export interface CalendarConnectionStatus {
  connected: boolean
  selectedCalendarId?: string
  selectedCalendarSummary?: string
  /** The grant covers Google Tasks. False on connections made before it was asked for. */
  tasksEnabled?: boolean
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

/**
 * The CSRF check on its own, so the callback page can reject a forged
 * callback at once — before, and regardless of, sign-in being restored.
 * Throws on a mismatch; does not consume the stored state.
 */
export function checkOAuthState(returnedState?: string): void {
  const expected = (() => {
    try {
      return sessionStorage.getItem(OAUTH_STATE_KEY)
    } catch {
      return null
    }
  })()
  if (expected && expected !== returnedState) {
    throw new Error("OAuth state mismatch — possible CSRF. Please try connecting again.")
  }
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

/** True when Google has revoked or expired access and only reconnecting helps. */
export function isReconnectError(e: unknown): boolean {
  return (
    e instanceof ConvexError &&
    (e.data as { code?: string } | undefined)?.code === GOOGLE_RECONNECT
  )
}

/** A readable message for any calendar action failure. */
export function calendarErrorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const data = e.data as { message?: string } | string
    return typeof data === "string" ? data : data?.message ?? e.message
  }
  return (e as Error).message
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

// ─── Tasks ↔ Google Tasks ──────────────────────────────────────────────────────

export interface SyncTaskInput {
  id: string
  title: string
  isDone: boolean
  parentId?: string
}

/** A change made in Google that the planner should apply. */
export interface RemoteTaskChange {
  taskId: string
  title?: string
  isDone?: boolean
}

/**
 * Mirror one day's tasks into Google Tasks and bring back what changed there.
 * Never deletes anything; see `removeTaskFromGoogle`.
 */
export async function syncDayTasksWithGoogle(
  taskDate: string,
  tasks: SyncTaskInput[],
): Promise<{ pulls: RemoteTaskChange[]; inserted: number; pushed: number }> {
  return await convex.action(api.tasks.syncDayTasks, { taskDate, tasks })
}

export async function removeTaskFromGoogle(params: { taskId: string; taskDate: string }): Promise<void> {
  await convex.action(api.tasks.removeTask, params)
}

export async function logWorkBlockToCalendar(params: {
  sessionId: string
  title: string
  startedAt: string
  finishedAt: string
}): Promise<void> {
  await convex.action(api.calendar.logWorkBlock, { ...params, timezone: timezone() })
}
