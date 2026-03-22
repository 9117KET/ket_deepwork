/**
 * App.tsx
 *
 * Root application shell for Life Planner.
 * Handles share links (?share=TOKEN) first, then routes: landing, day planner, travel, finance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, useSearchParams } from "react-router-dom";
import type { AppState, DayState } from "./domain/types";
import { todayIso } from "./domain/dateUtils";
import { DayPlanner } from "./components/planner/DayPlanner";
import { SharedPlannerShell } from "./components/planner/SharedPlannerShell";
import {
  validateShareToken,
  fetchSharedPlannerState,
  upsertSharedDay,
} from "./storage/supabaseSharing";
import { LandingPage } from "./pages/LandingPage";
import { PlannerPage } from "./pages/PlannerPage";
import { TravelPlannerPage } from "./pages/TravelPlannerPage";
import { FinancialPlannerPage } from "./pages/FinancialPlannerPage";
import { CalendarSyncPage } from "./pages/CalendarSyncPage";
import { CalendarCallbackPage } from "./pages/CalendarCallbackPage";

function App() {
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("share");

  // ── Shared planner (visitor mode) ──────────────────────────────────────────
  const [sharePermission, setSharePermission] = useState<
    "view" | "edit" | null
  >(null);
  const [sharedState, setSharedState] = useState<AppState | null>(null);
  const [shareLoading, setShareLoading] = useState(Boolean(shareToken));
  const [shareError, setShareError] = useState(false);
  const [shareSelectedDay, setShareSelectedDay] = useState(todayIso);

  /** In-memory planner for dev-only Stitch shell preview (no share token). */
  const [previewShellState, setPreviewShellState] = useState<AppState>({ days: {} });
  const [previewShellDay, setPreviewShellDay] = useState(todayIso);
  const handlePreviewShellUpdate = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setPreviewShellState((prev) => updater(prev));
    },
    [],
  );

  useEffect(() => {
    if (!shareToken) return;
    const loadShared = async () => {
      setShareLoading(true);
      const [meta, state] = await Promise.all([
        validateShareToken(shareToken),
        fetchSharedPlannerState(shareToken),
      ]);
      if (!meta || !state) {
        setShareError(true);
      } else {
        setSharePermission(meta.permission);
        setSharedState(state);
      }
      setShareLoading(false);
    };
    void loadShared();
  }, [shareToken]);

  const sharedStateRef = useRef(sharedState);
  useEffect(() => {
    sharedStateRef.current = sharedState;
  }, [sharedState]);

  const handleExternalUpdate = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setSharedState((prev) => {
        const base = prev ?? { days: {} };
        const next = updater(base);
        for (const [date, dayState] of Object.entries(next.days)) {
          if (dayState && dayState !== base.days[date] && shareToken) {
            void upsertSharedDay(shareToken, date, dayState as DayState);
          }
        }
        return next;
      });
    },
    [shareToken],
  );

  // ── Shared visitor rendering ───────────────────────────────────────────────
  if (shareToken) {
    if (shareLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-share-bg font-shareSans text-share-onSurfaceVariant">
          <p className="text-sm">Loading shared planner…</p>
        </div>
      );
    }
    if (shareError || !sharedState || !sharePermission) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-share-bg p-6 font-shareSans text-share-onBg">
          <div className="text-center space-y-2">
            <p className="text-base font-bold text-share-onSurface">Link not found or expired</p>
            <p className="text-sm text-share-onSurfaceVariant">
              This share link may have been removed by its owner.
            </p>
            <a
              href="/"
              className="mt-4 inline-block rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-4 py-2 text-xs font-bold text-share-onSurface hover:border-share-primary/50"
            >
              Go to Life Planner
            </a>
          </div>
        </div>
      );
    }

    return (
      <SharedPlannerShell
        permission={sharePermission}
        appState={sharedState}
        selectedDay={shareSelectedDay}
      >
        <DayPlanner
          shareMode={sharePermission}
          externalState={sharedState}
          onExternalUpdate={handleExternalUpdate}
          shareShellLayout
          selectedDay={shareSelectedDay}
          onSelectedDayChange={setShareSelectedDay}
        />
      </SharedPlannerShell>
    );
  }

  if (
    import.meta.env.DEV &&
    !shareToken &&
    searchParams.get("previewSharedShell") === "1"
  ) {
    return (
      <SharedPlannerShell
        permission="edit"
        appState={previewShellState}
        selectedDay={previewShellDay}
        devPreview
      >
        <DayPlanner
          shareMode="edit"
          externalState={previewShellState}
          onExternalUpdate={handlePreviewShellUpdate}
          shareShellLayout
          selectedDay={previewShellDay}
          onSelectedDayChange={setPreviewShellDay}
        />
      </SharedPlannerShell>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/planner" element={<PlannerPage />} />
      <Route path="/travel" element={<TravelPlannerPage />} />
      <Route path="/finance" element={<FinancialPlannerPage />} />
      <Route path="/calendar" element={<CalendarSyncPage />} />
      <Route path="/calendar/callback" element={<CalendarCallbackPage />} />
    </Routes>
  );
}

export default App;
