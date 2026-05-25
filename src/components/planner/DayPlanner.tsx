/**
 * components/planner/DayPlanner.tsx
 *
 * Orchestrates the selected date, tasks, and layout for the main planner view.
 * This component ties together storage + domain logic + UI sections.
 */

import type React from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition, type SetStateAction } from "react";
import {
  DEFAULT_HABIT_DEFINITIONS,
  FIXED_SECTIONS,
  type AppState,
  type BlockDurations,
  type DayState,
  type HabitDefinition,
  type Task,
  type TaskSectionId,
} from "../../domain/types";
import {
  addDays,
  todayIso,
  toMonthId,
  sameWeekdayLastWeek,
  computeAccountabilityStats,
} from "../../domain/dateUtils";
import {
  BLOCK_MIN_MINUTES,
  BLOCK_ORDER,
  SLEEP_MIN_MINUTES,
  getSleepWindowLabel,
} from "../../domain/sectionTimeBlocks";
import { useTaskHandlers } from "../../hooks/useTaskHandlers";
import { useDayBlockEditor } from "../../hooks/useDayBlockEditor";
import { useTimeAwareness } from "../../hooks/useTimeAwareness";
import { PlannerModals } from "./PlannerModals";
import { NotDoingPanel } from "./NotDoingPanel";
import { BlockDurationEditor } from "./BlockDurationEditor";
import {
  usePersistentState,
  getOrCreateDay,
} from "../../storage/localStorageState";
import { computeDayCompletion, computePerHabitStreaks, getAtRiskHabitIds, computeDailyDeepWorkMinutes } from "../../domain/stats";
import { DayHeader } from "./DayHeader";
import { SectionColumn } from "./SectionColumn";
import { WeeklyOverview } from "./WeeklyOverview";
import { MonthlyTrackingDashboard } from "../tracking";
import { DeepWorkTimer } from "../timer/DeepWorkTimer";
import { MotivationCard } from "../timer/MotivationCard";
import { HabitChecklist } from "../habits/HabitChecklist";
import { NorthStarCard } from "../goals/NorthStarCard";
import { OneThingCard } from "../goals/OneThingCard";
import { WeeklyProjectCard } from "./WeeklyProjectCard";
import { TomorrowMustPanel } from "./TomorrowMustPanel";
import { MustDoPinnedHeader } from "./MustDoPinnedHeader";
import { MonthlyReviewBanner } from "../goals/MonthlyReviewBanner";
import { SideQuestSection } from "./SideQuestSection";
import { getDailyQuestSelection } from "../../domain/sideQuestAlgorithm";
import { MobileTabBar, type MobileTab } from "./MobileTabBar";
import { ActiveTripBanner } from "./ActiveTripBanner";
import { DaySummaryCard } from "./DaySummaryCard";
import { useActiveTripStatus } from "../../hooks/useActiveTripStatus";
import { ErrorBoundary } from "../ErrorBoundary";
import { useDayContext } from "../../hooks/useDayContext";
import { getOrderedTasksForSection } from "../../domain/taskUtils";

function formatDateLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return formatter.format(date);
}

/** Short label for a date (e.g. "28 Feb") for copy-from buttons. */
function formatDateShort(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map((part) => Number(part));
  const date = new Date(year!, month! - 1, day!);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Most recent date before beforeDate that has at least one task in state.
 * Used when yesterday and same-day-last-week have no tasks (e.g. first week or after a skip).
 */
function getLastDayWithTasks(state: AppState, beforeDate: string): string | null {
  let last: string | null = null;
  for (const date of Object.keys(state.days)) {
    if (date >= beforeDate) continue;
    const day = state.days[date];
    if (day?.tasks && day.tasks.length > 0) {
      if (last === null || date > last) last = date;
    }
  }
  return last;
}

interface DayPlannerProps {
  /**
   * 'view' = read-only shared planner (all actions disabled).
   * 'edit' = shared planner with task add/complete/delete via external updater.
   * Omit for normal owner mode.
   */
  shareMode?: 'view' | 'edit'
  /** External AppState to display instead of the owner's persisted state. */
  externalState?: AppState
  /** Called when any AppState update is requested in shared mode; parent handles persistence. */
  onExternalUpdate?: (updater: (prev: AppState) => AppState) => void
  /** When true with shareMode, hide internal weekly sidebar (parent shell provides layout). */
  shareShellLayout?: boolean
  /** Controlled selected day (e.g. shared shell keeps sidebar stats in sync). */
  selectedDay?: string
  onSelectedDayChange?: (day: string) => void
  /** Sticky offset for the day header under a fixed app bar (e.g. top-16). */
  stickyTopClass?: string
}

export function DayPlanner({
  shareMode,
  externalState,
  onExternalUpdate,
  shareShellLayout = false,
  selectedDay: selectedDayProp,
  onSelectedDayChange,
  stickyTopClass,
}: DayPlannerProps = {}) {
  const [ownState, updateOwnState] = usePersistentState();
  // Use external shared state when provided; fall back to owner's state.
  const appState = externalState ?? ownState;
  const updateAppState = (shareMode && onExternalUpdate) ? onExternalUpdate : updateOwnState;
  const [internalSelectedDay, setInternalSelectedDay] = useState<string>(todayIso);
  const isSelectedDayControlled = selectedDayProp !== undefined;
  const selectedDay = isSelectedDayControlled ? selectedDayProp : internalSelectedDay;
  const [, startDayTransition] = useTransition();

  const setSelectedDay = useCallback(
    (update: SetStateAction<string>) => {
      startDayTransition(() => {
        if (isSelectedDayControlled) {
          const next =
            typeof update === "function"
              ? (update as (prev: string) => string)(selectedDayProp!)
              : update;
          onSelectedDayChange?.(next);
        } else {
          setInternalSelectedDay((prev) =>
            typeof update === "function" ? (update as (p: string) => string)(prev) : update,
          );
        }
      });
    },
    [isSelectedDayControlled, selectedDayProp, onSelectedDayChange],
  );
  const [splitRatio, setSplitRatio] = useState(0.68); // fraction of width for task column
  const [mobileTab, setMobileTab] = useState<MobileTab>('plan');
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startRatio: number;
    width: number;
  } | null>(null);

  const MIN_SPLIT_RATIO = 0.5;
  const MAX_SPLIT_RATIO = 0.8;

  const timeOffsetMinutes = appState.timeOffsetMinutes ?? 0;

  const dayState = useMemo(
    () => getOrCreateDay(appState, selectedDay),
    [appState, selectedDay],
  );

  const dayCompletion = useMemo(
    () => computeDayCompletion(appState, selectedDay),
    [appState, selectedDay],
  );
  const dayCompletionRatio =
    dayCompletion.totalCount === 0
      ? 0
      : dayCompletion.completedCount / dayCompletion.totalCount;

  const deepWorkMinutesToday = useMemo(
    () => computeDailyDeepWorkMinutes(appState.days[selectedDay]),
    [appState, selectedDay],
  );

  // Active trip status - managed via child component to isolate Convex query errors
  const [travelingToday, setTravelingToday] = useState(false);

  const rootTasks = useMemo(
    () => (appState.days[selectedDay]?.tasks ?? []).filter((t) => !t.parentId),
    [appState, selectedDay],
  );
  const completedRootCount = useMemo(
    () => rootTasks.filter((t) => t.isDone).length,
    [rootTasks],
  );
  const totalRootCount = rootTasks.length;

  const accountabilityStats = useMemo(
    () => computeAccountabilityStats(appState.activeDays ?? [], appState.days),
    [appState.activeDays, appState.days],
  );

  // --- Extracted hooks ---
  const taskHandlers = useTaskHandlers(updateAppState, selectedDay, travelingToday);
  const {
    draggedTask,
    setSelectedTaskIds,
    selectedTaskIds,
    handleToggleSelect,
    handleDeleteSelected,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleAddTask,
    handleToggleTask,
    handleDeleteTask,
    handleAddTaskAbove,
    handleAddTaskBelow,
    handleAddSubtask,
    handleReorderTask,
    handleCopyFromDay,
    handleCarryForward,
    handleUpdateTask,
    handleUpdateMonthlyReview,
    handleToggleSideQuestCompletion,
    handleSaveSideQuestDefs,
    handleSessionComplete,
    handleMoveToNotDoing,
    handleAbandonTask,
    handleAddToNotDoing,
    handleRemoveFromNotDoing,
    handleAddDayNotDoing,
    handleRemoveDayNotDoing,
    handleAddTomorrowMust,
    handleDeleteTomorrowMust,
    handleEditTomorrowMust,
    handleUpdateTomorrowMust,
  } = taskHandlers;

  const blockEditor = useDayBlockEditor(
    dayState,
    appState.blockDurationRatios,
    selectedDay,
    updateAppState,
    shareMode,
  );
  const { effectiveBlockDurations, computedBlocks, setDaySetupOpen, handleBlockDurationChange } = blockEditor;

  const { taskIdsDueNow, activeSectionIds, isSleepTimeNow, timeframeLabelsBySection } =
    useTimeAwareness(appState, timeOffsetMinutes, computedBlocks);

  // --- Handlers that stay in DayPlanner (simple, few lines each) ---
  const habits = appState.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS;
  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);

  const habitStreaks = useMemo(
    () => computePerHabitStreaks(appState.days, habitIds, selectedDay),
    [appState.days, habitIds, selectedDay],
  );

  const atRiskHabitIds = useMemo(
    () => getAtRiskHabitIds(appState.days, habitIds, selectedDay),
    [appState.days, habitIds, selectedDay],
  );

  const dayCtx = useDayContext(selectedDay, {
    appState,
    habitIds,
  });

  const handleToggleHabit = useCallback(
    (habitId: string, value: boolean) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay);
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: {
              ...day,
              habitCompletions: { ...(day.habitCompletions ?? {}), [habitId]: value },
            },
          },
        };
      });
    },
    [updateAppState, selectedDay],
  );

  const handleSetIdentity = useCallback(
    (value: string) => {
      updateAppState((prev) => ({ ...prev, identityStatement: value }));
    },
    [updateAppState],
  );

  const handleSetNorthStar = useCallback(
    (value: string) => {
      updateAppState((prev) => ({ ...prev, northStar: value }));
    },
    [updateAppState],
  );

  const handleSetDayOneThing = useCallback(
    (date: string, value: string) => {
      updateAppState((prev) => ({
        ...prev,
        dayOneThings: { ...(prev.dayOneThings ?? {}), [date]: value },
      }));
    },
    [updateAppState],
  );

  const handleSetWeekOneThing = useCallback(
    (weekStart: string, value: string) => {
      updateAppState((prev) => ({
        ...prev,
        weekOneThings: { ...(prev.weekOneThings ?? {}), [weekStart]: value },
      }));
    },
    [updateAppState],
  );

  const handleSetMonthOneThing = useCallback(
    (monthKey: string, value: string) => {
      updateAppState((prev) => ({
        ...prev,
        monthOneThings: { ...(prev.monthOneThings ?? {}), [monthKey]: value },
      }));
    },
    [updateAppState],
  );

  const handleUpdateWeeklyProjects = useCallback(
    (projects: AppState['weeklyProjectRotation']) => {
      updateAppState((prev) => ({ ...prev, weeklyProjectRotation: projects }));
    },
    [updateAppState],
  );

  const handleUpdateHabitDefinitions = useCallback(
    (updatedHabits: HabitDefinition[]) => {
      updateAppState((prev) => ({ ...prev, habitDefinitions: updatedHabits }));
    },
    [updateAppState],
  );

  const handleTrackingUpdateDay = useCallback(
    (isoDate: string, updatedDay: DayState) => {
      updateAppState((prev) => {
        const existing = getOrCreateDay(prev, isoDate);
        return { ...prev, days: { ...prev.days, [isoDate]: { ...existing, ...updatedDay } } };
      });
    },
    [updateAppState],
  );

  const handleTrackingUpdateSettings = useCallback(
    (patch: {
      habitDefinitions?: HabitDefinition[];
      monthTitles?: Record<string, string>;
      depthPhilosophy?: AppState['depthPhilosophy'];
      deepWorkGoalHoursPerWeek?: number;
      goalCascade?: AppState['goalCascade'];
      monthlyReviews?: AppState['monthlyReviews'];
    }) => {
      updateAppState((prev) => ({
        ...prev,
        habitDefinitions: patch.habitDefinitions ?? prev.habitDefinitions,
        monthTitles: patch.monthTitles ?? prev.monthTitles,
        depthPhilosophy: patch.depthPhilosophy !== undefined ? patch.depthPhilosophy : prev.depthPhilosophy,
        deepWorkGoalHoursPerWeek: patch.deepWorkGoalHoursPerWeek !== undefined ? patch.deepWorkGoalHoursPerWeek : prev.deepWorkGoalHoursPerWeek,
        goalCascade: patch.goalCascade !== undefined ? patch.goalCascade : prev.goalCascade,
        monthlyReviews: patch.monthlyReviews !== undefined ? patch.monthlyReviews : prev.monthlyReviews,
      }));
    },
    [updateAppState],
  );

  const [editHabitsOpen, setEditHabitsOpen] = useState(false);
  const [editSideQuestOpen, setEditSideQuestOpen] = useState(false);

  const tomorrowDate = useMemo(() => addDays(selectedDay, 1), [selectedDay]);

  const tomorrowMustTasks = useMemo(() =>
    (appState.days[tomorrowDate]?.tasks ?? []).filter(
      (t) => t.sectionId === 'mustDo' && !t.parentId,
    ),
    [appState.days, tomorrowDate],
  );

  const todayQuestIds = useMemo(
    () => getDailyQuestSelection(appState.sideQuestDefs ?? [], appState.days, selectedDay),
    [appState.sideQuestDefs, appState.days, selectedDay],
  );

  const tasksBySection: Record<TaskSectionId, Task[]> = useMemo(() => {
    const grouped: Record<TaskSectionId, Task[]> = {
      mustDo: [],
      morningRoutine: [],
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      nightRoutine: [],
      sideQuest: [],
    };

    for (const task of dayState.tasks) {
      if (task) grouped[task.sectionId]?.push(task);
    }

    for (const key of Object.keys(grouped) as TaskSectionId[]) {
      grouped[key] = getOrderedTasksForSection(grouped[key] ?? []);
    }
    return grouped;
  }, [dayState.tasks]);

  const prevDay = addDays(selectedDay, -1);
  const lastWeekday = sameWeekdayLastWeek(selectedDay);
  const prevDayState = useMemo(
    () => getOrCreateDay(appState, prevDay),
    [appState, prevDay],
  );
  const lastWeekdayState = useMemo(
    () => getOrCreateDay(appState, lastWeekday),
    [appState, lastWeekday],
  );
  /** Fallback when yesterday and same-day-last-week have no tasks: last day that had tasks. */
  const lastDayWithTasks = useMemo(
    () => getLastDayWithTasks(appState, selectedDay),
    [appState, selectedDay],
  );
  const lastDayWithTasksState = useMemo(
    () =>
      lastDayWithTasks
        ? getOrCreateDay(appState, lastDayWithTasks)
        : { tasks: [] as Task[] },
    [appState, lastDayWithTasks],
  );
  const weekdayLabel = useMemo(() => {
    const [y, m, d] = selectedDay.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
      new Date(y!, m! - 1, d!),
    );
  }, [selectedDay]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleSplitterMouseMove);
      window.removeEventListener("mouseup", handleSplitterMouseUp);
    };
    // We intentionally omit handleSplitterMouseMove / handleSplitterMouseUp from deps
    // because they are stable function declarations and we only need this cleanup on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSplitterMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startRatio: splitRatio,
      width: rect.width,
    };
    window.addEventListener("mousemove", handleSplitterMouseMove);
    window.addEventListener("mouseup", handleSplitterMouseUp);
  }

  function handleSplitterMouseMove(event: MouseEvent) {
    const state = dragStateRef.current;
    if (!state || !gridRef.current) return;
    const deltaX = event.clientX - state.startX;
    const rawRatio = state.startRatio + deltaX / state.width;
    const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, rawRatio));
    setSplitRatio(clamped);
  }

  function handleSplitterMouseUp() {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", handleSplitterMouseMove);
    window.removeEventListener("mouseup", handleSplitterMouseUp);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div
        className={
          shareShellLayout
            ? "sticky top-[6.5rem] z-20 border-b border-share-outlineVariant/25 bg-share-bg/95 pb-3 backdrop-blur-sm"
            : `sticky z-20 border-b border-share-outlineVariant/30 bg-share-bg/95 pb-3 backdrop-blur-sm ${stickyTopClass ?? "top-0"}`
        }
        data-tour="date-nav"
      >
        <DayHeader
          dateLabel={formatDateLabel(selectedDay)}
          completionRatio={dayCompletionRatio}
          completedTaskCount={completedRootCount}
          totalTaskCount={totalRootCount}
          streak={accountabilityStats.streak}
          bestStreak={accountabilityStats.bestStreak}
          daysMissed={shareMode ? undefined : accountabilityStats.daysMissed}
          totalDays={shareMode ? undefined : accountabilityStats.totalDays}
          onPrevDay={() => setSelectedDay((current) => addDays(current, -1))}
          onNextDay={() => setSelectedDay((current) => addDays(current, 1))}
          onToday={() => setSelectedDay(todayIso())}
          deepWorkMinutesToday={shareMode ? undefined : deepWorkMinutesToday}
          depthPhilosophy={shareMode ? undefined : appState.depthPhilosophy}
        />
        {!shareMode && (
          <MustDoPinnedHeader
            tasks={tasksBySection['mustDo'] ?? []}
            onToggle={handleToggleTask}
            onAdd={(title) => handleAddTask('mustDo', title)}
            onDelete={handleDeleteTask}
            onUpdate={(id, patch) => handleUpdateTask(id, patch)}
          />
        )}
        {!shareMode && (
          <MonthlyReviewBanner
            selectedDay={selectedDay}
            review={appState.monthlyReviews?.[toMonthId(selectedDay)]}
            questions={appState.monthlyReviewQuestions ?? []}
            onUpdate={handleUpdateMonthlyReview}
          />
        )}
        {!shareMode && (() => {
          const goal = appState.goalCascade?.threeMonths ?? appState.goalCascade?.oneYear
          if (!goal) return null
          const label = appState.goalCascade?.threeMonths ? '3-month' : '1-year'
          return (
            <div className="mt-1 rounded border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onSurfaceVariant">
              <span className="text-slate-500">{label} goal: </span>
              <span className="text-slate-300">{goal}</span>
            </div>
          )
        })()}
        {/* Active trip context banner - isolated so a Convex query error only hides the banner */}
        {!shareMode && (
          <ErrorBoundary fallback={null}>
            <TripStatusBanner date={selectedDay} onTravelingChange={setTravelingToday} />
          </ErrorBoundary>
        )}
        {/* Copy/fill: owner only — don't expose other days' tasks to shared visitors */}
        {!shareMode && dayState.tasks.filter(t => t.sectionId !== 'mustDo').length === 0 && (() => {
          const copyOptions: { label: string; sourceDate: string; title?: string }[] = [];
          if (lastWeekdayState.tasks.length > 0) {
            copyOptions.push({ label: `Fill from last ${weekdayLabel}`, sourceDate: lastWeekday });
          }
          if (prevDayState.tasks.length > 0) {
            copyOptions.push({ label: 'Fill from yesterday', sourceDate: prevDay });
          }
          if (lastDayWithTasks != null && lastDayWithTasksState.tasks.length > 0 && lastDayWithTasks !== prevDay && lastDayWithTasks !== lastWeekday) {
            copyOptions.push({
              label: `Copy from ${formatDateShort(lastDayWithTasks)}`,
              sourceDate: lastDayWithTasks,
              title: `Copy tasks from ${formatDateLabel(lastDayWithTasks)} (last day with tasks)`,
            });
          }
          if (copyOptions.length === 0) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-tour="fill-day">
              {copyOptions.map(({ label, sourceDate, title }) => (
                <button
                  key={sourceDate}
                  type="button"
                  onClick={() => handleCopyFromDay(sourceDate)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-300 hover:border-sky-600 hover:text-sky-300"
                  title={title}
                >
                  {label}
                </button>
              ))}
            </div>
          );
        })()}
        {(() => {
          if (shareMode || dayState.tasks.length === 0) return null;
          const todayKeys = new Set(
            dayState.tasks
              .filter((t) => !t.parentId)
              .map((t) => `${t.sectionId}:${t.title.trim().toLowerCase()}`),
          );
          const incompletePrevTasks = prevDayState.tasks.filter(
            (t) => !t.parentId && !t.isDone && !todayKeys.has(`${t.sectionId}:${t.title.trim().toLowerCase()}`),
          );
          if (incompletePrevTasks.length === 0) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleCarryForward}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-300 hover:border-amber-500 hover:text-amber-300"
                title="Append incomplete tasks from yesterday to today's plan"
              >
                ↑ {incompletePrevTasks.length} incomplete from yesterday — carry forward
              </button>
            </div>
          );
        })()}
        {selectedTaskIds.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-600/60 bg-sky-500/10 px-2 py-1.5 text-xs">
            <span className="text-slate-300">
              {selectedTaskIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="rounded border border-red-600/60 bg-red-500/20 px-2 py-1 text-red-300 hover:bg-red-500/30"
            >
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedTaskIds(new Set())}
              className="rounded border border-slate-600 px-2 py-1 text-slate-400 hover:bg-slate-800"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div
        ref={shareShellLayout ? undefined : gridRef}
        className={
          shareShellLayout
            ? "mt-3 flex flex-col gap-3"
            : "mt-3 flex flex-col gap-3 lg:grid lg:gap-y-3 lg:gap-x-3 lg:items-start"
        }
        style={
          shareShellLayout
            ? undefined
            : {
                gridTemplateColumns: `minmax(0, ${splitRatio}fr) 4px minmax(0, ${
                  1 - splitRatio
                }fr)`,
              }
        }
      >
        <div className={`space-y-3${!shareShellLayout && mobileTab !== 'plan' ? ' hidden lg:block' : ''}`} data-tour="tasks-section">
          {!shareMode && (() => {
            const shallowMinutesUsed = (appState.days[selectedDay]?.tasks ?? [])
              .filter((t) => t.isShallow && t.isDone && t.durationMinutes)
              .reduce((sum, t) => sum + (t.durationMinutes ?? 0), 0)
            if (shallowMinutesUsed < 120) return null
            const h = Math.floor(shallowMinutesUsed / 60)
            const m = shallowMinutesUsed % 60
            const label = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
            return (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                Shallow time: {label} / 2h daily limit — protect your deep work blocks
              </div>
            )
          })()}
          {FIXED_SECTIONS.filter(s => s.id !== 'mustDo' && s.id !== 'sideQuest').map((section) => (
            <Fragment key={section.id}>
              {!shareMode && section.id === 'highPriority' && appState.depthPhilosophy === 'rhythmic' && (
                <div className="rounded border border-teal-700 bg-teal-900/30 px-3 py-1.5 text-xs text-teal-300">
                  Deep Block
                  {timeframeLabelsBySection['highPriority'] ? ` · ${timeframeLabelsBySection['highPriority']}` : ''}
                  {' '}· protect this time
                </div>
              )}
              {!shareMode && selectedDay === todayIso() && activeSectionIds.includes(section.id) && (
                <div className="flex items-center gap-2 rounded border border-teal-700/60 bg-teal-900/20 px-3 py-1.5 text-xs text-teal-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                  <span className="font-medium">
                    Active now{timeframeLabelsBySection[section.id] ? ` · ${timeframeLabelsBySection[section.id]}` : ''}
                  </span>
                </div>
              )}
            <SectionColumn
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id]}
              defaultCollapsed={
                section.id === 'morningRoutine' ||
                section.id === 'mediumPriority' ||
                section.id === 'lowPriority'
              }
              isTimeBlockActive={activeSectionIds.includes(section.id)}
              timeframeLabel={timeframeLabelsBySection[section.id]}
              draggedTask={shareMode ? null : draggedTask}
              onDragStart={shareMode ? () => undefined : handleDragStart}
              onDragEnd={shareMode ? () => undefined : handleDragEnd}
              onDrop={shareMode ? () => undefined : (insertIndex: number) => handleDrop(section.id, insertIndex)}
              selectedTaskIds={shareMode ? new Set<string>() : selectedTaskIds}
              onToggleSelect={shareMode ? () => undefined : handleToggleSelect}
              onAddTask={shareMode === 'view' ? () => undefined : (title) => handleAddTask(section.id, title)}
              onAddTaskAbove={shareMode === 'view' ? () => undefined : (beforeTaskId) =>
                handleAddTaskAbove(section.id, beforeTaskId)
              }
              onAddTaskBelow={shareMode === 'view' ? () => undefined : (afterTaskId) =>
                handleAddTaskBelow(section.id, afterTaskId)
              }
              onAddSubtask={shareMode === 'view' ? () => undefined : handleAddSubtask}
              onToggleTask={shareMode === 'view' ? () => undefined : (taskId) => handleToggleTask(taskId)}
              onDeleteTask={shareMode === 'view' ? () => undefined : (taskId) => handleDeleteTask(taskId)}
              onUpdateTask={shareMode === 'view' ? () => undefined : handleUpdateTask}
              taskIdsDueNow={taskIdsDueNow}
              onMoveTaskUp={shareMode === 'view' ? undefined : (taskId) => handleReorderTask(taskId, section.id, 'up')}
              onMoveTaskDown={shareMode === 'view' ? undefined : (taskId) => handleReorderTask(taskId, section.id, 'down')}
              onMoveToNotDoing={shareMode === 'view' ? undefined : handleMoveToNotDoing}
              onAbandonTask={shareMode === 'view' ? undefined : handleAbandonTask}
              overloadThreshold={
                section.id === 'mustDo' ? 3
                : section.id === 'highPriority' ? 5
                : undefined
              }
              headerAction={(() => {
                if (shareMode || !effectiveBlockDurations) return undefined;
                const sId = section.id as keyof BlockDurations;
                if (!(sId in effectiveBlockDurations)) return undefined;
                const idx = BLOCK_ORDER.indexOf(sId);
                const isLast = idx === BLOCK_ORDER.length - 1;
                const nextId = isLast ? null : BLOCK_ORDER[idx + 1];
                const nextSection = nextId ? FIXED_SECTIONS.find((s) => s.id === nextId) : null;
                const currentSleepMins = (() => {
                  const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
                  const [sh, sm] = (dayState.sleepTarget ?? "23:00").split(":").map(Number);
                  const wake = (wh ?? 0) * 60 + (wm ?? 0);
                  const sleep = (sh ?? 0) * 60 + (sm ?? 0);
                  return wake > sleep ? wake - sleep : wake + 1440 - sleep;
                })();
                return (
                  <BlockDurationEditor
                    currentDuration={effectiveBlockDurations[sId]}
                    minDuration={BLOCK_MIN_MINUTES[sId]}
                    adjacentLabel={isLast ? "Sleep" : (nextSection?.title ?? "Next block")}
                    adjacentDuration={isLast ? currentSleepMins : (nextId ? effectiveBlockDurations[nextId] : 0)}
                    adjacentMin={isLast ? SLEEP_MIN_MINUTES : (nextId ? BLOCK_MIN_MINUTES[nextId] : 0)}
                    affectsSleep={isLast}
                    sleepMinutes={currentSleepMins}
                    onConfirm={(newDur) => handleBlockDurationChange(sId, newDur)}
                  />
                );
              })()}
            />
            {!shareMode && section.id === 'lowPriority' && (() => {
              const sq = FIXED_SECTIONS.find(s => s.id === 'sideQuest')!
              return (
                <SideQuestSection
                  dayCompletionRatio={dayCompletionRatio}
                  section={sq}
                  tasks={tasksBySection['sideQuest'] ?? []}
                  defs={appState.sideQuestDefs ?? []}
                  selectedQuestIds={todayQuestIds}
                  completions={dayState.sideQuestCompletions ?? {}}
                  xp={appState.sideQuestXp ?? 0}
                  streak={appState.sideQuestStreak ?? 0}
                  onToggleCompletion={handleToggleSideQuestCompletion}
                  onManageDefs={() => setEditSideQuestOpen(true)}
                  draggedTask={draggedTask}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={(insertIndex) => handleDrop('sideQuest', insertIndex)}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelect={handleToggleSelect}
                  onAddTask={(title) => handleAddTask('sideQuest', title)}
                  onAddTaskAbove={(beforeTaskId) => handleAddTaskAbove('sideQuest', beforeTaskId)}
                  onAddTaskBelow={(afterTaskId) => handleAddTaskBelow('sideQuest', afterTaskId)}
                  onAddSubtask={handleAddSubtask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  taskIdsDueNow={taskIdsDueNow}
                  onMoveTaskUp={(taskId) => handleReorderTask(taskId, 'sideQuest', 'up')}
                  onMoveTaskDown={(taskId) => handleReorderTask(taskId, 'sideQuest', 'down')}
                  onMoveToNotDoing={handleMoveToNotDoing}
                  onAbandonTask={handleAbandonTask}
                />
              )
            })()}
            {!shareMode && section.id === 'nightRoutine' && (
              <TomorrowMustPanel
                tomorrowDate={tomorrowDate}
                tasks={tomorrowMustTasks}
                onAdd={handleAddTomorrowMust}
                onDelete={handleDeleteTomorrowMust}
                onEdit={handleEditTomorrowMust}
                onUpdate={handleUpdateTomorrowMust}
              />
            )}
            </Fragment>
          ))}
          {/* Sleep block: same style as sections, no tasks, highlights when current time is 11 PM - 5 AM */}
          <section
            className={`rounded-lg border p-3 sm:p-4 ${
              isSleepTimeNow
                ? 'border-amber-500/60 bg-amber-500/10'
                : 'border-share-outlineVariant/25 bg-share-surfaceContainerLow'
            }`}
            aria-label="Sleep block"
          >
            <header className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-share-onBg">
                  Sleep
                </h3>
                <p className="text-xs text-share-onSurfaceVariant">
                  Timeframe: {getSleepWindowLabel(timeOffsetMinutes, computedBlocks)}
                </p>
              </div>
              {!shareMode && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDaySetupOpen(true)}
                    className="rounded border border-share-outlineVariant/40 bg-share-surfaceContainer px-2 py-1 text-xs text-share-onSurface hover:border-share-primary/50 hover:text-share-primary"
                  >
                    Edit schedule
                  </button>
                  {effectiveBlockDurations && dayState.wakeTime && dayState.sleepTarget && (() => {
                    const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
                    const [sh, sm] = (dayState.sleepTarget ?? "23:00").split(":").map(Number);
                    const wake = (wh ?? 0) * 60 + (wm ?? 0);
                    const sleep = (sh ?? 0) * 60 + (sm ?? 0);
                    const sleepMins = wake > sleep ? wake - sleep : wake + 1440 - sleep;
                    return (
                      <BlockDurationEditor
                        currentDuration={sleepMins}
                        minDuration={SLEEP_MIN_MINUTES}
                        adjacentLabel="Night routine"
                        adjacentDuration={effectiveBlockDurations.nightRoutine}
                        adjacentMin={BLOCK_MIN_MINUTES.nightRoutine}
                        affectsSleep={false}
                        onConfirm={(newSleepMins) => {
                          const delta = newSleepMins - sleepMins;
                          // Adjusting sleep adjusts Night Routine in the opposite direction
                          handleBlockDurationChange('nightRoutine', effectiveBlockDurations.nightRoutine - delta);
                        }}
                      />
                    );
                  })()}
                </div>
              )}
            </header>
          </section>
        </div>

        {!shareShellLayout && (
          <>
            <div
              className="hidden h-full w-1 cursor-col-resize rounded-full bg-share-outlineVariant/30 hover:bg-share-primary lg:block"
              onMouseDown={handleSplitterMouseDown}
              aria-hidden="true"
            />

            <div className="hidden lg:block space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1" data-tour="sidebar">
              {/* Cross-section day snapshot */}
              {!shareMode && <DaySummaryCard ctx={dayCtx} />}
              {/* Deep work timer: most-used active tool — placed first for immediate reach */}
              {!shareMode && <DeepWorkTimer onSessionComplete={handleSessionComplete} />}
              {!shareMode && (
                <HabitChecklist
                  habits={habits}
                  completions={dayState.habitCompletions ?? {}}
                  streaks={habitStreaks}
                  atRiskHabitIds={atRiskHabitIds}
                  identityStatement={appState.identityStatement ?? ''}
                  onToggle={handleToggleHabit}
                  onSetIdentity={handleSetIdentity}
                  onEditHabits={() => setEditHabitsOpen(true)}
                  travelingToday={travelingToday}
                />
              )}
              {/* The ONE Thing: day/week/month focus — consulted daily */}
              {!shareMode && (
                <OneThingCard
                  selectedDay={selectedDay}
                  dayOneThings={appState.dayOneThings ?? {}}
                  weekOneThings={appState.weekOneThings ?? {}}
                  monthOneThings={appState.monthOneThings ?? {}}
                  onSetDay={handleSetDayOneThing}
                  onSetWeek={handleSetWeekOneThing}
                  onSetMonth={handleSetMonthOneThing}
                />
              )}
              {/* Weekly overview: glanceable passive stats */}
              <WeeklyOverview
                state={appState as AppState}
                referenceDay={selectedDay}
              />
              {/* North Star: long-term vision — reviewed occasionally */}
              {!shareMode && (
                <NorthStarCard
                  northStar={appState.northStar ?? ''}
                  onSetNorthStar={handleSetNorthStar}
                />
              )}
              {/* Weekly project rotation: side commitments pinned to specific days */}
              {!shareMode && (
                <WeeklyProjectCard
                  selectedDate={selectedDay}
                  projects={appState.weeklyProjectRotation ?? []}
                  onUpdate={handleUpdateWeeklyProjects}
                />
              )}
              {!shareMode && <MotivationCard />}
              {!shareMode && (
                <NotDoingPanel
                  globalList={appState.notDoingList ?? []}
                  dayList={dayState.notDoingItems ?? []}
                  selectedDay={selectedDay}
                  onAddGlobal={handleAddToNotDoing}
                  onRemoveGlobal={handleRemoveFromNotDoing}
                  onAddDay={handleAddDayNotDoing}
                  onRemoveDay={handleRemoveDayNotDoing}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile tab panels — rendered outside the grid so they don't affect desktop layout */}
      {!shareMode && !shareShellLayout && (
        <>
          {mobileTab === 'timer' && (
            <div className="mt-3 lg:hidden">
              <DeepWorkTimer onSessionComplete={handleSessionComplete} />
            </div>
          )}
          {mobileTab === 'habits' && (
            <div className="mt-3 lg:hidden">
              <HabitChecklist
                habits={habits}
                completions={dayState.habitCompletions ?? {}}
                streaks={habitStreaks}
                atRiskHabitIds={atRiskHabitIds}
                identityStatement={appState.identityStatement ?? ''}
                onToggle={handleToggleHabit}
                onSetIdentity={handleSetIdentity}
                travelingToday={travelingToday}
                onEditHabits={() => setEditHabitsOpen(true)}
              />
            </div>
          )}
          {mobileTab === 'stats' && (
            <div className="mt-3 lg:hidden">
              <WeeklyOverview state={appState as AppState} referenceDay={selectedDay} />
            </div>
          )}
          {/* Spacer so content doesn't hide behind the fixed tab bar */}
          <div className="h-16 lg:hidden" />
        </>
      )}

      {/* Monthly tracking: owner only (not shown on shared views) */}
      {!shareMode && (
        <div className="mt-6">
          <MonthlyTrackingDashboard
            state={appState}
            referenceDay={selectedDay}
            onUpdateDay={handleTrackingUpdateDay}
            onUpdateSettings={handleTrackingUpdateSettings}
          />
        </div>
      )}

      <PlannerModals
        selectedDay={selectedDay}
        dayState={dayState}
        prevDayState={prevDayState}
        blockEditor={blockEditor}
        habits={habits}
        sideQuestDefs={appState.sideQuestDefs ?? []}
        editHabitsOpen={editHabitsOpen}
        editSideQuestOpen={editSideQuestOpen}
        onCloseHabits={() => setEditHabitsOpen(false)}
        onCloseSideQuests={() => setEditSideQuestOpen(false)}
        onSaveHabits={handleUpdateHabitDefinitions}
        onSaveSideQuests={handleSaveSideQuestDefs}
      />

      {/* Mobile bottom tab bar — owner only, not shown in shared views */}
      {!shareMode && !shareShellLayout && (
        <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      )}
    </div>
  );
}

interface TripStatusBannerProps {
  date: string
  onTravelingChange: (traveling: boolean) => void
}

function TripStatusBanner({ date, onTravelingChange }: TripStatusBannerProps) {
  const status = useActiveTripStatus(date)
  useEffect(() => {
    onTravelingChange(status !== null)
  }, [status, onTravelingChange])
  if (!status) return null
  return <ActiveTripBanner trip={status} />
}
