/**
 * pages/ReviewPage.tsx
 *
 * One question, one screen: did this week's work happen?
 *
 * Earned hours (from the timer) against the weekly goal, a bar per day, the
 * hand-logged total beside it but never added to it, and seven days of each
 * habit. Everything month-scale, the journal and the goal cascade were cut in
 * the minimal rewrite: the calendar and an AI assistant answer "how has the
 * month gone" better than a grid nobody opened. Their data is untouched in
 * `AppState`, so nothing recorded was lost by removing the screens.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { AccountMenu } from "../components/nav/AccountMenu";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { ChallengeReviewSection } from "../components/challenge/ChallengeReviewSection";
import { useAuth } from "../contexts/AuthContext";
import { markGuestSession } from "../storage/guestSession";
import { addDays, todayIso, weekForDay } from "../domain/dateUtils";
import { computeHabitWeek, countHabitWeekDone } from "../domain/habitWeek";
import {
  computeDailyDeepWorkMinutes,
  computeDailySelfReportedMinutes,
} from "../domain/stats";
import { DEFAULT_HABIT_DEFINITIONS } from "../domain/types";
import { usePersistentState } from "../storage/localStorageState";

const DEFAULT_GOAL_HOURS = 20;
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours >= 10 || Number.isInteger(hours) ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function formatWeekRange(dates: string[]): string {
  const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const toDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  };
  return `${fmt.format(toDate(dates[0]!))} – ${fmt.format(toDate(dates[6]!))}`;
}

export function ReviewPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [appState, updateAppState, isHydrating] = usePersistentState();
  const today = todayIso();
  const [weekAnchor, setWeekAnchor] = useState(today);

  /*
   * Review serves planner data to anyone who opens it, signed in or not, so a
   * guest who lands here and taps Today should not meet a sign-in form for
   * data they are already looking at.
   */
  useEffect(() => {
    if (!loading && !user) markGuestSession();
  }, [loading, user]);

  const userInitial = useMemo(() => {
    const firstChar = (user?.email ?? "").trim().charAt(0);
    return firstChar ? firstChar.toUpperCase() : "U";
  }, [user]);

  const handleSignOut = useCallback(async () => {
    const error = await signOut();
    if (error) console.error("[auth] Failed to sign out", error);
  }, [signOut]);

  const weekDates = useMemo(() => weekForDay(weekAnchor).days, [weekAnchor]);
  const isCurrentWeek = weekDates.includes(today);

  const earnedByDay = useMemo(
    () => weekDates.map((iso) => computeDailyDeepWorkMinutes(appState.days[iso])),
    [appState.days, weekDates],
  );
  const earnedMinutes = earnedByDay.reduce((a, b) => a + b, 0);
  const selfReportedMinutes = useMemo(
    () => weekDates.reduce((sum, iso) => sum + computeDailySelfReportedMinutes(appState.days[iso]), 0),
    [appState.days, weekDates],
  );

  const goalHours = appState.deepWorkGoalHoursPerWeek ?? DEFAULT_GOAL_HOURS;
  const goalRatio = goalHours > 0 ? Math.min(1, earnedMinutes / 60 / goalHours) : 0;
  const maxDay = Math.max(60, ...earnedByDay);

  const setGoalHours = useCallback(
    (hours: number) => {
      if (!Number.isFinite(hours) || hours <= 0) return;
      updateAppState((prev) => ({ ...prev, deepWorkGoalHoursPerWeek: hours }));
    },
    [updateAppState],
  );

  // Seven days ending on the last day of the shown week (or today, if sooner).
  const habitUntil = isCurrentWeek ? today : weekDates[6]!;
  const habits = appState.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS;

  const trailing = (
    <AccountMenu
      dropUp
      userInitial={userInitial}
      userEmail={user?.email}
      items={[
        { kind: "action", key: "planner", label: "Back to today", onSelect: () => navigate("/") },
        { kind: "action", key: "challenge", label: "Challenge", onSelect: () => navigate("/challenge"), hidden: !user },
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
      <AppChrome showCalendarLink={Boolean(user)} showChallengeLink={Boolean(user)} trailing={trailing}>
        <div className="flex min-h-[50dvh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your week…</p>
        </div>
      </AppChrome>
    );
  }

  return (
    <AppChrome showCalendarLink={Boolean(user)} showChallengeLink={Boolean(user)} trailing={trailing}>
      <div className="mx-auto max-w-xl px-4 py-5 pb-28 md:py-8 md:pb-10">
        {/* Week stepper */}
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((a) => addDays(a, -7))}
            className="touch-target flex items-center justify-center rounded-xl text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh"
            aria-label="Previous week"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="text-center">
            <h1 className="page-title">
              {isCurrentWeek ? "This week" : "Week"}
            </h1>
            <p className="mt-0.5 text-xs text-share-onSurfaceVariant">{formatWeekRange(weekDates)}</p>
          </div>
          <button
            type="button"
            onClick={() => setWeekAnchor((a) => addDays(a, 7))}
            disabled={isCurrentWeek}
            className="touch-target flex items-center justify-center rounded-xl text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh disabled:opacity-30"
            aria-label="Next week"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </header>

        {/* Worked time against the goal */}
        <section className="mt-5 rounded-2xl bg-share-surfaceContainerLow p-4">
          <div className="flex items-center justify-between">
            <p className="overline">Deep work</p>
            <label className="flex items-center gap-1.5 text-xs text-share-onSurfaceVariant">
              Goal
              <input
                type="number"
                min={1}
                max={80}
                inputMode="numeric"
                value={goalHours}
                onChange={(e) => setGoalHours(Number(e.target.value))}
                className="min-h-[44px] w-14 rounded-lg border border-share-outlineVariant bg-transparent px-2 text-right text-base text-share-onSurface sm:text-sm"
                aria-label="Weekly deep work goal in hours"
              />
              h
            </label>
          </div>
          <p className="stat-number mt-1 text-share-onBg">
            {formatHours(earnedMinutes)}
            <span className="font-shareSans text-sm font-semibold text-share-onSurfaceVariant"> / {goalHours}h</span>
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-share-hairline"
            role="progressbar"
            aria-valuenow={Math.round(goalRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-share-primary" style={{ width: `${goalRatio * 100}%` }} />
          </div>

          {/* A bar per day */}
          <div className="mt-5 flex items-end gap-2" aria-label="Deep work per day">
            {weekDates.map((iso, i) => {
              const minutes = earnedByDay[i]!;
              const isToday = iso === today;
              return (
                <div key={iso} className="flex flex-1 flex-col items-center gap-1">
                  <span className="min-h-[1rem] text-[11px] tabular-nums text-share-onSurfaceVariant">
                    {minutes > 0 ? formatHours(minutes) : ""}
                  </span>
                  <div className="flex h-20 w-full items-end">
                    <div
                      className={`w-full rounded-md ${minutes > 0 ? "bg-share-primary/80" : "bg-share-hairline"}`}
                      style={{ height: `${Math.max(4, (minutes / maxDay) * 100)}%` }}
                      title={`${iso}: ${minutes} min`}
                    />
                  </div>
                  <span className={`text-[11px] ${isToday ? "font-bold text-share-primary" : "text-share-onSurfaceDim"}`}>
                    {WEEKDAY_LETTERS[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {selfReportedMinutes > 0 && (
            <p className="mt-3 text-xs text-share-onSurfaceVariant">
              + {formatHours(selfReportedMinutes)} logged by hand — not counted toward the goal.
            </p>
          )}
        </section>

        {/* Habits, seven days each */}
        {habits.length > 0 && (
          <section className="mt-4 rounded-2xl bg-share-surfaceContainerLow p-4">
            <p className="overline">Habits · last 7 days</p>
            <ul className="mt-3 space-y-3">
              {habits.map((habit) => {
                const week = computeHabitWeek(appState.days, habit.id, habitUntil);
                return (
                  <li key={habit.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-share-onSurface">{habit.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5" aria-label={`${countHabitWeekDone(week)} of 7 days`}>
                      {week.map((d) => (
                        <span
                          key={d.iso}
                          title={d.iso}
                          className={`h-3 w-3 rounded-full ${
                            d.state === "done"
                              ? "bg-share-primary"
                              : d.state === "broke"
                                ? "bg-share-tertiary"
                                : "bg-share-hairline"
                          }`}
                        />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {user && <ChallengeReviewSection weekDates={weekDates} today={today} />}
      </div>
      <MobileTabBar activeTab={null} reviewActive onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
    </AppChrome>
  );
}
