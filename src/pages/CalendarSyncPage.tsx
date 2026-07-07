/**
 * pages/CalendarSyncPage.tsx
 *
 * Google Calendar two-way sync.
 *  - Connect / disconnect a Google account (OAuth via Convex actions)
 *  - Pick which calendar to sync against
 *  - Import events Google → planner, and push scheduled tasks planner → Google
 *
 * The whole sync engine lives in `convex/calendar.ts`; this page only drives it
 * through `src/services/calendarSyncService.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppChrome } from "../components/layout/AppChrome";
import { useAuth } from "../contexts/AuthContext";
import { todayIso, addDays } from "../domain/dateUtils";
import {
  type CalendarListItem,
  startGoogleOAuth,
  listGoogleCalendars,
  selectGoogleCalendar,
  syncFromGoogle,
  syncToGoogle,
  disconnectGoogle,
} from "../services/calendarSyncService";

type Banner = { kind: "ok" | "error" | "info"; text: string } | null;

export function CalendarSyncPage() {
  const { user, loading } = useAuth();
  const isAuthenticated = Boolean(user);

  const status = useQuery(
    api.calendar.connectionStatus,
    isAuthenticated ? {} : "skip",
  );

  const [calendars, setCalendars] = useState<CalendarListItem[] | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [busy, setBusy] = useState<null | "connect" | "pull" | "push" | "disconnect" | "select">(null);
  const [banner, setBanner] = useState<Banner>(null);

  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(() => addDays(todayIso(), 14));

  const connected = status?.connected === true;
  const selectedCalendarId = status?.connected ? status.selectedCalendarId : undefined;
  const selectedCalendarSummary = status?.connected ? status.selectedCalendarSummary : undefined;

  const loadCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    setBanner(null);
    try {
      setCalendars(await listGoogleCalendars());
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setLoadingCalendars(false);
    }
  }, []);

  // Once connected, load the calendar list so the user can pick / change.
  useEffect(() => {
    if (connected && calendars === null && !loadingCalendars) {
      void loadCalendars();
    }
  }, [connected, calendars, loadingCalendars, loadCalendars]);

  const handleConnect = async () => {
    setBusy("connect");
    setBanner(null);
    try {
      const { url } = await startGoogleOAuth();
      window.location.href = url;
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
      setBusy(null);
    }
  };

  const handleSelect = async (calendarId: string) => {
    const cal = calendars?.find((c) => c.id === calendarId);
    setBusy("select");
    setBanner(null);
    try {
      await selectGoogleCalendar({ calendarId, calendarSummary: cal?.summary });
      setBanner({ kind: "ok", text: `Now syncing with "${cal?.summary ?? calendarId}".` });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    setBusy("pull");
    setBanner(null);
    try {
      const { imported } = await syncFromGoogle({ startDate, endDate });
      setBanner({
        kind: "ok",
        text:
          imported > 0
            ? `Imported ${imported} event${imported === 1 ? "" : "s"} into your planner.`
            : "Already up to date — no new events to import.",
      });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handlePush = async () => {
    setBusy("push");
    setBanner(null);
    try {
      const { created, updated, skipped } = await syncToGoogle({ startDate, endDate });
      const parts = [`${created} created`, `${updated} updated`];
      if (skipped > 0) parts.push(`${skipped} skipped`);
      setBanner({ kind: "ok", text: `Pushed scheduled tasks to Google: ${parts.join(", ")}.` });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Google Calendar? Synced tasks stay in your planner, but the link to Google events is removed.")) {
      return;
    }
    setBusy("disconnect");
    setBanner(null);
    try {
      await disconnectGoogle();
      setCalendars(null);
      setBanner({ kind: "info", text: "Google Calendar disconnected." });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppChrome mobileActive="planner" showCalendarLink={isAuthenticated}>
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 pb-28 md:pb-10">
        <header className="mb-6">
          <h1 className="font-shareHeadline text-2xl font-black text-share-onSurface">
            Google Calendar sync
          </h1>
          <p className="mt-1 text-sm text-share-onSurfaceVariant">
            Two-way sync between your planner and a Google calendar. Imported events
            land in <span className="font-semibold">High priority</span>; scheduled
            tasks (with a time and duration) are pushed back to Google.
          </p>
        </header>

        {banner && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              banner.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : banner.kind === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-share-outlineVariant/50 bg-share-surfaceContainerHigh text-share-onSurfaceVariant"
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* ── Not authenticated ─────────────────────────────────────────── */}
        {loading ? (
          <p className="text-sm text-share-onSurfaceVariant">Loading…</p>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
            <p className="text-sm text-share-onSurface">
              Sign in to connect Google Calendar — sync needs an account so your
              events and tasks stay together across devices.
            </p>
            <a
              href="/planner"
              className="mt-4 inline-block rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer"
            >
              Go to sign in
            </a>
          </div>
        ) : status === undefined ? (
          <p className="text-sm text-share-onSurfaceVariant">Checking connection…</p>
        ) : !connected ? (
          /* ── Connect ─────────────────────────────────────────────────── */
          <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
            <h2 className="text-base font-bold text-share-onSurface">Not connected</h2>
            <p className="mt-1 text-sm text-share-onSurfaceVariant">
              Connect your Google account to start syncing. You'll be asked to grant
              calendar access, then choose which calendar to use.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy === "connect"}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
            >
              {busy === "connect" ? "Redirecting…" : "Connect Google Calendar"}
            </button>
          </div>
        ) : (
          /* ── Connected ───────────────────────────────────────────────── */
          <div className="space-y-5">
            {/* Connection card */}
            <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <h2 className="text-base font-bold text-share-onSurface">Connected</h2>
                  </div>
                  <p className="mt-1 text-sm text-share-onSurfaceVariant">
                    {selectedCalendarId
                      ? <>Syncing with <span className="font-semibold text-share-onSurface">{selectedCalendarSummary ?? selectedCalendarId}</span>.</>
                      : "Choose a calendar below to start syncing."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={busy === "disconnect"}
                  className="shrink-0 rounded-lg border border-share-outlineVariant/50 px-3 py-1.5 text-xs font-bold text-share-onSurfaceVariant hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
                >
                  {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>

            {/* Calendar picker */}
            <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-bold text-share-onSurface">Calendar</h2>
                <button
                  type="button"
                  onClick={loadCalendars}
                  disabled={loadingCalendars}
                  className="text-xs font-bold text-share-primary hover:text-share-primaryContainer disabled:opacity-60"
                >
                  {loadingCalendars ? "Loading…" : "Refresh list"}
                </button>
              </div>
              {loadingCalendars && calendars === null ? (
                <p className="mt-3 text-sm text-share-onSurfaceVariant">Loading calendars…</p>
              ) : calendars && calendars.length > 0 ? (
                <select
                  value={selectedCalendarId ?? ""}
                  onChange={(e) => handleSelect(e.target.value)}
                  disabled={busy === "select"}
                  className="mt-3 w-full rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onSurface focus:border-share-primary focus:outline-none disabled:opacity-60"
                >
                  <option value="" disabled>
                    Select a calendar…
                  </option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? " (primary)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-3 text-sm text-share-onSurfaceVariant">
                  No calendars found. Try refreshing.
                </p>
              )}
            </div>

            {/* Sync controls */}
            <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
              <h2 className="text-base font-bold text-share-onSurface">Sync</h2>
              <p className="mt-1 text-sm text-share-onSurfaceVariant">
                Choose a date range, then import or push within it.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="flex flex-col text-xs font-bold text-share-onSurfaceVariant">
                  From
                  <input
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerLow px-3 py-2 text-sm font-normal text-share-onSurface focus:border-share-primary focus:outline-none"
                  />
                </label>
                <label className="flex flex-col text-xs font-bold text-share-onSurfaceVariant">
                  To
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerLow px-3 py-2 text-sm font-normal text-share-onSurface focus:border-share-primary focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={!selectedCalendarId || busy !== null}
                  className="rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
                >
                  {busy === "pull" ? "Importing…" : "Import from Google"}
                </button>
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={!selectedCalendarId || busy !== null}
                  className="rounded-lg border border-share-outlineVariant/50 px-4 py-2 text-sm font-bold text-share-onSurface hover:border-share-primary/50 disabled:opacity-60"
                >
                  {busy === "push" ? "Pushing…" : "Push to Google"}
                </button>
              </div>
              {!selectedCalendarId && (
                <p className="mt-3 text-xs text-amber-300">
                  Select a calendar above to enable syncing.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppChrome>
  );
}
