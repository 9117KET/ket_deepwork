/**
 * pages/CalendarSyncPage.tsx
 *
 * Google Calendar connect / choose / sync — Stitch-style step shell + existing behavior.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppChrome } from "../components/layout/AppChrome";
import {
  appCardClass,
  appInputClass,
  appPrimaryButtonClass,
  appSecondaryButtonClass,
} from "../components/layout/appClasses";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import {
  listGoogleCalendars,
  selectGoogleCalendar,
  syncFromGoogle,
  syncToGoogle,
  startGoogleOAuth,
  disconnectGoogle,
  type CalendarListItem,
} from "../services/calendarSyncService";

function StepPill({
  step,
  label,
  state,
}: {
  step: number;
  label: string;
  state: "done" | "current" | "upcoming";
}) {
  const circle =
    state === "done"
      ? "bg-share-primary text-share-onPrimary"
      : state === "current"
        ? "border border-share-outlineVariant/30 bg-share-surfaceContainerHighest text-share-onSurface ring-2 ring-share-primary/30"
        : "border border-share-outlineVariant/30 bg-share-surfaceContainerHighest text-share-onSurface opacity-50";
  return (
    <div
      className={`flex items-center gap-3 ${state === "upcoming" ? "opacity-40" : ""}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circle}`}
      >
        {state === "done" ? <MaterialIcon name="check" className="text-base" /> : step}
      </span>
      <span className="text-sm font-bold text-share-onSurface">{label}</span>
    </div>
  );
}

export function CalendarSyncPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [savedCalendarName, setSavedCalendarName] = useState<string>("");
  const [savingSelection, setSavingSelection] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{ ts: string; fn: string; detail: string; ok: boolean }[]>([]);
  const debugEndRef = useRef<HTMLDivElement>(null);

  const addLog = (fn: string, detail: string, ok: boolean) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDebugLogs((prev) => [...prev, { ts, fn, detail, ok }]);
  };

  useEffect(() => {
    if (debugOpen) debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLogs, debugOpen]);

  const isAuthed = Boolean(user);

  const primary = useMemo(
    () => calendars.find((c) => c.primary) ?? null,
    [calendars],
  );

  const connected = calendars.length > 0;
  const calendarSaved = savedCalendarName !== "";

  // Clear transient messages on mount
  useEffect(() => {
    setSyncMessage("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    addLog("auth", `Signed in as ${user?.email ?? user?.id?.slice(0, 8) ?? "unknown"}`, true);
    addLog("calendars-list", "Fetching connected calendars…", true);
    (async () => {
      try {
        const items = await listGoogleCalendars();
        setCalendars(items);
        if (items.length > 0) {
          const nextDefault = items.find((c) => c.primary)?.id ?? items[0]!.id;
          setSelectedId((prev) => prev || nextDefault);
          addLog("calendars-list", `Found ${items.length} calendar(s). Primary: ${items.find((c) => c.primary)?.summary ?? "none"}`, true);
        } else {
          addLog("calendars-list", "No calendars found — not connected yet.", true);
        }
      } catch (e) {
        addLog("calendars-list", `ERROR: ${(e as Error).message}`, false);
        setCalendars([]);
      }
    })();
  }, [isAuthed, user]);

  const handleConnect = async () => {
    setError(null);
    setSyncMessage("");
    setLoading(true);
    addLog("oauth-start", "Requesting Google consent URL…", true);
    try {
      const { url } = await startGoogleOAuth();
      addLog("oauth-start", `Got URL, redirecting to Google…`, true);
      window.location.assign(url);
    } catch (e) {
      const msg = (e as Error).message ?? "Failed to start OAuth.";
      addLog("oauth-start", `ERROR: ${msg}`, false);
      setError(msg);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Calendar? All event links will be removed.")) return;
    setError(null);
    setSyncMessage("");
    setDisconnecting(true);
    addLog("disconnect", "Removing Google Calendar connection…", true);
    try {
      await disconnectGoogle();
      setCalendars([]);
      setSelectedId("");
      setSavedCalendarName("");
      setSyncMessage("Google Calendar disconnected.");
      addLog("disconnect", "Disconnected — event links removed.", true);
    } catch (e) {
      const msg = (e as Error).message ?? "Failed to disconnect.";
      addLog("disconnect", `ERROR: ${msg}`, false);
      setError(msg);
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isAuthed) {
    return (
      <AppChrome headerPositionClass="top-0" mobileActive="planner" maxWidthClass="max-w-xl">
        <h1 className="font-shareHeadline text-2xl font-black text-share-onSurface">Calendar sync</h1>
        <p className="mt-2 text-share-onSurfaceVariant">Sign in to connect your Google Calendar.</p>
        <div className="mt-6">
          <Link to="/planner" className="text-sm font-bold text-share-primary hover:text-share-primaryContainer">
            Back to Day Planner
          </Link>
        </div>
      </AppChrome>
    );
  }

  const step2State = connected ? "current" : "upcoming";
  const step3State = calendarSaved ? "current" : !connected ? "upcoming" : "upcoming";

  return (
    <AppChrome
      headerPositionClass="top-0"
      mobileActive="planner"
      maxWidthClass="max-w-4xl"
      showCalendarLink
    >
      <header className="mb-12">
        <h1 className="font-shareHeadline text-4xl font-extrabold tracking-tight text-share-onSurface">
          Sync your world
        </h1>
        <p className="mt-2 text-lg text-share-onSurfaceVariant">
          Centralize your schedule across platforms for a unified focus experience.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl bg-share-surfaceContainerLow p-1">
        <div className="flex flex-wrap items-center gap-4 border-b border-share-outlineVariant/10 bg-share-surfaceContainerHigh/50 px-4 py-4 md:px-8">
          <StepPill step={1} label="Connect" state={connected ? "done" : "current"} />
          <div className="mx-2 hidden h-px min-w-[2rem] flex-1 bg-share-outlineVariant/20 sm:block" />
          <StepPill step={2} label="Choose" state={calendarSaved ? "done" : step2State} />
          <div className="mx-2 hidden h-px min-w-[2rem] flex-1 bg-share-outlineVariant/20 sm:block" />
          <StepPill step={3} label="Sync" state={step3State} />
        </div>

        <div className="flex flex-col items-center px-6 py-12 text-center md:px-12">
          <div className="mb-8 rounded-full bg-share-surfaceContainerHighest p-6">
            <MaterialIcon
              name={connected ? "link" : "sync_lock"}
              className={`text-6xl ${connected ? "text-emerald-400" : "text-share-primary"}`}
            />
          </div>
          <h2 className="mb-4 font-shareHeadline text-2xl font-bold text-share-onSurface">
            {connected ? "Google Calendar connected" : "Sync with Google Calendar"}
          </h2>
          <p className="mb-8 max-w-md leading-relaxed text-share-onSurfaceVariant">
            {connected
              ? "Your account is linked. Choose a calendar below and start syncing."
              : "Integrate your daily appointments directly into your Life Planner. Access tokens are encrypted on the server."}
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          {connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`${appSecondaryButtonClass()} flex items-center gap-2 border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10`}
            >
              <MaterialIcon name="link_off" className="text-base" />
              {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className={`${appPrimaryButtonClass()} flex items-center gap-3 px-10 py-4 text-base shadow-xl shadow-share-primary/10`}
            >
              <MaterialIcon name="google" />
              {loading ? "Opening Google…" : "Connect Google Calendar"}
            </button>
          )}

          <div className="mt-10 flex items-center gap-2 text-xs font-medium text-share-onSurfaceVariant">
            <MaterialIcon name="verified_user" filled className="text-sm" />
            Your data stays private and is not sold to third parties.
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className={`${appCardClass()} flex flex-col gap-6`}>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-share-onSurface">Choose calendars</h3>
            <span className="text-xs font-bold uppercase tracking-widest text-share-primary/80">
              Step 2
            </span>
          </div>
          {calendars.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-share-outlineVariant/20 py-8">
              <MaterialIcon name="event_busy" className="text-4xl text-share-outlineVariant/50" />
              <p className="text-sm text-share-onSurfaceVariant">Connect first to list calendars</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor="calendar" className="text-sm font-medium text-share-onSurface">
                Calendar to sync
              </label>
              <select
                id="calendar"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={appInputClass()}
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}{c.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
              {savedCalendarName && (
                <p className="text-xs text-share-onSurfaceVariant">
                  Active:{" "}
                  <span className="font-medium text-share-onSurface">{savedCalendarName}</span>
                </p>
              )}
              {!savedCalendarName && primary && (
                <p className="text-xs text-share-onSurfaceVariant">
                  Primary detected:{" "}
                  <span className="text-share-onSurface">{primary.summary}</span>
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!selectedId || savingSelection}
            onClick={async () => {
              setError(null);
              setSyncMessage("");
              setSavingSelection(true);
              const selected = calendars.find((c) => c.id === selectedId);
              addLog("calendar-select", `Saving: ${selected?.summary ?? selectedId}`, true);
              try {
                await selectGoogleCalendar({
                  calendarId: selectedId,
                  calendarSummary: selected?.summary,
                });
                setSavedCalendarName(selected?.summary ?? selectedId);
                setSyncMessage("Calendar selection saved.");
                addLog("calendar-select", `Saved OK: ${selected?.summary ?? selectedId}`, true);
              } catch (e) {
                const msg = (e as Error).message ?? "Failed to save selection.";
                addLog("calendar-select", `ERROR: ${msg}`, false);
                setError(msg);
              } finally {
                setSavingSelection(false);
              }
            }}
            className={`${appSecondaryButtonClass()} w-full py-3 font-bold`}
          >
            {savingSelection ? "Saving…" : "Save selection"}
          </button>
        </div>

        <div className={`${appCardClass()} flex flex-col gap-6`}>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-share-onSurface">Sync actions</h3>
            <span className="text-xs font-bold uppercase tracking-widest text-share-primary/80">
              Step 3
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-share-surfaceContainerHigh p-4">
              <div className="flex items-center gap-3">
                <MaterialIcon name="download" className="text-share-onSurfaceVariant" />
                <div>
                  <span className="text-sm font-medium text-share-onSurface">Sync from Google</span>
                  <p className="text-xs text-share-onSurfaceVariant">Import events as planner tasks</p>
                </div>
              </div>
              <span
                className={`h-2 w-2 rounded-full ${syncing === "pull" ? "animate-pulse bg-share-primary" : "bg-share-outlineVariant"}`}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-share-surfaceContainerHigh p-4">
              <div className="flex items-center gap-3">
                <MaterialIcon name="upload" className="text-share-onSurfaceVariant" />
                <div>
                  <span className="text-sm font-medium text-share-onSurface">Sync to Google</span>
                  <p className="text-xs text-share-onSurfaceVariant">Push scheduled tasks to calendar</p>
                </div>
              </div>
              <span
                className={`h-2 w-2 rounded-full ${syncing === "push" ? "animate-pulse bg-share-primary" : "bg-share-outlineVariant"}`}
              />
            </div>
          </div>
          {syncMessage && (
            <p className="text-sm text-share-primary" role="status">
              {syncMessage}
            </p>
          )}
          <div className="mt-auto">
            <div className="mb-2 flex justify-between text-xs text-share-onSurfaceVariant">
              <span>Connection</span>
              <span className={connected ? "text-emerald-400" : "text-share-onSurfaceVariant"}>
                {connected ? "Active" : "Not connected"}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-share-surfaceContainerHighest">
              <div
                className="h-full rounded-full bg-share-primary transition-all"
                style={{ width: connected ? "100%" : "0%" }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!calendarSaved || syncing !== null}
              onClick={async () => {
                setError(null);
                setSyncMessage("");
                setSyncing("pull");
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                addLog("sync-pull", `Starting pull | timezone: ${tz}`, true);
                try {
                  const res = await syncFromGoogle();
                  setSyncMessage(`Imported ${res.imported} new event(s).`);
                  addLog("sync-pull", `Done — imported: ${res.imported}`, true);
                } catch (e) {
                  const msg = (e as Error).message ?? "Sync from Google failed.";
                  addLog("sync-pull", `ERROR: ${msg}`, false);
                  setError(msg);
                } finally {
                  setSyncing(null);
                }
              }}
              className={appPrimaryButtonClass()}
            >
              {syncing === "pull" ? "Syncing…" : "Sync from Google"}
            </button>
            <button
              type="button"
              disabled={!calendarSaved || syncing !== null}
              onClick={async () => {
                setError(null);
                setSyncMessage("");
                setSyncing("push");
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                addLog("sync-push", `Starting push | timezone: ${tz}`, true);
                try {
                  const res = await syncToGoogle();
                  setSyncMessage(
                    `Created ${res.created}, updated ${res.updated}${res.skipped > 0 ? `, skipped ${res.skipped}` : ""}.`,
                  );
                  addLog("sync-push", `Done — created: ${res.created}, updated: ${res.updated}, skipped: ${res.skipped}`, true);
                } catch (e) {
                  const msg = (e as Error).message ?? "Sync to Google failed.";
                  addLog("sync-push", `ERROR: ${msg}`, false);
                  setError(msg);
                } finally {
                  setSyncing(null);
                }
              }}
              className={appSecondaryButtonClass()}
            >
              {syncing === "push" ? "Syncing…" : "Sync to Google"}
            </button>
          </div>
          {!calendarSaved && connected && (
            <p className="text-xs text-share-onSurfaceVariant">
              Save a calendar selection in Step 2 to enable sync.
            </p>
          )}
        </div>
      </div>

      {/* ── Debug log panel ──────────────────────────────────────────────── */}
      <div className="mt-8 rounded-xl border border-share-outlineVariant/20 bg-share-surfaceContainerLow">
        <button
          type="button"
          onClick={() => setDebugOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon name="bug_report" className="text-base text-share-onSurfaceVariant" />
            <span className="text-sm font-medium text-share-onSurfaceVariant">Debug log</span>
            {debugLogs.length > 0 && (
              <span className="rounded-full bg-share-surfaceContainerHigh px-2 py-0.5 text-xs text-share-onSurfaceVariant">
                {debugLogs.length}
              </span>
            )}
            {debugLogs.some((l) => !l.ok) && (
              <span className="h-2 w-2 rounded-full bg-red-400" title="Errors present" />
            )}
          </div>
          <div className="flex items-center gap-3">
            {debugLogs.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDebugLogs([]); }}
                className="text-xs text-share-onSurfaceVariant hover:text-share-onSurface"
              >
                Clear
              </button>
            )}
            <MaterialIcon
              name={debugOpen ? "expand_less" : "expand_more"}
              className="text-base text-share-onSurfaceVariant"
            />
          </div>
        </button>
        {debugOpen && (
          <div className="border-t border-share-outlineVariant/20 px-4 pb-4 pt-2">
            {debugLogs.length === 0 ? (
              <p className="py-4 text-center text-xs text-share-onSurfaceVariant">
                No activity yet. Use the controls above to start testing.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto font-mono text-xs">
                {debugLogs.map((entry, i) => (
                  <div key={i} className={`flex gap-3 border-b border-share-outlineVariant/10 py-1.5 ${entry.ok ? "" : "bg-red-500/5"}`}>
                    <span className="shrink-0 text-share-onSurfaceVariant">{entry.ts}</span>
                    <span className={`shrink-0 w-28 font-semibold ${entry.ok ? "text-sky-400" : "text-red-400"}`}>
                      {entry.fn}
                    </span>
                    <span className={entry.ok ? "text-share-onSurface" : "text-red-300"}>{entry.detail}</span>
                  </div>
                ))}
                <div ref={debugEndRef} />
              </div>
            )}
            <p className="mt-3 text-xs text-share-onSurfaceVariant">
              Server-side logs: Supabase Dashboard → Edge Functions → [function name] → Logs
            </p>
          </div>
        )}
      </div>

      <div className="relative mt-12 overflow-hidden rounded-xl border border-white/5 bg-share-surfaceContainerHighest p-8">
        <div className="relative z-10">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-share-primary">
            The focus block
          </p>
          <h2 className="mb-6 font-shareHeadline text-3xl font-bold text-share-onSurface">
            Why sync matters
          </h2>
          <p className="max-w-2xl leading-relaxed text-share-onSurfaceVariant">
            By syncing Google Calendar, Life Planner can line up focus time with existing
            commitments so you see one coherent day—not two competing schedules.
          </p>
        </div>
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-share-primary/10 blur-[100px]" />
      </div>
    </AppChrome>
  );
}
