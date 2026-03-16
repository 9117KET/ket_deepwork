/**
 * App.tsx
 *
 * Root application shell for Life Planner.
 * Handles share links (?share=TOKEN) first, then routes: landing, day planner, travel, finance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route } from "react-router-dom";
import type { AppState, DayState } from "./domain/types";
import { DayPlanner } from "./components/planner/DayPlanner";
import {
  validateShareToken,
  fetchSharedPlannerState,
  upsertSharedDay,
} from "./storage/supabaseSharing";
import { LandingPage } from "./pages/LandingPage";
import { PlannerPage } from "./pages/PlannerPage";
import { TravelPlannerPage } from "./pages/TravelPlannerPage";
import { FinancialPlannerPage } from "./pages/FinancialPlannerPage";

/** Read ?share=TOKEN from the URL once on load. */
function getShareTokenFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("share");
}

function App() {
  // ── Shared planner (visitor mode) ──────────────────────────────────────────
  const shareToken = useMemo(() => getShareTokenFromUrl(), []);
  const [sharePermission, setSharePermission] = useState<
    "view" | "edit" | null
  >(null);
  const [sharedState, setSharedState] = useState<AppState | null>(null);
  const [shareLoading, setShareLoading] = useState(Boolean(shareToken));
  const [shareError, setShareError] = useState(false);

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
        <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading shared planner…</p>
        </div>
      );
    }
    if (shareError || !sharedState || !sharePermission) {
      return (
        <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-base font-medium text-slate-200">
              Link not found or expired
            </p>
            <p className="text-sm text-slate-400">
              This share link may have been removed by its owner.
            </p>
            <a
              href="/"
              className="inline-block mt-4 rounded border border-slate-600 bg-slate-800 px-4 py-2 text-xs text-slate-200 hover:border-sky-600 hover:text-sky-300"
            >
              Go to Life Planner
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-950 text-slate-100 min-h-screen">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Life Planner
              </h1>
              <p className="text-sm text-slate-400">
                {sharePermission === "edit"
                  ? "Shared planner — you can add, complete, and delete tasks."
                  : "Shared planner — view only."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  sharePermission === "edit"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-slate-600 bg-slate-800 text-slate-300"
                }`}
              >
                {sharePermission === "edit" ? "Edit access" : "View only"}
              </span>
            </div>
          </header>
          <DayPlanner
            shareMode={sharePermission}
            externalState={sharedState}
            onExternalUpdate={handleExternalUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/planner" element={<PlannerPage />} />
      <Route path="/travel" element={<TravelPlannerPage />} />
      <Route path="/finance" element={<FinancialPlannerPage />} />
    </Routes>
  );
}

export default App;
