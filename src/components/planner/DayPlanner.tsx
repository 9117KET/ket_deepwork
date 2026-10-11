/**
 * components/planner/DayPlanner.tsx
 *
 * Today: the calendar's day, the Top 3, and one task list — plus the focus
 * timer and habits beside it on a wide screen, or behind the tab bar on a
 * phone.
 *
 * Time belongs to the calendar. The planner no longer sizes blocks, derives a
 * bedtime or asks for a day setup; a task gets a time by being scheduled into
 * the calendar (with a reminder), and work done gets recorded by the timer and
 * copied to the "Deepblock log" calendar. What stays here is what a calendar
 * cannot do: a short list of what matters, and an honest record of the hours
 * that actually went into it.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_HABIT_DEFINITIONS,
  FIXED_SECTIONS,
  type AppState,
  type HabitDefinition,
  type Task,
  type TaskSectionId,
} from "../../domain/types";
import { addDays, todayIso, sameWeekdayLastWeek, computeAccountabilityStats } from "../../domain/dateUtils";
import {
  blockAmountOptions,
  computeTaskProgress,
  listManualEntries,
  minTrackableMinutes,
  type BlockAmountOption,
} from "../../domain/taskProgress";
import { describeWorkLoss, summarizeTaskWork, taskWithDescendantIds } from "../../domain/workSafety";
import { normalizeFocusBlockMinutes, suggestedBreakMinutes } from "../../domain/focusBlocks";
import { computePerHabitStreaks, getAtRiskHabitIds, computeDailyDeepWorkMinutes } from "../../domain/stats";
import { getOrderedTasksForSection } from "../../domain/taskUtils";
import { useUndoableActions } from "../../hooks/useUndoableActions";
import { useTaskHandlers } from "../../hooks/useTaskHandlers";
import { useCalendarDay } from "../../hooks/useCalendarDay";
import { useWorkLog } from "../../hooks/useWorkLog";
import { usePersistentState, getOrCreateDay } from "../../storage/localStorageState";
import { useAuth } from "../../contexts/AuthContext";
import { scheduleTaskInCalendar, unscheduleTaskFromCalendar } from "../../services/calendarSyncService";
import { playChime } from "../../audio/chimes";
import { UndoToast } from "./UndoToast";
import { TaskProgressSheet } from "./TaskProgressSheet";
import { CompletionClaimPrompt } from "./CompletionClaimPrompt";
import { DayHeader } from "./DayHeader";
import { SectionColumn } from "./SectionColumn";
import { MustDoPinnedHeader } from "./MustDoPinnedHeader";
import { CalendarTimeline } from "./CalendarTimeline";
import { ScheduleSheet, type ScheduleRequest } from "./ScheduleSheet";
import { AwayBlockClaim } from "./AwayBlockClaim";
import { SidebarCard } from "./SidebarCard";
import { MobileTabBar, type MobileTab } from "./MobileTabBar";
import { FocusBlockContext } from "./focusBlockContext";
import { DeepWorkTimer } from "../timer/DeepWorkTimer";
import { MobileFocusPanel } from "../timer/MobileFocusPanel";
import { FocusMode } from "../timer/FocusMode";
import { useDeepWorkTimer, type TimerTaskOption } from "../timer/useDeepWorkTimer";
import { HabitChecklist } from "../habits/HabitChecklist";
import { MobileHabitsPanel } from "../habits/MobileHabitsPanel";
import { HabitEditorModal } from "../habits/HabitEditorModal";
import { ErrorBoundary } from "../ErrorBoundary";

function formatDateLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
    new Date(year!, month! - 1, day!),
  );
}

/** Short label for a date (e.g. "28 Feb") for the copy-from button. */
function formatDateShort(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(year!, month! - 1, day!),
  );
}

/** Most recent date before `beforeDate` that has at least one task. */
function getLastDayWithTasks(state: AppState, beforeDate: string): string | null {
  let last: string | null = null;
  for (const date of Object.keys(state.days)) {
    if (date >= beforeDate) continue;
    if ((state.days[date]?.tasks.length ?? 0) > 0 && (last === null || date > last)) last = date;
  }
  return last;
}

/**
 * How many "how long did that take?" prompts one tick may raise.
 *
 * Ticking a parent completes its subtasks too, and each of those may be work
 * worth recording - but a queue of prompts is a nag, and a nag is answered by
 * reflex rather than by remembering. Three is the most that still reads as a
 * question. The sheet logs the rest whenever the user wants.
 */
const MAX_COMPLETION_CLAIMS = 3;

/** Where new tasks go. The other sections only appear for days that used them. */
const LIST_SECTION_ID: TaskSectionId = "highPriority";
const LEGACY_SECTION_IDS: TaskSectionId[] = ["morningRoutine", "mediumPriority", "lowPriority", "nightRoutine", "sideQuest"];

export function DayPlanner() {
  const [appState, baseUpdateAppState, isHydrating] = usePersistentState();
  /**
   * Every mutation goes through here. The undo gateway has to see all of them:
   * a change it cannot see is a change its snapshot could destroy.
   */
  const undoable = useUndoableActions(appState, baseUpdateAppState);
  const updateAppState = undoable.update;
  const { user } = useAuth();

  const [selectedDay, setSelectedDayRaw] = useState<string>(todayIso);
  const [, startDayTransition] = useTransition();
  const setSelectedDay = useCallback((next: string | ((prev: string) => string)) => {
    startDayTransition(() => setSelectedDayRaw(next));
  }, []);
  const isToday = selectedDay === todayIso();

  /**
   * Review is a separate route, so its copy of the tab bar hands the chosen tab
   * back through the URL. Without this, tapping Habits from Review landed on
   * the planner showing Today.
   */
  const [searchParams] = useSearchParams();
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => {
    const requested = searchParams.get("tab");
    return requested === "focus" || requested === "habits" ? requested : "today";
  });

  // A minute tick, so "Now" on the timeline moves without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const calendar = useCalendarDay(selectedDay);
  useWorkLog(appState, calendar.connected);

  const dayState = useMemo(() => getOrCreateDay(appState, selectedDay), [appState, selectedDay]);
  const deepWorkMinutesToday = useMemo(
    () => computeDailyDeepWorkMinutes(appState.days[selectedDay]),
    [appState, selectedDay],
  );
  const rootTasks = useMemo(() => dayState.tasks.filter((t) => !t.parentId), [dayState.tasks]);
  const accountabilityStats = useMemo(
    () => computeAccountabilityStats(appState.activeDays ?? [], appState.days),
    [appState.activeDays, appState.days],
  );

  const {
    draggedTask,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleAddTask,
    handleToggleTask: handleToggleTaskBase,
    handleDeleteTask,
    handleAddTaskAbove,
    handleAddTaskBelow,
    handleAddSubtask,
    handleReorderTask,
    handleCopyFromDay,
    handleUpdateTask,
    handleSessionComplete,
    handleRecordAwaySession,
    handleLogManualMinutes,
    handleUndoManualMinutes,
    handleReattributeSession,
    handleAbandonTask,
    handleReorderSubtask,
    handleMoveSubtask,
  } = useTaskHandlers(updateAppState, selectedDay);

  // ── Habits ────────────────────────────────────────────────────────────────
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
  const [editHabitsOpen, setEditHabitsOpen] = useState(false);

  const handleToggleHabit = useCallback(
    (habitId: string, value: boolean) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay);
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: { ...day, habitCompletions: { ...(day.habitCompletions ?? {}), [habitId]: value } },
          },
        };
      });
    },
    [updateAppState, selectedDay],
  );
  const handleSetIdentity = useCallback(
    (value: string) => updateAppState((prev) => ({ ...prev, identityStatement: value })),
    [updateAppState],
  );
  /** Removing a habit definition takes its history off every past day. */
  const handleSaveHabits = useCallback(
    (defs: HabitDefinition[]) => {
      undoable.run("Updated habits", () => updateAppState((prev) => ({ ...prev, habitDefinitions: defs })));
    },
    [undoable, updateAppState],
  );

  // ── Focus blocks ──────────────────────────────────────────────────────────
  /** The unit the whole planner counts in: one block, one run of the timer. */
  const blockMinutes = normalizeFocusBlockMinutes(appState.focusBlockMinutes);
  const breakMinutes = appState.focusBreakMinutes ?? suggestedBreakMinutes(blockMinutes);
  const [timerTaskId, setTimerTaskId] = useState<string | undefined>(undefined);
  const [progressSheetTaskId, setProgressSheetTaskId] = useState<string | null>(null);
  const [moveSubtaskId, setMoveSubtaskId] = useState<string | null>(null);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);
  /**
   * Just-completed tasks whose progress rows are short, queued for logging.
   *
   * A queue rather than one, because ticking a parent ticks its subtasks with
   * it, and a subtask with an estimate is work that happened just as much as
   * its parent is.
   */
  const [completionClaims, setCompletionClaims] = useState<
    { taskId: string; title: string; options: BlockAmountOption[] }[]
  >([]);
  const completionClaim = completionClaims[0] ?? null;
  /** A task whose last block just filled, offered for ticking off. */
  const [doneOffer, setDoneOffer] = useState<{ taskId: string; title: string } | null>(null);

  /** Unfinished tasks big enough to track, offered to the timer for attribution. */
  const timerTaskOptions = useMemo<TimerTaskOption[]>(() => {
    const floor = minTrackableMinutes(blockMinutes);
    return dayState.tasks
      .filter((t) => !t.isDone && (t.durationMinutes ?? 0) >= floor)
      .map((t) => ({ id: t.id, title: t.title }));
  }, [dayState.tasks, blockMinutes]);

  /**
   * Record the block, then — if it was the one that filled the task's row —
   * offer to tick the task off. Offered, not done: the estimate is what the
   * work was expected to cost, not a definition of finished.
   */
  const handleSessionCompleteWithOffer = useCallback(
    (label: string, durationMinutes: number, taskId?: string, startedAt?: string) => {
      handleSessionComplete(label, durationMinutes, taskId, startedAt);
      if (!taskId) return;
      const task = dayState.tasks.find((t) => t.id === taskId);
      if (!task || task.isDone) return;
      const before = computeTaskProgress(task, dayState.deepWorkSessions, blockMinutes);
      if (!before || before.isComplete) return;
      if (before.totalMinutes + durationMinutes < before.goalMinutes) return;
      setDoneOffer({ taskId, title: task.title });
    },
    [handleSessionComplete, dayState.tasks, dayState.deepWorkSessions, blockMinutes],
  );

  // One countdown for the whole planner; the rail and the Focus tab are two views of it.
  const timer = useDeepWorkTimer({
    onSessionComplete: handleSessionCompleteWithOffer,
    taskOptions: timerTaskOptions,
    selectedTaskId: timerTaskId,
    onSelectTask: setTimerTaskId,
    blockMinutes,
    dayIso: selectedDay,
    onAwayBlockConfirmed: handleRecordAwaySession,
  });

  const handleStartBlock = useCallback(
    (taskId: string, minutes: number) => {
      const task = dayState.tasks.find((t) => t.id === taskId);
      const result = timer.startBlock({ taskId, minutes, label: task?.title });
      if (result === "busy") {
        // Name the way out. "Reset it" was the one action that destroyed the
        // minutes already earned.
        setBlockNotice(
          timer.hasBankableWork
            ? `A block is already running. Stop it from the timer to keep its ${timer.elapsedMinutes}m first.`
            : "A block is already running. Stop it from the timer first.",
        );
      }
      return result;
    },
    [dayState.tasks, timer],
  );

  useEffect(() => {
    if (!blockNotice) return;
    const id = window.setTimeout(() => setBlockNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [blockNotice]);

  const handleSetBlockLength = useCallback(
    (minutes: number, breakLength: number) => {
      updateAppState((prev) => ({ ...prev, focusBlockMinutes: minutes, focusBreakMinutes: breakLength }));
    },
    [updateAppState],
  );

  const focusBlockValue = useMemo(
    () => ({
      blockMinutes,
      breakMinutes,
      activeBlock: timer.activeBlock,
      startBlock: ({ taskId, minutes }: { taskId: string; minutes: number; label: string }) =>
        handleStartBlock(taskId, minutes),
    }),
    [blockMinutes, breakMinutes, timer.activeBlock, handleStartBlock],
  );

  /**
   * Desktop Focus: a running block covers the day. Dismissing is remembered
   * for as long as that block lasts; the next block starts clean.
   */
  const [focusDismissed, setFocusDismissed] = useState(false);
  const timerRunning = timer.status === "running" || timer.status === "paused";
  const [wasRunning, setWasRunning] = useState(timerRunning);
  if (wasRunning !== timerRunning) {
    setWasRunning(timerRunning);
    if (!timerRunning) setFocusDismissed(false);
  }

  const focusTaskProgress = useMemo(() => {
    const task = dayState.tasks.find((t) => t.id === timer.selectedTask?.id);
    return task ? computeTaskProgress(task, dayState.deepWorkSessions ?? [], blockMinutes) : null;
  }, [timer.selectedTask, dayState.tasks, dayState.deepWorkSessions, blockMinutes]);

  /** Blocks already banked today, so the running one can be numbered. */
  const completedBlocksToday = (dayState.deepWorkSessions ?? []).filter((s) => !s.cancelledAt).length;

  // ── Ticking, deleting, copying ────────────────────────────────────────────
  /**
   * Completing a task is the last moment anyone remembers how long it took, so
   * it is the moment to ask. Asked, never assumed: filling the row on
   * completion would make it a record of the plan rather than the work.
   */
  const handleToggleTask = useCallback(
    (taskId: string) => {
      const task = dayState.tasks.find((t) => t.id === taskId);
      handleToggleTaskBase(taskId);
      setDoneOffer((current) => (current?.taskId === taskId ? null : current));
      // Un-ticking is silent: taking a tick back is a correction, not an achievement.
      if (!task || task.isDone) return;

      const progress = computeTaskProgress(task, dayState.deepWorkSessions, blockMinutes);
      const musts = dayState.tasks.filter((t) => t.sectionId === "mustDo" && !t.parentId);
      const clearedTopThree =
        task.sectionId === "mustDo" && musts.length > 0 && musts.every((t) => t.id === taskId || t.isDone);
      playChime(clearedTopThree ? "dayComplete" : progress?.isComplete ? "taskComplete" : "taskTicked");

      // Everything this tick completed: the task, plus the subtasks it carried.
      const completed = [
        task,
        ...taskWithDescendantIds(dayState.tasks, taskId)
          .filter((id) => id !== taskId)
          .map((id) => dayState.tasks.find((t) => t.id === id))
          .filter((t): t is Task => Boolean(t) && !t!.isDone),
      ];
      const claims = completed
        .map((candidate) => {
          const candidateProgress = computeTaskProgress(candidate, dayState.deepWorkSessions, blockMinutes);
          if (!candidateProgress) return null;
          const options = blockAmountOptions(candidateProgress);
          return options.length === 0 ? null : { taskId: candidate.id, title: candidate.title, options };
        })
        .filter((claim): claim is NonNullable<typeof claim> => claim != null)
        .slice(0, MAX_COMPLETION_CLAIMS);
      if (claims.length > 0) setCompletionClaims(claims);
    },
    [dayState.tasks, dayState.deepWorkSessions, blockMinutes, handleToggleTaskBase],
  );

  // Offers write against whichever day is open, so leaving the day takes them with it.
  const [offersDay, setOffersDay] = useState(selectedDay);
  if (offersDay !== selectedDay) {
    setOffersDay(selectedDay);
    setCompletionClaims([]);
    setDoneOffer(null);
  }

  // An unanswered offer is an answer of "no".
  useEffect(() => {
    if (!doneOffer) return;
    const id = window.setTimeout(() => setDoneOffer(null), 12000);
    return () => window.clearTimeout(id);
  }, [doneOffer]);

  /**
   * Delete a task, stopping first if it would destroy work that cannot be
   * recovered. Timed sessions survive a deletion on their own (detached, not
   * dropped); hand-logged minutes on the task itself are what this asks about.
   */
  const handleDeleteTaskGuarded = useCallback(
    (taskId: string) => {
      const ids = taskWithDescendantIds(dayState.tasks, taskId);
      const summary = summarizeTaskWork(dayState, ids);
      if (summary.hasIrrecoverableWork) {
        const detail = describeWorkLoss(summary, ids.length);
        if (!window.confirm(`${detail}\n\nDelete anyway?`)) return;
      }
      const title = dayState.tasks.find((t) => t.id === taskId)?.title ?? "task";
      undoable.run(`Deleted “${title}”`, () => handleDeleteTask(taskId));
    },
    [dayState, handleDeleteTask, undoable],
  );

  // Offered while the list below the Top 3 is still empty: the three are
  // usually set first thing, and carrying yesterday's list over comes after.
  const copySource = useMemo(() => {
    if (dayState.tasks.some((t) => t.sectionId !== "mustDo")) return null;
    const yesterday = addDays(selectedDay, -1);
    if ((appState.days[yesterday]?.tasks.length ?? 0) > 0) return { date: yesterday, label: "Fill from yesterday" };
    const lastWeekday = sameWeekdayLastWeek(selectedDay);
    if ((appState.days[lastWeekday]?.tasks.length ?? 0) > 0) return { date: lastWeekday, label: "Fill from last week" };
    const last = getLastDayWithTasks(appState, selectedDay);
    return last ? { date: last, label: `Copy from ${formatDateShort(last)}` } : null;
  }, [appState, dayState.tasks, selectedDay]);

  // ── Scheduling into the calendar ──────────────────────────────────────────
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
  const scheduleTask = useMemo(
    () => dayState.tasks.find((t) => t.id === scheduleTaskId) ?? null,
    [dayState.tasks, scheduleTaskId],
  );

  const handleSchedule = useCallback(
    async (task: Task, req: ScheduleRequest) => {
      if (calendar.connected) {
        const slot = await scheduleTaskInCalendar({
          taskId: task.id,
          taskDate: selectedDay,
          title: task.title,
          durationMinutes: req.durationMinutes,
          startTime: req.startTime,
        });
        handleUpdateTask(task.id, { scheduledAt: slot.startTime, durationMinutes: req.durationMinutes });
        calendar.refresh();
        return;
      }
      if (!req.startTime) throw new Error("Pick a time first.");
      handleUpdateTask(task.id, { scheduledAt: req.startTime, durationMinutes: req.durationMinutes });
    },
    [calendar, selectedDay, handleUpdateTask],
  );

  const handleUnschedule = useCallback(
    async (task: Task) => {
      if (calendar.connected) {
        await unscheduleTaskFromCalendar({ taskId: task.id, taskDate: selectedDay });
        calendar.refresh();
      }
      handleUpdateTask(task.id, { scheduledAt: undefined });
    },
    [calendar, selectedDay, handleUpdateTask],
  );

  // ── Progress sheet ────────────────────────────────────────────────────────
  const progressSheetTask = useMemo(
    () => dayState.tasks.find((t) => t.id === progressSheetTaskId) ?? null,
    [dayState.tasks, progressSheetTaskId],
  );
  const progressSheetProgress = useMemo(
    () => (progressSheetTask ? computeTaskProgress(progressSheetTask, dayState.deepWorkSessions, blockMinutes) : null),
    [progressSheetTask, dayState.deepWorkSessions, blockMinutes],
  );
  const attributionTargets = useMemo(() => {
    const floor = minTrackableMinutes(blockMinutes);
    return dayState.tasks
      .filter((t) => (t.durationMinutes ?? 0) >= floor)
      .map((t) => ({ id: t.id, title: t.title, isDone: t.isDone }));
  }, [dayState.tasks, blockMinutes]);

  // ── Lists ─────────────────────────────────────────────────────────────────
  const tasksBySection = useMemo(() => {
    const grouped = {} as Record<TaskSectionId, Task[]>;
    for (const section of FIXED_SECTIONS) grouped[section.id] = [];
    for (const task of dayState.tasks) grouped[task.sectionId]?.push(task);
    for (const key of Object.keys(grouped) as TaskSectionId[]) {
      grouped[key] = getOrderedTasksForSection(grouped[key] ?? []);
    }
    return grouped;
  }, [dayState.tasks]);

  const listSection = useMemo(
    () => ({ ...FIXED_SECTIONS.find((s) => s.id === LIST_SECTION_ID)!, title: "Tasks" }),
    [],
  );
  // Days planned before the minimal rewrite keep their sections, so nothing
  // recorded on them goes out of sight. New days only ever use the one list.
  const legacySections = FIXED_SECTIONS.filter(
    (s) => LEGACY_SECTION_IDS.includes(s.id) && (tasksBySection[s.id]?.length ?? 0) > 0,
  );

  const renderSection = (section: (typeof FIXED_SECTIONS)[number], extra?: { overloadThreshold?: number; addPlaceholder?: string }) => (
    <SectionColumn
      key={section.id}
      section={section}
      tasks={tasksBySection[section.id] ?? []}
      draggedTask={draggedTask}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={(insertIndex: number) => handleDrop(section.id, insertIndex)}
      onAddTask={(title) => handleAddTask(section.id, title)}
      onAddTaskAbove={(beforeTaskId) => handleAddTaskAbove(section.id, beforeTaskId)}
      onAddTaskBelow={(afterTaskId) => handleAddTaskBelow(section.id, afterTaskId)}
      onAddSubtask={handleAddSubtask}
      onToggleTask={handleToggleTask}
      onDeleteTask={handleDeleteTaskGuarded}
      onUpdateTask={handleUpdateTask}
      deepWorkSessions={dayState.deepWorkSessions}
      onStartBlock={handleStartBlock}
      onOpenProgressSheet={setProgressSheetTaskId}
      onScheduleTask={setScheduleTaskId}
      onMoveTaskUp={(taskId) => handleReorderTask(taskId, section.id, "up")}
      onMoveTaskDown={(taskId) => handleReorderTask(taskId, section.id, "down")}
      onAbandonTask={handleAbandonTask}
      onReorderSubtask={handleReorderSubtask}
      onRequestMoveSubtask={setMoveSubtaskId}
      {...extra}
    />
  );

  if (isHydrating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-share-primary border-t-transparent" />
          <p className="text-sm text-share-onSurfaceVariant">Syncing your data…</p>
        </div>
      </div>
    );
  }

  return (
    <FocusBlockContext.Provider value={focusBlockValue}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* ── The day ─────────────────────────────────────────────────── */}
        <div className={`space-y-3 ${mobileTab !== "today" ? "hidden lg:block" : ""}`}>
          {/* A block that ran out while the app was closed, waiting to be claimed. */}
          {timer.pendingAwayBlock && (
            <AwayBlockClaim
              block={timer.pendingAwayBlock}
              taskTitle={
                appState.days[timer.pendingAwayBlock.dayIso]?.tasks.find(
                  (t) => t.id === timer.pendingAwayBlock?.taskId,
                )?.title
              }
              onConfirm={timer.confirmAwayBlock}
              onDiscard={timer.discardAwayBlock}
            />
          )}

          <div data-tour="date-nav">
            <DayHeader
              dateLabel={formatDateLabel(selectedDay)}
              completedTaskCount={rootTasks.filter((t) => t.isDone).length}
              totalTaskCount={rootTasks.length}
              streak={accountabilityStats.streak}
              isToday={isToday}
              onPrevDay={() => setSelectedDay((current) => addDays(current, -1))}
              onNextDay={() => setSelectedDay((current) => addDays(current, 1))}
              onToday={() => setSelectedDay(todayIso())}
              deepWorkMinutesToday={deepWorkMinutesToday}
            />
          </div>

          <ErrorBoundary fallback={null} resetKeys={[selectedDay]}>
            <CalendarTimeline status={calendar.status} events={calendar.events} isToday={isToday} now={now} />
          </ErrorBoundary>

          <ErrorBoundary
            resetKeys={[selectedDay]}
            fallback={(reset) => (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                <p className="font-medium">This list hit a snag.</p>
                <p className="mt-1 text-amber-200/80">Your tasks are saved. Reload it to continue.</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-3 rounded border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
                >
                  Reload tasks
                </button>
              </div>
            )}
          >
            <MustDoPinnedHeader
              tasks={tasksBySection.mustDo ?? []}
              onToggle={handleToggleTask}
              onAdd={(title) => handleAddTask("mustDo", title)}
              onDelete={handleDeleteTaskGuarded}
              onUpdate={(id, patch) => handleUpdateTask(id, patch)}
              deepWorkSessions={dayState.deepWorkSessions}
              onStartBlock={handleStartBlock}
              onOpenProgressSheet={setProgressSheetTaskId}
              onSchedule={setScheduleTaskId}
              onDragStart={(taskId) => handleDragStart("mustDo", taskId)}
              onDragEnd={handleDragEnd}
              onDropAt={(insertIndex) => handleDrop("mustDo", insertIndex)}
              onMoveUp={(taskId) => handleReorderTask(taskId, "mustDo", "up")}
              onMoveDown={(taskId) => handleReorderTask(taskId, "mustDo", "down")}
              draggedTaskId={draggedTask?.sectionId === "mustDo" ? draggedTask.taskId : null}
            />

            {copySource && (
              <button
                type="button"
                onClick={() =>
                  undoable.run(`Copied ${copySource.label.toLowerCase()}`, () => handleCopyFromDay(copySource.date))
                }
                className="touch-target-coarse rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-xs text-share-onSurface hover:border-share-primary/60 hover:text-share-primary"
              >
                {copySource.label}
              </button>
            )}

            {renderSection(listSection, { overloadThreshold: 7, addPlaceholder: "Add a task" })}
            {legacySections.map((section) => renderSection(section))}
          </ErrorBoundary>
        </div>

        {/* ── Rail (desktop): what you reach for while working ───────────── */}
        <aside className="hidden space-y-3 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <SidebarCard cardId="deepWorkTimer" title="Deep work timer">
            <DeepWorkTimer timer={timer} breakMinutes={breakMinutes} onSetBlockLength={handleSetBlockLength} />
          </SidebarCard>
          <SidebarCard cardId="habits" title="Habits">
            <HabitChecklist
              habits={habits}
              completions={dayState.habitCompletions ?? {}}
              streaks={habitStreaks}
              atRiskHabitIds={atRiskHabitIds}
              identityStatement={appState.identityStatement ?? ""}
              onToggle={handleToggleHabit}
              onSetIdentity={handleSetIdentity}
              onEditHabits={() => setEditHabitsOpen(true)}
            />
          </SidebarCard>
        </aside>
      </div>

      {/* ── Phone destinations ────────────────────────────────────────── */}
      {mobileTab === "focus" && (
        <MobileFocusPanel
          timer={timer}
          breakMinutes={breakMinutes}
          onSetBlockLength={handleSetBlockLength}
          completedBlocksToday={completedBlocksToday}
        />
      )}
      {mobileTab === "habits" && (
        <MobileHabitsPanel
          habits={habits}
          days={appState.days}
          selectedDay={selectedDay}
          completions={dayState.habitCompletions ?? {}}
          streaks={habitStreaks}
          atRiskHabitIds={atRiskHabitIds}
          identityStatement={appState.identityStatement ?? ""}
          onToggle={handleToggleHabit}
          onSetIdentity={handleSetIdentity}
          onEditHabits={() => setEditHabitsOpen(true)}
        />
      )}
      {/* Spacer so content doesn't hide behind the fixed MobileTabBar */}
      <div className="h-16 pb-safe lg:hidden" />

      {/* ── Transient prompts ─────────────────────────────────────────── */}
      {blockNotice && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-sm rounded-lg border border-amber-500/40 bg-share-surfaceContainerHigh px-3 py-2 text-center text-xs text-amber-200 shadow-lg lg:bottom-6"
        >
          {blockNotice}
        </div>
      )}
      {doneOffer && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-sm rounded-lg border border-emerald-500/40 bg-share-surfaceContainerHigh px-3 py-2.5 shadow-lg lg:bottom-6"
        >
          <p className="text-xs text-share-onSurface">
            <span className="font-medium">{doneOffer.title}</span> has all its blocks in. Mark it done?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const id = doneOffer.taskId;
                setDoneOffer(null);
                handleToggleTask(id);
              }}
              className="min-h-[32px] flex-1 rounded-md border border-emerald-500/50 bg-share-surfaceContainer px-2 py-1 text-xs text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10"
            >
              Mark done
            </button>
            <button
              type="button"
              onClick={() => setDoneOffer(null)}
              className="min-h-[32px] rounded-md px-2 py-1 text-xs text-share-onSurfaceVariant hover:text-share-onSurface"
            >
              Not yet
            </button>
          </div>
        </div>
      )}
      {completionClaim && (
        <CompletionClaimPrompt
          key={completionClaim.taskId}
          title={completionClaim.title}
          queuedAfter={completionClaims.length - 1}
          options={completionClaim.options}
          onLog={(minutes) => {
            handleLogManualMinutes(completionClaim.taskId, minutes);
            setCompletionClaims((queue) => queue.slice(1));
          }}
          onDismiss={() => setCompletionClaims((queue) => queue.slice(1))}
        />
      )}

      {/* ── Overlays ──────────────────────────────────────────────────── */}
      {timerRunning && !focusDismissed && (
        <FocusMode
          timer={timer}
          progress={focusTaskProgress}
          completedBlocksToday={completedBlocksToday}
          deepMinutesToday={deepWorkMinutesToday}
          onLeave={() => setFocusDismissed(true)}
        />
      )}

      {scheduleTask && (
        <ScheduleSheet
          task={scheduleTask}
          defaultMinutes={blockMinutes}
          connected={calendar.connected}
          canConnect={Boolean(user)}
          onSchedule={(req) => handleSchedule(scheduleTask, req)}
          onUnschedule={() => handleUnschedule(scheduleTask)}
          onSaveLength={(minutes) => handleUpdateTask(scheduleTask.id, { durationMinutes: minutes })}
          onClose={() => setScheduleTaskId(null)}
        />
      )}

      {moveSubtaskId &&
        (() => {
          const subtask = dayState.tasks.find((t) => t.id === moveSubtaskId);
          if (!subtask) return null;
          const parents = dayState.tasks.filter(
            (t) => !t.parentId && t.id !== moveSubtaskId && t.id !== subtask.parentId,
          );
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
              onClick={() => setMoveSubtaskId(null)}
            >
              <div
                className="w-full max-w-sm rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-3 text-sm font-semibold text-share-onBg">Move subtask to...</h3>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {parents.map((parent) => (
                    <button
                      key={parent.id}
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
                      onClick={() => {
                        handleMoveSubtask(moveSubtaskId, parent.id);
                        setMoveSubtaskId(null);
                      }}
                    >
                      {parent.title}
                    </button>
                  ))}
                  {parents.length === 0 && (
                    <p className="px-3 py-2 text-sm text-share-onSurfaceVariant/60">No other tasks to move to.</p>
                  )}
                </div>
                <div className="mt-3 border-t border-share-outlineVariant/30 pt-3">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-share-onSurfaceVariant hover:bg-share-surfaceContainerHighest"
                    onClick={() => {
                      handleMoveSubtask(moveSubtaskId, null);
                      setMoveSubtaskId(null);
                    }}
                  >
                    Make it a top-level task
                  </button>
                  <button
                    type="button"
                    className="mt-1 w-full rounded px-3 py-1.5 text-center text-xs text-share-onSurfaceVariant/70 hover:bg-share-surfaceContainerHighest"
                    onClick={() => setMoveSubtaskId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {progressSheetTask && progressSheetProgress && (
        <TaskProgressSheet
          taskId={progressSheetTask.id}
          taskTitle={progressSheetTask.title}
          dayIso={selectedDay}
          progress={progressSheetProgress}
          manualEntries={listManualEntries(
            progressSheetTask.id,
            dayState.deepWorkSessions,
            progressSheetTask.manualLoggedMinutes,
          )}
          attributedSessions={dayState.deepWorkSessions.filter(
            (session) => session.taskId === progressSheetTask.id && !session.cancelledAt,
          )}
          attributionTargets={attributionTargets}
          onReattribute={handleReattributeSession}
          onLogManual={(minutes, interval) => handleLogManualMinutes(progressSheetTask.id, minutes, interval)}
          onUndoManual={(minutes) => handleUndoManualMinutes(progressSheetTask.id, minutes)}
          onStartBlock={(minutes) => handleStartBlock(progressSheetTask.id, minutes)}
          onClose={() => setProgressSheetTaskId(null)}
        />
      )}

      {editHabitsOpen && (
        <HabitEditorModal habits={habits} onSave={handleSaveHabits} onClose={() => setEditHabitsOpen(false)} />
      )}

      <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      <UndoToast entry={undoable.entry} onUndo={undoable.undo} onDismiss={undoable.dismiss} />
    </FocusBlockContext.Provider>
  );
}
