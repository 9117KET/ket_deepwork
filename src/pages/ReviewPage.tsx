/**
 * pages/ReviewPage.tsx
 *
 * Everything month-scale, in the one place you go looking for it deliberately.
 *
 * This used to render underneath the day planner on every screen and every
 * mobile tab — about 2,500px of dashboard, including two 31-column grids, that
 * you scrolled past to reach anything. Measured across the four mobile tabs it
 * was byte-identical on all of them, which is what made the tab bar feel like
 * it did nothing. Giving it its own destination is the single change that
 * removes it from the day.
 *
 * See `docs/design/README.md` for the wider IA this belongs to.
 */

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { AccountMenu } from "../components/nav/AccountMenu";
import { DayJournalCard } from "../components/planner/DayJournalCard";
import { MonthlyTrackingDashboard } from "../components/tracking";
import { useAuth } from "../contexts/AuthContext";
import { todayIso } from "../domain/dateUtils";
import { useReviewHandlers } from "../hooks/useReviewHandlers";
import { useTaskHandlers } from "../hooks/useTaskHandlers";
import { usePersistentState } from "../storage/localStorageState";

export function ReviewPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appState, updateAppState, isHydrating] = usePersistentState();

  // The dashboard is anchored on a day only so it knows which month to open on.
  const [referenceDay] = useState<string>(todayIso);

  const { handleUpdateWeeklyReview } = useTaskHandlers(updateAppState, referenceDay, false);
  const {
    handleSaveDayJournal,
    handleSaveFocusHijacker,
    handleTrackingUpdateDay,
    handleTrackingUpdateSettings,
  } = useReviewHandlers(updateAppState, referenceDay);

  /**
   * A review banner on the planner links here with `?open=monthly|weekly` and
   * expects that card expanded on arrival. The dashboard opens a card when its
   * trigger prop changes, so a non-zero constant is enough for a fresh mount.
   */
  const openTarget = searchParams.get("open");
  const monthlyOpenTrigger = openTarget === "monthly" ? 1 : 0;
  const weeklyOpenTrigger = openTarget === "weekly" ? 1 : 0;

  const userInitial = useMemo(() => {
    const firstChar = (user?.email ?? "").trim().charAt(0);
    return firstChar ? firstChar.toUpperCase() : "U";
  }, [user]);

  const handleSignOut = useCallback(async () => {
    const error = await signOut();
    if (error) console.error("[auth] Failed to sign out", error);
  }, [signOut]);

  const dayState = appState.days[referenceDay];

  const trailing = (
    <AccountMenu
      dropUp
      userInitial={userInitial}
      userEmail={user?.email}
      items={[
        { kind: "action", key: "planner", label: "Back to today", onSelect: () => navigate("/planner") },
        { kind: "separator", key: "sep-1", hidden: !user },
        {
          kind: "action",
          key: "signout",
          label: "Sign out",
          onSelect: () => void handleSignOut(),
          muted: true,
          hidden: !user,
        },
      ]}
    />
  );

  if (loading || isHydrating) {
    return (
      <AppChrome mobileActive="planner" trailing={trailing}>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your review…</p>
        </div>
      </AppChrome>
    );
  }

  return (
    <AppChrome mobileActive="planner" trailing={trailing}>
      <div className="mx-auto max-w-[1200px] px-4 py-6 pb-28 md:px-8 md:pb-10">
        <ReviewHeader onBack={() => navigate("/planner")} />

        <div className="mt-6 space-y-6">
          <DayJournalCard
            dayNote={dayState?.dayNote}
            focusHijacker={dayState?.focusHijacker}
            onSaveNote={handleSaveDayJournal}
            onSaveHijacker={handleSaveFocusHijacker}
          />

          <MonthlyTrackingDashboard
            state={appState}
            referenceDay={referenceDay}
            onUpdateDay={handleTrackingUpdateDay}
            onUpdateSettings={handleTrackingUpdateSettings}
            scrollToReview={monthlyOpenTrigger}
            weeklyReviewOpenTrigger={weeklyOpenTrigger}
            onUpdateWeeklyReview={handleUpdateWeeklyReview}
          />
        </div>
      </div>
    </AppChrome>
  );
}

/** Title plus the way back to the day. */
function ReviewHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-shareHeadline text-2xl font-bold text-share-onBg">Review</h1>
      <div className="flex gap-1 rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow p-1">
        <button
          type="button"
          onClick={onBack}
          className="touch-target-coarse rounded-lg px-3 py-1.5 text-sm font-medium text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
        >
          Today
        </button>
        <span className="touch-target-coarse flex items-center rounded-lg bg-share-primary px-3 py-1.5 text-sm font-bold text-share-onPrimary">
          Review
        </span>
      </div>
    </div>
  );
}
