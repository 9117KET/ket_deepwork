/**
 * components/planner/DayPlanner.tsx
 *
 * Orchestrates the selected date, tasks, and layout for the main planner view.
 * This component ties together storage + domain logic + UI sections.
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import {
  FIXED_SECTIONS,
  type AppState,
  type DayState,
  type HabitDefinition,
  type Task,
  type TaskSectionId,
} from "../../domain/types";
import {
  addDays,
  todayIso,
  sameWeekdayLastWeek,
  normalizeHhmm,
  computeAccountabilityStats,
  deriveActiveDaysFromDays,
} from "../../domain/dateUtils";
import {
  getActiveSectionIds,
  getSectionTimeframeLabel,
  getSleepWindowLabel,
  isSleepTime,
} from "../../domain/sectionTimeBlocks";
import {
  usePersistentState,
  getOrCreateDay,
} from "../../storage/localStorageState";
import { computeDayCompletion } from "../../domain/stats";
import { DayHeader } from "./DayHeader";
import { SectionColumn } from "./SectionColumn";
import { WeeklyOverview } from "./WeeklyOverview";
import { MonthlyTrackingDashboard } from "../tracking";
import { DeepWorkTimer } from "../timer/DeepWorkTimer";
import { MotivationCard } from "../timer/MotivationCard";

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

function createTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reorder array: move item at fromIndex to toIndex (0 = top). */
function reorderTasks<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return arr;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length) return arr;
  const copy = [...arr];
  const [removed] = copy.splice(fromIndex, 1);
  const insertIdx = Math.min(toIndex, copy.length);
  copy.splice(insertIdx, 0, removed);
  return copy;
}

/** Section tasks in display order: roots first (in array order), then each root's children (in array order). */
function getOrderedTasksForSection(tasks: Task[]): Task[] {
  const roots = tasks.filter((t) => !t.parentId);
  const ordered: Task[] = [];
  for (const r of roots) {
    ordered.push(r);
    ordered.push(...tasks.filter((t) => t.parentId === r.id));
  }
  return ordered;
}

/** Collect all descendant task ids (children, grandchildren, ...). */
function getDescendantIds(tasks: Task[], parentId: string): Set<string> {
  const set = new Set<string>();
  const collect = (pid: string) => {
    for (const t of tasks) {
      if (t.parentId === pid) {
        set.add(t.id);
        collect(t.id);
      }
    }
  };
  collect(parentId);
  return set;
}

/**
 * Clone tasks for another day: new IDs, same content; parentId remapped.
 * When resetTimes is true, scheduledAt and durationMinutes are cleared so the
 * new day can be scheduled from scratch (used for "Copy from yesterday" / "Fill from last [weekday]").
 */
function cloneTasksForDay(
  tasks: Task[],
  targetDate: string,
  options?: { resetTimes?: boolean },
): Task[] {
  const idMap = new Map<string, string>();
  const resetTimes = options?.resetTimes ?? false;
  const cloned = tasks.map((t) => {
    const newId = createTaskId();
    idMap.set(t.id, newId);
    const base = { ...t, id: newId, date: targetDate, isDone: false };
    if (resetTimes) {
      return { ...base, scheduledAt: undefined, durationMinutes: undefined };
    }
    return base;
  });
  return cloned.map((t) => ({
    ...t,
    parentId: t.parentId ? (idMap.get(t.parentId) ?? undefined) : undefined,
  }));
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

  const setSelectedDay = useCallback(
    (update: SetStateAction<string>) => {
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
    },
    [isSelectedDayControlled, selectedDayProp, onSelectedDayChange],
  );
  const [splitRatio, setSplitRatio] = useState(0.68); // fraction of width for task column
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

  const accountabilityStats = useMemo(
    () => computeAccountabilityStats(appState.activeDays ?? []),
    [appState.activeDays],
  );

  const handleAddTask = (sectionId: TaskSectionId, title: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const nextTasks: Task[] = [
        ...existingDay.tasks,
        {
          id: createTaskId(),
          title,
          sectionId,
          date: selectedDay,
          isDone: false,
        },
      ];

      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            tasks: nextTasks,
          },
        },
      };
    });
  };

  const handleToggleTask = (taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const task = existingDay.tasks.find((t) => t.id === taskId);
      const becomingDone = task ? !task.isDone : false;
      const descendantIds =
        becomingDone && task
          ? getDescendantIds(existingDay.tasks, taskId)
          : new Set<string>();
      const nextTasks = existingDay.tasks.map((t) => {
        if (t.id === taskId) return { ...t, isDone: !t.isDone };
        if (descendantIds.has(t.id)) return { ...t, isDone: true };
        return t;
      });
      const nextDays = {
        ...prev.days,
        [selectedDay]: { ...existingDay, tasks: nextTasks },
      };
      return {
        ...prev,
        days: nextDays,
        activeDays: deriveActiveDaysFromDays(nextDays),
      };
    });
  };

  const handleDeleteTask = (taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const descendantIds = getDescendantIds(existingDay.tasks, taskId);
      const toRemove = new Set([taskId, ...descendantIds]);
      const nextTasks = existingDay.tasks.filter((t) => !toRemove.has(t.id));
      const nextDays = {
        ...prev.days,
        [selectedDay]: { ...existingDay, tasks: nextTasks },
      };
      return {
        ...prev,
        days: nextDays,
        activeDays: deriveActiveDaysFromDays(nextDays),
      };
    });
  };

  const handleAddTaskBelow = (
    sectionId: TaskSectionId,
    afterTaskId: string,
  ) => {
    const title = window.prompt("Task title:", "New task") ?? "New task";
    if (title.trim() === "") return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const idx = existingDay.tasks.findIndex((t) => t.id === afterTaskId);
      const after = existingDay.tasks[idx];
      if (idx < 0 || !after) return prev;
      const newTask: Task = {
        id: createTaskId(),
        title: title.trim(),
        sectionId,
        date: selectedDay,
        isDone: false,
      };
      const nextTasks = [
        ...existingDay.tasks.slice(0, idx + 1),
        newTask,
        ...existingDay.tasks.slice(idx + 1),
      ];
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      };
    });
  };

  const handleAddSubtask = (parentTaskId: string) => {
    const title =
      window.prompt("Subtask title:", "New subtask") ?? "New subtask";
    if (title.trim() === "") return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const idx = existingDay.tasks.findIndex((t) => t.id === parentTaskId);
      const parent = existingDay.tasks[idx];
      if (idx < 0 || !parent) return prev;
      const newTask: Task = {
        id: createTaskId(),
        title: title.trim(),
        sectionId: parent.sectionId,
        date: parent.date,
        isDone: false,
        parentId: parentTaskId,
      };
      const nextTasks = [
        ...existingDay.tasks.slice(0, idx + 1),
        newTask,
        ...existingDay.tasks.slice(idx + 1),
      ];
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      };
    });
  };

  /** Move a task (and its subtasks) to another section at the given insert index. */
  const handleMoveTask = (
    _fromSectionId: TaskSectionId,
    taskId: string,
    toSectionId: TaskSectionId,
    insertIndex: number,
  ) => {
    updateAppState((prev) => {
      try {
        const existingDay = getOrCreateDay(prev, selectedDay);
        const task = existingDay.tasks.find((t) => t.id === taskId);
        if (!task) return prev;
        const descendantIds = getDescendantIds(existingDay.tasks, taskId);
        const toMoveIds = new Set([taskId, ...descendantIds]);
        const nextTasks = existingDay.tasks.filter((t) => !toMoveIds.has(t.id));
        const toMoveOrdered = getOrderedTasksForSection(
          existingDay.tasks.filter((t) => toMoveIds.has(t.id)),
        );
        const movedTasks = toMoveOrdered.map((t) => ({ ...t, sectionId: toSectionId }));
        const bySection: Record<TaskSectionId, Task[]> = {
          mustDo: [],
          morningRoutine: [],
          highPriority: [],
          mediumPriority: [],
          lowPriority: [],
          nightRoutine: [],
        };
        for (const t of nextTasks) {
          const list = bySection[t.sectionId];
          if (list) list.push(t);
        }
        const targetList = bySection[toSectionId] ?? [];
        const orderedTarget = getOrderedTasksForSection(targetList);
        const safeInsert = Math.max(0, Math.min(insertIndex, orderedTarget.length));
        const merged = [
          ...orderedTarget.slice(0, safeInsert),
          ...movedTasks,
          ...orderedTarget.slice(safeInsert),
        ];
        bySection[toSectionId] = merged;
        const flat = FIXED_SECTIONS.flatMap((s) => bySection[s.id] ?? []);
        if (flat.length !== existingDay.tasks.length) return prev;
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: { ...existingDay, tasks: flat },
          },
        };
      } catch {
        return prev;
      }
    });
  };

  const [draggedTask, setDraggedTask] = useState<{
    sectionId: TaskSectionId;
    taskId: string;
  } | null>(null);

  /** Ref holds current drag payload so handleDrop always has it (avoids stale closure in production when drop runs after state was cleared). */
  const draggedTaskRef = useRef<{
    sectionId: TaskSectionId;
    taskId: string;
  } | null>(null);

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedTaskIds.size === 0) return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const toRemove = new Set<string>(selectedTaskIds);
      for (const id of selectedTaskIds) {
        getDescendantIds(existingDay.tasks, id).forEach((desc) => toRemove.add(desc));
      }
      const nextTasks = existingDay.tasks.filter((t) => !toRemove.has(t.id));
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      };
    });
    setSelectedTaskIds(new Set());
  };

  const handleDragStart = (sectionId: TaskSectionId, taskId: string) => {
    draggedTaskRef.current = { sectionId, taskId };
    setDraggedTask({ sectionId, taskId });
  };

  const handleDragEnd = () => {
    draggedTaskRef.current = null;
    setDraggedTask(null);
  };

  const handleDrop = (targetSectionId: TaskSectionId, insertIndex: number) => {
    const payload = draggedTaskRef.current ?? draggedTask;
    try {
      if (!payload) return;
      const fromSectionId = payload.sectionId;
      const taskId = payload.taskId;
      if (fromSectionId === targetSectionId) {
        updateAppState((prev) => {
          try {
            const existingDay = getOrCreateDay(prev, selectedDay);
            const sectionTasks = getOrderedTasksForSection(
              existingDay.tasks.filter((t) => t.sectionId === fromSectionId),
            );
            const fromIndex = sectionTasks.findIndex((t) => t.id === taskId);
            if (fromIndex < 0) return prev;
            const safeInsert = Math.max(0, Math.min(insertIndex, sectionTasks.length));
            if (fromIndex === safeInsert) return prev;
            const reordered = reorderTasks(sectionTasks, fromIndex, safeInsert);
            if (reordered.length !== sectionTasks.length) return prev;
            let j = 0;
            const nextTasks = existingDay.tasks.map((t) =>
              t.sectionId === fromSectionId ? reordered[j++]! : t,
            );
            if (nextTasks.length !== existingDay.tasks.length) return prev;
            return {
              ...prev,
              days: {
                ...prev.days,
                [selectedDay]: { ...existingDay, tasks: nextTasks },
              },
            };
          } catch {
            return prev;
          }
        });
      } else {
        handleMoveTask(fromSectionId, taskId, targetSectionId, insertIndex);
      }
    } finally {
      draggedTaskRef.current = null;
      setDraggedTask(null);
    }
  };

  /** Copy tasks from a source day into the selected day (times reset). Used for fill/copy buttons. */
  const handleCopyFromDay = useCallback(
    (sourceDate: string) => {
      const sourceDayState = getOrCreateDay(appState, sourceDate);
      if (sourceDayState.tasks.length === 0) return;
      const newTasks = cloneTasksForDay(sourceDayState.tasks, selectedDay, {
        resetTimes: true,
      });
      updateAppState((prev) => {
        const existingDay = getOrCreateDay(prev, selectedDay);
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: { ...existingDay, tasks: newTasks },
          },
        };
      });
    },
    [appState, selectedDay, updateAppState],
  );

  const handleUpdateTask = (
    taskId: string,
    patch: {
      scheduledAt?: string;
      durationMinutes?: number;
      title?: string;
    },
  ) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const nextTasks = existingDay.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      );
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      };
    });
  };

  const tasksBySection: Record<TaskSectionId, Task[]> = useMemo(() => {
    const grouped: Record<TaskSectionId, Task[]> = {
      mustDo: [],
      morningRoutine: [],
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      nightRoutine: [],
    };

    for (const task of dayState.tasks) {
      grouped[task.sectionId]?.push(task);
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

  const MAX_TIME_OFFSET_MINUTES = 3 * 60;

  const handleAdjustTimeOffset = (deltaMinutes: number) => {
    updateAppState((prev) => {
      const current = prev.timeOffsetMinutes ?? 0;
      const next = Math.max(
        -MAX_TIME_OFFSET_MINUTES,
        Math.min(MAX_TIME_OFFSET_MINUTES, current + deltaMinutes),
      );
      if (next === current) return prev;
      return {
        ...prev,
        timeOffsetMinutes: next,
      };
    });
  };

  const handleResetTimeOffset = () => {
    updateAppState((prev) => {
      const current = prev.timeOffsetMinutes ?? 0;
      if (current === 0) return prev;
      return {
        ...prev,
        timeOffsetMinutes: 0,
      };
    });
  };

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
    (patch: { habitDefinitions?: HabitDefinition[]; monthTitles?: Record<string, string> }) => {
      updateAppState((prev) => ({
        ...prev,
        habitDefinitions: patch.habitDefinitions ?? prev.habitDefinitions,
        monthTitles: patch.monthTitles ?? prev.monthTitles,
      }));
    },
    [updateAppState],
  );

  // Streak counts are derived from completed tasks (not just opening the app).

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const taskIdsDueNow = useMemo(() => {
    void tick; // re-run when tick updates (every 15s) so due-now matches current time
    const today = todayIso();
    const day = getOrCreateDay(appState, today);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const set = new Set<string>();

    // 1) Highlight all tasks currently in their time window
    for (const task of day.tasks) {
      if (!task.scheduledAt || task.isDone) continue;
      const normalized = normalizeHhmm(task.scheduledAt);
      const [h, m] = normalized.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const durationMins = task.durationMinutes ?? 1;
      const endMinutes = startMinutes + durationMins;
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes)
        set.add(task.id);
    }

    // 2) If no task is in-window, highlight the next upcoming one so completing a task
    //    immediately shows the next (rewarding flow)
    if (set.size === 0) {
      let nextStart = Infinity;
      let nextId: string | null = null;
      for (const task of day.tasks) {
        if (!task.scheduledAt || task.isDone) continue;
        const normalized = normalizeHhmm(task.scheduledAt);
        const [h, m] = normalized.split(":").map(Number);
        const startMinutes = h * 60 + m;
        if (startMinutes >= currentMinutes && startMinutes < nextStart) {
          nextStart = startMinutes;
          nextId = task.id;
        }
      }
      if (nextId) set.add(nextId);
    }

    return set;
  }, [appState, tick]);

  /** Which section block is active right now (5–9 morning, 9–5 focus, etc.). Updates with tick. */
  const activeSectionIds = useMemo(() => {
    void tick;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return getActiveSectionIds(currentMinutes, timeOffsetMinutes);
  }, [tick, timeOffsetMinutes]);
  const isSleepTimeNow = useMemo(() => {
    void tick;
    const now = new Date();
    return isSleepTime(now.getHours() * 60 + now.getMinutes(), timeOffsetMinutes);
  }, [tick, timeOffsetMinutes]);

  const timeframeLabelsBySection: Record<TaskSectionId, string | null> = useMemo(() => {
    const labels: Record<TaskSectionId, string | null> = {
      mustDo: null,
      morningRoutine: null,
      highPriority: null,
      mediumPriority: null,
      lowPriority: null,
      nightRoutine: null,
    };
    for (const section of FIXED_SECTIONS) {
      labels[section.id] = getSectionTimeframeLabel(section.id, timeOffsetMinutes);
    }
    return labels;
  }, [timeOffsetMinutes]);

  const lastBeepedRef = useRef<
    Record<string, { start?: boolean; mid?: boolean; end?: boolean }>
  >({});

  const playBeep = useCallback(() => {
    try {
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void tick;
    const today = todayIso();
    const day = getOrCreateDay(appState, today);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const task of day.tasks) {
      if (!task.scheduledAt || task.isDone) continue;
      const normalized = normalizeHhmm(task.scheduledAt);
      const [h, m] = normalized.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const durationMins = task.durationMinutes ?? 1;
      const midMinutes = startMinutes + Math.floor(durationMins / 2);
      const endMinutes = startMinutes + durationMins;

      const key = `${task.id}-${today}`;
      const state = lastBeepedRef.current[key] ?? {};

      if (currentMinutes >= endMinutes && !state.end) {
        lastBeepedRef.current[key] = { ...state, end: true };
        playBeep();
        return;
      }
      if (currentMinutes >= midMinutes && !state.mid) {
        lastBeepedRef.current[key] = { ...state, mid: true };
        playBeep();
        return;
      }
      if (currentMinutes >= startMinutes && !state.start) {
        lastBeepedRef.current[key] = { ...state, start: true };
        playBeep();
        return;
      }
    }
  }, [appState, tick, playBeep]);

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
            : `sticky z-20 border-b border-slate-800 bg-slate-950/95 pb-3 backdrop-blur-sm ${stickyTopClass ?? "top-0"}`
        }
        data-tour="date-nav"
      >
        <DayHeader
          dateLabel={formatDateLabel(selectedDay)}
          completionRatio={dayCompletionRatio}
          completedPoints={dayCompletion.completedCount}
          totalPoints={dayCompletion.totalCount}
          streak={accountabilityStats.streak}
          bestStreak={accountabilityStats.bestStreak}
          daysMissed={shareMode ? undefined : accountabilityStats.daysMissed}
          totalDays={shareMode ? undefined : accountabilityStats.totalDays}
          onPrevDay={() => setSelectedDay((current) => addDays(current, -1))}
          onNextDay={() => setSelectedDay((current) => addDays(current, 1))}
          onToday={() => setSelectedDay(todayIso())}
        />
        {/* Copy/fill: owner only — don't expose other days' tasks to shared visitors */}
        {!shareMode && dayState.tasks.length === 0 && (() => {
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
        {/* Time offset controls: owner only */}
        {!shareMode && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">
              Daily timeframe offset.{" "}
              {timeOffsetMinutes === 0
                ? "Shift by ±30 minutes as needed."
                : `Shifted by ${timeOffsetMinutes} minutes from the default blocks.`}
            </span>
            <button
              type="button"
              onClick={() => handleAdjustTimeOffset(-30)}
              disabled={timeOffsetMinutes <= -MAX_TIME_OFFSET_MINUTES}
              className={`rounded border px-2 py-1 ${
                timeOffsetMinutes <= -MAX_TIME_OFFSET_MINUTES
                  ? "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-600 hover:text-sky-300"
              }`}
            >
              Earlier (-30m)
            </button>
            <button
              type="button"
              onClick={() => handleAdjustTimeOffset(30)}
              disabled={timeOffsetMinutes >= MAX_TIME_OFFSET_MINUTES}
              className={`rounded border px-2 py-1 ${
                timeOffsetMinutes >= MAX_TIME_OFFSET_MINUTES
                  ? "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-600 hover:text-sky-300"
              }`}
            >
              Later (+30m)
            </button>
            {timeOffsetMinutes !== 0 && (
              <button
                type="button"
                onClick={handleResetTimeOffset}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:border-sky-600 hover:text-sky-300"
              >
                Reset
              </button>
            )}
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
        <div className="space-y-3" data-tour="tasks-section">
          {FIXED_SECTIONS.map((section) => (
            <SectionColumn
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id]}
              isTimeBlockActive={activeSectionIds.includes(section.id)}
              timeframeLabel={timeframeLabelsBySection[section.id]}
              draggedTask={shareMode ? null : draggedTask}
              onDragStart={shareMode ? () => undefined : handleDragStart}
              onDragEnd={shareMode ? () => undefined : handleDragEnd}
              onDrop={shareMode ? () => undefined : (insertIndex: number) => handleDrop(section.id, insertIndex)}
              selectedTaskIds={shareMode ? new Set<string>() : selectedTaskIds}
              onToggleSelect={shareMode ? () => undefined : handleToggleSelect}
              onAddTask={shareMode === 'view' ? () => undefined : (title) => handleAddTask(section.id, title)}
              onAddTaskBelow={shareMode === 'view' ? () => undefined : (afterTaskId) =>
                handleAddTaskBelow(section.id, afterTaskId)
              }
              onAddSubtask={shareMode === 'view' ? () => undefined : handleAddSubtask}
              onToggleTask={shareMode === 'view' ? () => undefined : (taskId) => handleToggleTask(taskId)}
              onDeleteTask={shareMode === 'view' ? () => undefined : (taskId) => handleDeleteTask(taskId)}
              onUpdateTask={shareMode === 'view' ? () => undefined : handleUpdateTask}
              taskIdsDueNow={taskIdsDueNow}
            />
          ))}
          {/* Sleep block: same style as sections, no tasks, highlights when current time is 11 PM – 5 AM */}
          <section
            className={`rounded-lg border p-3 sm:p-4 ${
              isSleepTimeNow
                ? 'border-amber-500/60 bg-amber-500/10'
                : 'border-slate-800 bg-slate-900'
            }`}
            aria-label="Sleep block"
          >
            <header className="mb-2">
              <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                Sleep
              </h3>
              <p className="text-xs text-slate-400">
                Timeframe: {getSleepWindowLabel(timeOffsetMinutes)}
              </p>
            </header>
          </section>
        </div>

        {!shareShellLayout && (
          <>
            <div
              className="hidden h-full w-1 cursor-col-resize rounded-full bg-slate-800 hover:bg-sky-500 lg:block"
              onMouseDown={handleSplitterMouseDown}
              aria-hidden="true"
            />

            <div className="space-y-3 lg:sticky lg:top-20" data-tour="sidebar">
              <WeeklyOverview
                state={appState as AppState}
                referenceDay={selectedDay}
              />
              {/* Deep work timer and motivation card: owner only */}
              {!shareMode && <DeepWorkTimer />}
              {!shareMode && <MotivationCard />}
            </div>
          </>
        )}
      </div>

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
    </div>
  );
}
