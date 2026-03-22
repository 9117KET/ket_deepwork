/**
 * services/calendarSyncService.ts
 *
 * Frontend wrapper around Supabase Edge Functions for Google Calendar sync.
 * Keeps UI code clean and centralizes request/response shapes.
 */

import { supabase } from "../lib/supabase";

export interface CalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
}

function requireOk<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (!result.data) throw new Error("No data returned");
  return result.data;
}

export async function startGoogleOAuth(): Promise<{ url: string; state: string }> {
  const origin = window.location.origin;
  const res = await supabase.functions.invoke("google-oauth-start", {
    body: { origin },
  });
  return requireOk(res) as { url: string; state: string };
}

export async function completeGoogleOAuth(code: string): Promise<void> {
  const origin = window.location.origin;
  const res = await supabase.functions.invoke("google-oauth-callback", {
    body: { code, origin },
  });
  requireOk(res);
}

export async function listGoogleCalendars(): Promise<CalendarListItem[]> {
  const res = await supabase.functions.invoke("google-calendars-list", { body: {} });
  const data = requireOk(res) as { calendars: CalendarListItem[] };
  return data.calendars ?? [];
}

export async function selectGoogleCalendar(params: {
  calendarId: string;
  calendarSummary?: string;
}): Promise<void> {
  const res = await supabase.functions.invoke("google-calendar-select", {
    body: params,
  });
  requireOk(res);
}

export async function syncFromGoogle(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ imported: number }> {
  const res = await supabase.functions.invoke("google-sync-pull", {
    body: params ?? {},
  });
  return requireOk(res) as { imported: number };
}

export async function syncToGoogle(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ created: number; updated: number; skipped: number }> {
  const res = await supabase.functions.invoke("google-sync-push", {
    body: params ?? {},
  });
  return requireOk(res) as { created: number; updated: number; skipped: number };
}

