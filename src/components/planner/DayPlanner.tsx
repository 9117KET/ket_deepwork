/**
 * components/planner/DayPlanner.tsx
 *
 * Orchestrates the selected date, tasks, and layout for the main planner view.
 * This component ties together storage + domain logic + UI sections.
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type SetStateAction } from "react";
import {
  FIXED_SECTIONS,
  type AbandonedTask,
  type AppState,
  type BlockDurations,
  type DayState,
  type HabitDefinition,
  type NotDoingItem,
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
  BLOCK_MIN_MINUTES,
  BLOCK_ORDER,
  SLEEP_MIN_MINUTES,
  applyBlockDurationChange,
  blockDurationsToRatios,
  computeAwakeMinutes,
  computeBlocksFromDurations,
  getActiveSectionIds,
  getDefaultBlockDurations,
  getSectionTimeframeLabel,
  getSleepWindowLabel,
  isSleepTime,
  ratiosToBlockDurations,
} from "../../domain/sectionTimeBlocks";
import { DaySetupModal } from "./DaySetupModal";
import { NotDoingPanel } from "./NotDoingPanel";
import { BlockDurationEditor } from "./BlockDurationEditor";
import { BlockDurationScopeModal } from "./BlockDurationScopeModal";
import { TaskConflictModal } from "./TaskConflictModal";
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

  const handleAddTaskAbove = (
    sectionId: TaskSectionId,
    beforeTaskId: string,
  ) => {
    const title = window.prompt("Task title:", "New task") ?? "New task";
    if (title.trim() === "") return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const idx = existingDay.tasks.findIndex((t) => t.id === beforeTaskId);
      if (idx < 0) return prev;
      const newTask: Task = {
        id: createTaskId(),
        title: title.trim(),
        sectionId,
        date: selectedDay,
        isDone: false,
      };
      const nextTasks = [
        ...existingDay.tasks.slice(0, idx),
        newTask,
        ...existingDay.tasks.slice(idx),
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

  /** Mobile: swap a root task up or down within its section. */
  const handleReorderTask = useCallback(
    (taskId: string, sectionId: TaskSectionId, direction: 'up' | 'down') => {
      updateAppState((prev) => {
        try {
          const existingDay = getOrCreateDay(prev, selectedDay);
          const sectionTasks = getOrderedTasksForSection(
            existingDay.tasks.filter((t) => t.sectionId === sectionId),
          );
          const fromIndex = sectionTasks.findIndex((t) => t.id === taskId);
          if (fromIndex < 0) return prev;
          const roots = sectionTasks.filter((t) => !t.parentId);
          const rootIdx = roots.findIndex((t) => t.id === taskId);
          if (rootIdx < 0) return prev;

          let toIndex: number;
          if (direction === 'up') {
            if (rootIdx === 0) return prev;
            const prevRoot = roots[rootIdx - 1]!;
            toIndex = sectionTasks.findIndex((t) => t.id === prevRoot.id);
          } else {
            if (rootIdx === roots.length - 1) return prev;
            const nextRoot = roots[rootIdx + 1]!;
            toIndex = sectionTasks.findIndex((t) => t.id === nextRoot.id) + 1;
          }

          const reordered = reorderTasks(sectionTasks, fromIndex, toIndex);
          let j = 0;
          const nextTasks = existingDay.tasks.map((t) =>
            t.sectionId === sectionId ? reordered[j++]! : t,
          );
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
    },
    [updateAppState, selectedDay],
  );

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
      updateAppState((prev) => {
        const sourceDayState = getOrCreateDay(prev, sourceDate);
        if (sourceDayState.tasks.length === 0) return prev;
        const newTasks = cloneTasksForDay(sourceDayState.tasks, selectedDay, {
          resetTimes: true,
        });
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
    [selectedDay, updateAppState],
  );

  /**
   * Append incomplete tasks from yesterday into today's existing plan.
   * Preserves scheduledAt and durationMinutes. Skips done parents even if
   * they have incomplete subtasks.
   */
  const handleCarryForward = useCallback(() => {
    const yesterday = addDays(selectedDay, -1);
    updateAppState((prev) => {
      const sourceTasks = getOrCreateDay(prev, yesterday).tasks;
      if (sourceTasks.every((t) => t.parentId || t.isDone)) return prev;

      const existingDay = getOrCreateDay(prev, selectedDay);
      // Build a dedup set from today's existing root tasks (title + sectionId)
      const existingKeys = new Set(
        existingDay.tasks
          .filter((t) => !t.parentId)
          .map((t) => `${t.sectionId}:${t.title.trim().toLowerCase()}`),
      );
      const dedupedRootIds = new Set(
        sourceTasks
          .filter((t) => !t.parentId && !t.isDone)
          .filter((t) => !existingKeys.has(`${t.sectionId}:${t.title.trim().toLowerCase()}`))
          .map((t) => t.id),
      );
      if (dedupedRootIds.size === 0) return prev;

      const toCarry = sourceTasks.filter(
        (t) => dedupedRootIds.has(t.id) || (t.parentId != null && dedupedRootIds.has(t.parentId) && !t.isDone),
      );

      const idMap = new Map<string, string>();
      const carried = toCarry.map((t) => {
        const newId = createTaskId();
        idMap.set(t.id, newId);
        // Increment postponedCount for root tasks being carried forward.
        const postponedCount = t.parentId ? (t.postponedCount ?? 0) : (t.postponedCount ?? 0) + 1;
        return { ...t, id: newId, date: selectedDay, isDone: false, postponedCount };
      }).map((t) => ({
        ...t,
        parentId: t.parentId ? (idMap.get(t.parentId) ?? undefined) : undefined,
      }));
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: [...existingDay.tasks, ...carried] },
        },
      };
    });
  }, [selectedDay, updateAppState]);

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

  /** Move a task to the global not-doing list and remove it from the plan. */
  const handleMoveToNotDoing = useCallback((taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const task = existingDay.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const descendantIds = getDescendantIds(existingDay.tasks, taskId);
      const toRemove = new Set([taskId, ...descendantIds]);
      const nextTasks = existingDay.tasks.filter((t) => !toRemove.has(t.id));
      const newItem: NotDoingItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: task.title,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        notDoingList: [...(prev.notDoingList ?? []), newItem],
        days: { ...prev.days, [selectedDay]: { ...existingDay, tasks: nextTasks } },
      };
    });
  }, [updateAppState, selectedDay]);

  /** Consciously abandon a task (Drucker: abandonment as a success). */
  const handleAbandonTask = useCallback((taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const task = existingDay.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const descendantIds = getDescendantIds(existingDay.tasks, taskId);
      const toRemove = new Set([taskId, ...descendantIds]);
      const nextTasks = existingDay.tasks.filter((t) => !toRemove.has(t.id));
      const abandoned: AbandonedTask = {
        id: taskId,
        title: task.title,
        sectionId: task.sectionId,
        abandonedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            tasks: nextTasks,
            abandonedTasks: [...(existingDay.abandonedTasks ?? []), abandoned],
          },
        },
      };
    });
  }, [updateAppState, selectedDay]);

  /** Add an item to the global not-doing list. */
  const handleAddToNotDoing = useCallback((text: string) => {
    updateAppState((prev) => {
      const newItem: NotDoingItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, notDoingList: [...(prev.notDoingList ?? []), newItem] };
    });
  }, [updateAppState]);

  /** Remove an item from the global not-doing list. */
  const handleRemoveFromNotDoing = useCallback((id: string) => {
    updateAppState((prev) => ({
      ...prev,
      notDoingList: (prev.notDoingList ?? []).filter((item) => item.id !== id),
    }));
  }, [updateAppState]);

  /** Add a per-day not-doing item. */
  const handleAddDayNotDoing = useCallback((text: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const newItem: NotDoingItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            notDoingItems: [...(existingDay.notDoingItems ?? []), newItem],
          },
        },
      };
    });
  }, [updateAppState, selectedDay]);

  /** Remove a per-day not-doing item. */
  const handleRemoveDayNotDoing = useCallback((id: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            notDoingItems: (existingDay.notDoingItems ?? []).filter((item) => item.id !== id),
          },
        },
      };
    });
  }, [updateAppState, selectedDay]);

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


  // Resolved block minutes: per-day override > global ratio template > wake/sleep defaults.
  const effectiveBlockDurations = useMemo<BlockDurations | null>(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget) return null;
    if (dayState.blockDurations) return dayState.blockDurations;
    const ratios = appState.blockDurationRatios;
    if (ratios) {
      const awake = computeAwakeMinutes(dayState.wakeTime, dayState.sleepTarget);
      return ratiosToBlockDurations(ratios, awake);
    }
    return getDefaultBlockDurations(dayState.wakeTime, dayState.sleepTarget);
  }, [dayState, appState.blockDurationRatios]);

  // Per-day timeline blocks derived from effective durations.
  const computedBlocks = useMemo(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget || !effectiveBlockDurations) return undefined;
    return computeBlocksFromDurations(dayState.wakeTime, effectiveBlockDurations);
  }, [dayState.wakeTime, dayState.sleepTarget, effectiveBlockDurations]);

  // Modal state: auto-open when today has no wake time; "Edit schedule" forces it open.
  const [daySetupOpen, setDaySetupOpen] = useState(false);
  // Track which day the user explicitly skipped so we don't re-prompt automatically.
  const [daySetupSkippedFor, setDaySetupSkippedFor] = useState<string | null>(null);

  const showDaySetupModal =
    !shareMode &&
    (daySetupOpen ||
      (selectedDay === todayIso() && !dayState.wakeTime && daySetupSkippedFor !== selectedDay));

  const handleDaySetupSave = useCallback(
    (wakeTime: string, sleepTarget: string, bedTime: string) => {
      updateAppState((prev) => {
        const existing = getOrCreateDay(prev, selectedDay);
        // Clear manual block overrides so blocks recompute from new wake/sleep times.
        return {
          ...prev,
          days: { ...prev.days, [selectedDay]: { ...existing, bedTime, wakeTime, sleepTarget, blockDurations: null } },
        };
      });
      setDaySetupOpen(false);
    },
    [updateAppState, selectedDay],
  );

  // --- Block duration editor state ---
  const [sleepWarnPending, setSleepWarnPending] = useState<{
    durations: BlockDurations; newSleepMinutes: number;
  } | null>(null);

  interface ConflictPending {
    durations: BlockDurations;
    newSleepTarget: string | null;
    blockName: string;
    newBlockStart: string;
    newBlockEnd: string;
    tasks: Task[];
    nextSectionId: TaskSectionId | null;
    nextBlockName: string | null;
  }
  const [conflictPending, setConflictPending] = useState<ConflictPending | null>(null);

  interface DurationScopePending {
    durations: BlockDurations;
    newSleepTarget: string | null;
    afterApply?: (next: AppState) => AppState;
  }
  const [durationScopePending, setDurationScopePending] = useState<DurationScopePending | null>(null);

  const applyDurationScopeToday = useCallback(() => {
    if (!durationScopePending) return;
    const { durations, newSleepTarget, afterApply } = durationScopePending;
    updateAppState((prev) => {
      const existing = getOrCreateDay(prev, selectedDay);
      const patch: Partial<DayState> = { blockDurations: durations };
      if (newSleepTarget !== null) patch.sleepTarget = newSleepTarget;
      let next: AppState = {
        ...prev,
        days: { ...prev.days, [selectedDay]: { ...existing, ...patch } },
      };
      if (afterApply) next = afterApply(next);
      return next;
    });
    setDurationScopePending(null);
  }, [durationScopePending, updateAppState, selectedDay]);

  const applyDurationScopeAllDays = useCallback(() => {
    if (!durationScopePending) return;
    const { durations, newSleepTarget, afterApply } = durationScopePending;
    const ratios = blockDurationsToRatios(durations);
    updateAppState((prev) => {
      const nextDays = { ...prev.days };
      for (const date of Object.keys(nextDays)) {
        const day = nextDays[date];
        if (day) nextDays[date] = { ...day, blockDurations: null };
      }
      const existing = getOrCreateDay(prev, selectedDay);
      const dayPatch: Partial<DayState> = { blockDurations: null };
      if (newSleepTarget !== null) dayPatch.sleepTarget = newSleepTarget;
      nextDays[selectedDay] = { ...existing, ...dayPatch };
      let next: AppState = {
        ...prev,
        days: nextDays,
        blockDurationRatios: ratios,
      };
      if (afterApply) next = afterApply(next);
      return next;
    });
    setDurationScopePending(null);
  }, [durationScopePending, updateAppState, selectedDay]);

  const handleBlockDurationChange = useCallback(
    (sectionId: keyof BlockDurations, newDurationMinutes: number) => {
      if (!effectiveBlockDurations || !dayState.wakeTime || !dayState.sleepTarget) return;

      const currentSleepMins = (() => {
        const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
        const [sh, sm] = (dayState.sleepTarget ?? "23:00").split(":").map(Number);
        const wake = (wh ?? 0) * 60 + (wm ?? 0);
        const sleep = (sh ?? 0) * 60 + (sm ?? 0);
        return wake > sleep ? wake - sleep : wake + 1440 - sleep;
      })();

      const result = applyBlockDurationChange(
        effectiveBlockDurations,
        sectionId,
        newDurationMinutes,
        currentSleepMins,
      );
      if (!result) return; // hard minimum violated

      // Compute new sleep target string if sleep minutes changed
      const newSleepTarget: string | null = result.sleepMinutes !== currentSleepMins
        ? (() => {
            const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
            const totalMin = ((wh ?? 0) * 60 + (wm ?? 0) + result.sleepMinutes) % 1440;
            return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
          })()
        : null;

      // Check for task conflicts in the changed block
      const blockIdx = BLOCK_ORDER.indexOf(sectionId);
      const newBlocks = computeBlocksFromDurations(dayState.wakeTime, result.durations);
      const newBlock = newBlocks[blockIdx];

      if (newBlock) {
        const blockStartMins = newBlock.start;
        const blockEndMins = newBlock.end >= newBlock.start ? newBlock.end : newBlock.end + 1440;
        const conflicts = (dayState.tasks ?? []).filter(
          (t) =>
            t.sectionId === sectionId &&
            t.scheduledAt &&
            (() => {
              const [th, tm] = t.scheduledAt!.split(":").map(Number);
              const taskMin = (th ?? 0) * 60 + (tm ?? 0);
              const adj = taskMin < blockStartMins ? taskMin + 1440 : taskMin;
              return adj < blockStartMins || adj >= blockEndMins;
            })(),
        );

        if (conflicts.length > 0) {
          const section = FIXED_SECTIONS.find((s) => s.id === sectionId);
          const nextId = blockIdx < BLOCK_ORDER.length - 1 ? BLOCK_ORDER[blockIdx + 1] ?? null : null;
          const nextSection = nextId ? FIXED_SECTIONS.find((s) => s.id === nextId) : null;
          const fmt = (m: number) =>
            `${String(Math.floor(m % 1440 / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

          // Sleep warn first if applicable
          if (result.sleepWarning) {
            setSleepWarnPending({ durations: result.durations, newSleepMinutes: result.sleepMinutes });
            return;
          }

          setConflictPending({
            durations: result.durations,
            newSleepTarget,
            blockName: section?.title ?? sectionId,
            newBlockStart: fmt(newBlock.start),
            newBlockEnd: fmt(newBlock.end),
            tasks: conflicts,
            nextSectionId: nextId as TaskSectionId | null,
            nextBlockName: nextSection?.title ?? null,
          });
          return;
        }
      }

      // Sleep warning (no task conflicts)
      if (result.sleepWarning) {
        setSleepWarnPending({ durations: result.durations, newSleepMinutes: result.sleepMinutes });
        return;
      }

      setDurationScopePending({
        durations: result.durations,
        newSleepTarget,
        afterApply: undefined,
      });
    },
    [effectiveBlockDurations, dayState],
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
    return getActiveSectionIds(currentMinutes, timeOffsetMinutes, computedBlocks);
  }, [tick, timeOffsetMinutes, computedBlocks]);
  const isSleepTimeNow = useMemo(() => {
    void tick;
    const now = new Date();
    return isSleepTime(now.getHours() * 60 + now.getMinutes(), timeOffsetMinutes, computedBlocks);
  }, [tick, timeOffsetMinutes, computedBlocks]);

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
      labels[section.id] = getSectionTimeframeLabel(section.id, timeOffsetMinutes, computedBlocks);
    }
    return labels;
  }, [timeOffsetMinutes, computedBlocks]);

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
          completedTaskCount={completedRootCount}
          totalTaskCount={totalRootCount}
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
            <header className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  Sleep
                </h3>
                <p className="text-xs text-slate-400">
                  Timeframe: {getSleepWindowLabel(timeOffsetMinutes, computedBlocks)}
                </p>
              </div>
              {!shareMode && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDaySetupOpen(true)}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-500 hover:text-sky-300"
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
              className="hidden h-full w-1 cursor-col-resize rounded-full bg-slate-800 hover:bg-sky-500 lg:block"
              onMouseDown={handleSplitterMouseDown}
              aria-hidden="true"
            />

            <div className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1" data-tour="sidebar">
              <WeeklyOverview
                state={appState as AppState}
                referenceDay={selectedDay}
              />
              {/* Deep work timer and motivation card: owner only */}
              {!shareMode && <DeepWorkTimer />}
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

      {/* Day setup modal: prompts for wake/sleep times on today's fresh planner */}
      {showDaySetupModal && (
        <DaySetupModal
          date={selectedDay}
          initialBedTime={dayState.bedTime}
          initialWakeTime={dayState.wakeTime}
          initialSleepTarget={dayState.sleepTarget}
          prevBedTime={prevDayState.bedTime}
          prevWakeTime={prevDayState.wakeTime}
          prevSleepTarget={prevDayState.sleepTarget}
          onSave={handleDaySetupSave}
          onSkip={() => { setDaySetupSkippedFor(selectedDay); setDaySetupOpen(false); }}
        />
      )}

      {/* Sleep warning confirmation */}
      {sleepWarnPending && dayState.wakeTime && (() => {
        const { durations, newSleepMinutes } = sleepWarnPending;
        const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
        const totalMin = ((wh ?? 0) * 60 + (wm ?? 0) + newSleepMinutes) % 1440;
        const newTarget = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        const h = Math.floor(newSleepMinutes / 60);
        const m = newSleepMinutes % 60;
        const label = m === 0 ? `${h}h` : `${h}h ${m}m`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
            <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-amber-400">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Sleep will drop to {label}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Sleep below 7 hours affects focus, memory, and performance. This change will update your bedtime target to {newTarget}.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDurationScopePending({
                      durations,
                      newSleepTarget: newTarget,
                      afterApply: undefined,
                    });
                    setSleepWarnPending(null);
                  }}
                  className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                >
                  Apply anyway
                </button>
                <button
                  onClick={() => setSleepWarnPending(null)}
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task conflict modal */}
      {conflictPending && (
        <TaskConflictModal
          blockName={conflictPending.blockName}
          newStart={conflictPending.newBlockStart}
          newEnd={conflictPending.newBlockEnd}
          conflictingTasks={conflictPending.tasks}
          nextBlockName={conflictPending.nextBlockName}
          onKeep={() => {
            const c = conflictPending;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: undefined,
            });
            setConflictPending(null);
          }}
          onClear={() => {
            const c = conflictPending;
            const toClear = c.tasks;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: (next) => {
                const existing = getOrCreateDay(next, selectedDay);
                const tasks = existing.tasks.map((t) =>
                  toClear.some((x) => x.id === t.id) ? { ...t, scheduledAt: undefined } : t,
                );
                return { ...next, days: { ...next.days, [selectedDay]: { ...existing, tasks } } };
              },
            });
            setConflictPending(null);
          }}
          onMove={conflictPending.nextSectionId ? () => {
            const c = conflictPending;
            const nid = c.nextSectionId!;
            const toMove = c.tasks;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: (next) => {
                const existing = getOrCreateDay(next, selectedDay);
                const tasks = existing.tasks.map((t) =>
                  toMove.some((x) => x.id === t.id)
                    ? { ...t, sectionId: nid, scheduledAt: undefined }
                    : t,
                );
                return { ...next, days: { ...next.days, [selectedDay]: { ...existing, tasks } } };
              },
            });
            setConflictPending(null);
          } : null}
        />
      )}

      {durationScopePending && (
        <BlockDurationScopeModal
          onThisDayOnly={applyDurationScopeToday}
          onAllDaysDefault={applyDurationScopeAllDays}
          onCancel={() => setDurationScopePending(null)}
        />
      )}
    </div>
  );
}
