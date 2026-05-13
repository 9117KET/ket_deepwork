/**
 * services/calendarSyncService.ts
 *
 * Frontend wrapper around Convex actions for Google Calendar sync.
 * Replaces the old Supabase Edge Function invocations.
 */

import { convex } from "../lib/convex"
import { api } from "../../convex/_generated/api"

export interface CalendarListItem {
  id: string
  summary: string
  primary: boolean
}

export async function startGoogleOAuth(): Promise<{ url: string; state: string }> {
  const origin = window.location.origin
  return await convex.action(api.calendar.googleOauthStart, { origin })
}

export async function completeGoogleOAuth(code: string): Promise<void> {
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

export async function syncFromGoogle(params?: {
  startDate?: string
  endDate?: string
}): Promise<{ imported: number }> {
  const result = await convex.action(api.calendar.syncFromGoogle, {
    ...params,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  return { imported: (result as { imported: number }).imported }
}

export async function syncToGoogle(params?: {
  startDate?: string
  endDate?: string
}): Promise<{ created: number; updated: number; skipped: number }> {
  return await convex.action(api.calendar.syncToGoogle, {
    ...params,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }) as { created: number; updated: number; skipped: number }
}

export async function disconnectGoogle(): Promise<void> {
  await convex.mutation(api.calendar.disconnectGoogle, {})
}
