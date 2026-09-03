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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { AccountMenu } from "../components/nav/AccountMenu";
import { DayJournalCard } from "../components/planner/DayJournalCard";
import { MonthlyTrackingDashboard } from "../components/tracking";
import { ReviewRail, type RailLink } from "../components/tracking/ReviewRail";
import { ReviewStatTiles } from "../components/tracking/ReviewStatTiles";
import { MobileReviewPanel } from "../components/tracking/MobileReviewPanel";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { useAuth } from "../contexts/AuthContext";
import { markGuestSession } from "../storage/guestSession";
import {
  isWeeklyReviewDay,
  nextMonthId,
  previousMonthId,
  todayIso,
  toMonthId,
} from "../domain/dateUtils";
import {
  computeBlockCompletion,
  computeHabitConsistency,
  habitIdsOf,
  weekDatesFor,
} from "../domain/reviewStats";
import { computeDailyDeepWorkMinutes, computeWeeklyDeepWorkHours } from "../domain/stats";
import { DEFAULT_HABIT_DEFINITIONS } from "../domain/types";
import { useIsDesktop } from "../hooks/useIsDesktop";
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
  /**
   * The month is the scope of this whole screen — the stat tiles, the grids and
   * the review card all read it — so the page owns it and the header steps it,
   * rather than one card inside the page steering the rest.
   */
  const [monthId, setMonthId] = useState(() => toMonthId(referenceDay));

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

  /*
   * Review serves planner data to anyone who opens it, signed in or not. That
   * is the behaviour it has always had, so the honest thing is to record it:
   * without this, a guest who lands here and taps Today on the tab bar meets a
   * sign-in form for data they are already looking at.
   */
  useEffect(() => {
    if (!loading && !user) markGuestSession();
  }, [loading, user]);

  const dayState = appState.days[referenceDay];

  /**
   * On a phone the heavy content — the grids, the reviews, the goals, the
   * journal — renders only once asked for. Rendering it up front is how the
   * old Stats tab became 2,580px of scroll; this way nothing was removed, it
   * just stopped being in the way.
   */
  const isDesktop = useIsDesktop();
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  /**
   * Not a CSS hide: on a phone this content is not mounted at all until asked
   * for. Two 31-column grids and five editors cost the same to build whether
   * or not they are painted, and the whole point of the mobile Review screen
   * is that opening it is cheap.
   */
  const showDetail = isDesktop || mobileDetailOpen;
  const openMobileDetail = useCallback((targetId: string) => {
    setMobileDetailOpen(true);
    // The target does not exist until the reveal has painted.
    requestAnimationFrame(() =>
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const weekMinutes = useMemo(
    () => weekDatesFor(referenceDay).map((iso) => computeDailyDeepWorkMinutes(appState.days[iso])),
    [appState.days, referenceDay],
  );

  const deepWorkHours = useMemo(
    () => computeWeeklyDeepWorkHours(appState.days, weekDatesFor(referenceDay)),
    [appState.days, referenceDay],
  );
  const blockCompletion = useMemo(
    () => computeBlockCompletion(appState.days, monthId).ratio,
    [appState.days, monthId],
  );
  const habitConsistency = useMemo(
    () =>
      computeHabitConsistency(
        appState.days,
        habitIdsOf(appState, DEFAULT_HABIT_DEFINITIONS),
        monthId,
        todayIso(),
      ),
    [appState, monthId],
  );

  /**
   * The rail's contents. Each note says whether the thing needs you now or just
   * describes what is in it — only the first kind wears the accent.
   */
  const railLinks: RailLink[] = useMemo(() => {
    const weeklyDue =
      isWeeklyReviewDay(todayIso(), appState.weeklyReviewDay ?? 5) &&
      !appState.weeklyReviews?.[referenceDay]?.completedAt;
    const monthlyDone = Boolean(appState.monthlyReviews?.[monthId]?.completedAt);
    const habitCount = habitIdsOf(appState, DEFAULT_HABIT_DEFINITIONS).length;
    const consistencyNote =
      habitConsistency === null
        ? `${habitCount} habits`
        : `${habitCount} habits · ${Math.round(habitConsistency * 100)}% this month`;

    return [
      {
        key: "weekly",
        label: "Weekly review",
        note: weeklyDue ? "Due today" : "Not due yet",
        isDue: weeklyDue,
        targetId: "review-weekly",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        ),
      },
      {
        key: "monthly",
        label: "Monthly review",
        note: monthlyDone ? "Written" : "Not written yet",
        targetId: "review-monthly",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        ),
      },
      {
        key: "journal",
        label: "Day journal",
        note: dayState?.dayNote ? "Written today" : "Empty today",
        targetId: "review-journal",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M9 3v18" /></svg>
        ),
      },
      {
        key: "goals",
        label: "Goals & North Star",
        note: "Life → 5yr → 1yr → 6mo",
        targetId: "review-goals",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.4 6.3 6.6.3-5.2 4.1 1.8 6.3-5.6-3.7-5.6 3.7 1.8-6.3L3 9.6l6.6-.3z" /></svg>
        ),
      },
      {
        key: "habits",
        label: "Habit month grid",
        note: consistencyNote,
        targetId: "review-habit-grid",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        ),
      },
    ];
  }, [appState, referenceDay, monthId, dayState, habitConsistency]);

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
      <AppChrome mobileActive="planner" trailing={trailing} showMobileNav={false}>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your review…</p>
        </div>
      </AppChrome>
    );
  }

  return (
    <AppChrome mobileActive="planner" trailing={trailing}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 pb-28 md:px-8 md:pb-10">
        <ReviewHeader
          onBack={() => navigate("/planner")}
          monthId={monthId}
          onPrevMonth={() => setMonthId(previousMonthId(monthId))}
          onNextMonth={() => setMonthId(nextMonthId(monthId))}
        />

        {/*
          Two columns on a wide screen: the evidence on the left, the way into
          each month-scale tool on the right. Below xl the rail drops under the
          content rather than squeezing it, since its links only ever scroll.
        */}
        <div className="mt-6 lg:hidden">
          <MobileReviewPanel
            deepWorkHours={deepWorkHours}
            deepWorkGoalHours={appState.deepWorkGoalHoursPerWeek ?? 20}
            weekMinutes={weekMinutes}
            blockCompletion={blockCompletion}
            onOpen={openMobileDetail}
            journalWritten={Boolean(dayState?.dayNote)}
            weeklyDue={
              isWeeklyReviewDay(todayIso(), appState.weeklyReviewDay ?? 5) &&
              !appState.weeklyReviews?.[referenceDay]?.completedAt
            }
            monthlyWritten={Boolean(appState.monthlyReviews?.[monthId]?.completedAt)}
          />
        </div>

        {showDetail && (
        <div className="mt-6 flex flex-col gap-7 xl:flex-row">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="hidden lg:block">
            <ReviewStatTiles
              deepWorkHours={deepWorkHours}
              deepWorkGoalHours={appState.deepWorkGoalHoursPerWeek ?? 20}
              blockCompletion={blockCompletion}
              habitConsistency={habitConsistency}
            />
            </div>

            <div id="review-journal">
              <DayJournalCard
                dayNote={dayState?.dayNote}
                focusHijacker={dayState?.focusHijacker}
                onSaveNote={handleSaveDayJournal}
                onSaveHijacker={handleSaveFocusHijacker}
              />
            </div>

            <MonthlyTrackingDashboard
              state={appState}
              referenceDay={referenceDay}
              monthId={monthId}
              onMonthChange={setMonthId}
              onUpdateDay={handleTrackingUpdateDay}
              onUpdateSettings={handleTrackingUpdateSettings}
              scrollToReview={monthlyOpenTrigger}
              weeklyReviewOpenTrigger={weeklyOpenTrigger}
              onUpdateWeeklyReview={handleUpdateWeeklyReview}
            />
          </div>

          <aside className="hidden w-full shrink-0 lg:block xl:w-[320px]">
            <ReviewRail
              chapterTitle={appState.monthTitles?.[monthId] ?? ""}
              links={railLinks}
            />
          </aside>
        </div>
        )}
      </div>
      <MobileTabBar
        activeTab={null}
        reviewActive
        onTabChange={(tab) => navigate(`/planner?tab=${tab}`)}
      />
    </AppChrome>
  );
}

/** Title, the way back to the day, and the month this whole screen is about. */
function ReviewHeader({
  onBack,
  monthId,
  onPrevMonth,
  onNextMonth,
}: {
  onBack: () => void;
  monthId: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [year, month] = monthId.split("-").map(Number);
  const label = new Date(year ?? 2026, (month ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="flex items-center gap-1 rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow p-1">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="touch-target-coarse flex w-8 items-center justify-center rounded-lg text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="min-w-[128px] text-center text-sm font-bold text-share-onBg">{label}</span>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="touch-target-coarse flex w-8 items-center justify-center rounded-lg text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}
