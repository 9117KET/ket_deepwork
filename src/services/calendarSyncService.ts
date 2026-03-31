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

async function requireOk<T>(result: { data: T | null; error: unknown }): Promise<T> {
  if (result.error) {
    const err = result.error as { message?: string; context?: unknown };
    let message = (err as Error).message ?? "Unknown error";
    // context is the raw Response from FunctionsHttpError — use duck typing
    const ctx = err.context;
    if (ctx != null && typeof (ctx as Response).json === "function") {
      try {
        const body = (await (ctx as Response).json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore JSON parse failures — keep the original message
      }
    }
    throw new Error(message);
  }
  if (!result.data) throw new Error("No data returned");
  return result.data;
}

export async function startGoogleOAuth(): Promise<{ url: string; state: string }> {
  const origin = window.location.origin;
  const res = await supabase.functions.invoke("google-oauth-start", {
    body: { origin },
  });
  return (await requireOk(res)) as { url: string; state: string };
}

export async function completeGoogleOAuth(code: string): Promise<void> {
  const origin = window.location.origin;
  const res = await supabase.functions.invoke("google-oauth-callback", {
    body: { code, origin },
  });
  await requireOk(res);
}

export async function listGoogleCalendars(): Promise<CalendarListItem[]> {
  const res = await supabase.functions.invoke("google-calendars-list", { body: {} });
  const data = (await requireOk(res)) as { calendars: CalendarListItem[] };
  return data.calendars ?? [];
}

export async function selectGoogleCalendar(params: {
  calendarId: string;
  calendarSummary?: string;
}): Promise<void> {
  const res = await supabase.functions.invoke("google-calendar-select", {
    body: params,
  });
  await requireOk(res);
}

export async function syncFromGoogle(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ imported: number }> {
  const res = await supabase.functions.invoke("google-sync-pull", {
    body: { ...params, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });
  return (await requireOk(res)) as { imported: number };
}

export async function syncToGoogle(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ created: number; updated: number; skipped: number }> {
  const res = await supabase.functions.invoke("google-sync-push", {
    body: { ...params, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });
  return (await requireOk(res)) as { created: number; updated: number; skipped: number };
}

export async function disconnectGoogle(): Promise<void> {
  const res = await supabase.functions.invoke("google-disconnect", { body: {} });
  await requireOk(res);
}

