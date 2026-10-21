/**
 * pages/CalendarSyncPage.tsx
 *
 * Google Calendar connection.
 *  - Connect / disconnect a Google account (OAuth via Convex actions)
 *  - Pick which calendar Today reads and Schedule writes into (default: primary)
 *
 * There is nothing to "sync" by hand: Today reads the calendar live, Schedule
 * writes an event, and finished focus blocks go to a "Deepblock log" calendar.
 * The integration lives in `convex/calendar.ts`, driven through
 * `src/services/calendarSyncService.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppChrome } from "../components/layout/AppChrome";
import { useAuth } from "../contexts/AuthContext";
import {
  type CalendarListItem,
  startGoogleOAuth,
  listGoogleCalendars,
  selectGoogleCalendar,
  disconnectGoogle,
  isReconnectError,
  calendarErrorMessage,
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
  const [busy, setBusy] = useState<null | "connect" | "disconnect" | "select">(null);
  const [banner, setBanner] = useState<Banner>(null);


  const connected = status?.connected === true;
  // False on a connection made before Google Tasks was asked for.
  const tasksEnabled = status?.connected === true && status.tasksEnabled === true;
  const selectedCalendarId = status?.connected ? status.selectedCalendarId : undefined;
  const selectedCalendarSummary = status?.connected ? status.selectedCalendarSummary : undefined;

  const [needsReconnect, setNeedsReconnect] = useState(false);
  // One automatic load per connection. Keying it on `calendars === null` alone
  // retried a failing load in a tight loop, since a failure leaves it null.
  const [autoLoaded, setAutoLoaded] = useState(false);

  const loadCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    setBanner(null);
    try {
      setCalendars(await listGoogleCalendars());
      setNeedsReconnect(false);
    } catch (e) {
      setNeedsReconnect(isReconnectError(e));
      setBanner({ kind: "error", text: calendarErrorMessage(e) });
    } finally {
      setLoadingCalendars(false);
    }
  }, []);

  // Once connected, load the calendar list so the user can pick / change.
  useEffect(() => {
    if (connected && !autoLoaded) {
      setAutoLoaded(true);
      void loadCalendars();
    }
    if (!connected && autoLoaded) setAutoLoaded(false);
  }, [connected, autoLoaded, loadCalendars]);

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
      setBanner({ kind: "ok", text: `Now using "${cal?.summary ?? calendarId}".` });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Google Calendar? Your tasks and logged work stay in the planner, and events already in Google stay there.")) {
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
    <AppChrome showCalendarLink={isAuthenticated}>
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 pb-28 md:pb-10">
        <header className="mb-6">
          <h1 className="font-shareHeadline text-2xl font-black text-share-onSurface">
            Google Calendar
          </h1>
          <p className="mt-1 text-sm text-share-onSurfaceVariant">
            Your calendar is the schedule. Today shows its events beside your tasks,
            every task you add appears there as a Google Task with a checkbox,{" "}
            <span className="font-semibold">Schedule</span> puts a task into the next free
            slot with a reminder, and finished focus blocks are logged to a separate{" "}
            <span className="font-semibold">Deepblock log</span> calendar.
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
              Sign in to connect Google Calendar — it needs an account so your
              events and tasks stay together across devices.
            </p>
            <a
              href="/"
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
              Connect once and it stays connected. You will be asked to grant
              calendar and tasks access; your primary calendar is used unless you pick another.
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
                    <span className={`inline-block h-2 w-2 rounded-full ${needsReconnect ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <h2 className="text-base font-bold text-share-onSurface">
                      {needsReconnect ? "Access expired" : "Connected"}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-share-onSurfaceVariant">
                    {selectedCalendarId
                      ? <>Using <span className="font-semibold text-share-onSurface">{selectedCalendarSummary ?? selectedCalendarId}</span>.</>
                      : "Using your primary calendar."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Reconnecting replaces only the stored token; the chosen
                      calendar and task ↔ event links survive it. */}
                  {(needsReconnect || !tasksEnabled) && (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={busy === "connect"}
                      className="rounded-lg bg-share-primary px-3 py-1.5 text-xs font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
                    >
                      {busy === "connect" ? "Redirecting…" : "Reconnect"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={busy === "disconnect"}
                    className="rounded-lg border border-share-outlineVariant/50 px-3 py-1.5 text-xs font-bold text-share-onSurfaceVariant hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
                  >
                    {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
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

            {/* Tasks ↔ Google Tasks */}
            <div className="rounded-2xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-6">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${tasksEnabled ? "bg-emerald-400" : "bg-amber-400"}`} />
                <h2 className="text-base font-bold text-share-onSurface">Tasks</h2>
              </div>
              {tasksEnabled ? (
                <p className="mt-2 text-sm text-share-onSurfaceVariant">
                  Each task you add goes to a <span className="font-semibold text-share-onSurface">Deepblock</span> list
                  in Google Tasks, due on its day, so it shows on your calendar with a checkbox. Tick or rename it
                  in either place and the other follows. Deleting a task here removes it from Google; deleting it
                  in Google leaves it here and just stops the mirroring.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-share-onSurfaceVariant">
                    This connection was made before task sync existed. Reconnect once to add Google Tasks
                    access — your calendar choice and scheduled events are kept.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={busy === "connect"}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
                  >
                    {busy === "connect" ? "Redirecting…" : "Reconnect for tasks"}
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </AppChrome>
  );
}
