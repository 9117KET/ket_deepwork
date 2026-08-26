/**
 * hooks/useTaskHandlers.ts
 *
 * Extracts all task mutation handlers from DayPlanner so the component
 * file stays focused on layout and composition.
 */

import { useCallback, useRef, useState } from "react";
import {
  FIXED_SECTIONS,
  type AbandonedTask,
  type AppState,
  type DeepWorkSession,
  type MonthlyReview,
  type NotDoingItem,
  type SideQuestDef,
  type Task,
  type TaskSectionId,
} from "../domain/types";
import { addDays, todayIso, deriveActiveDaysFromDays } from "../domain/dateUtils";
import {
  createTaskId,
  reorderTasks,
  getOrderedTasksForSection,
  getDescendantIds,
  cloneTasksForDay,
  pickMustsToCopyForward,
} from "../domain/taskUtils";
import { getOrCreateDay } from "../storage/localStorageState";

/** Max MUSTs per day — mirrors MAX_MUSTS in TomorrowMustPanel. */
const MAX_TOMORROW_MUSTS = 3;

export function useTaskHandlers(
  updateAppState: (updater: (prev: AppState) => AppState) => void,
  selectedDay: string,
  travelingToday: boolean,
) {
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

  /** Mark every selected task (and its descendants) complete. Mirrors handleToggleTask's activeDays recompute. */
  const handleCompleteSelected = () => {
    if (selectedTaskIds.size === 0) return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const toComplete = new Set<string>(selectedTaskIds);
      for (const id of selectedTaskIds) {
        getDescendantIds(existingDay.tasks, id).forEach((desc) => toComplete.add(desc));
      }
      const nextTasks = existingDay.tasks.map((t) =>
        toComplete.has(t.id) ? { ...t, isDone: true } : t,
      );
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
    setSelectedTaskIds(new Set());
  };

  /** Mark every selected task shallow (value=true) or deep (value=false). */
  const handleSetShallowSelected = (value: boolean) => {
    if (selectedTaskIds.size === 0) return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const nextTasks = existingDay.tasks.map((t) =>
        selectedTaskIds.has(t.id) ? { ...t, isShallow: value } : t,
      );
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

  /** Move every selected root task (and its descendants) to another section, appended to the end. */
  const handleMoveSelectedToSection = (toSectionId: TaskSectionId) => {
    if (selectedTaskIds.size === 0) return;
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay);
      const toMove = new Set<string>(selectedTaskIds);
      for (const id of selectedTaskIds) {
        getDescendantIds(existingDay.tasks, id).forEach((desc) => toMove.add(desc));
      }
      const nextTasks = existingDay.tasks.map((t) =>
        toMove.has(t.id) ? { ...t, sectionId: toSectionId } : t,
      );
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
          // Travel days are shallow by default - user can unmark if needed
          ...(travelingToday ? { isShallow: true } : {}),
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
          const reorderedIds = new Set(reordered.map(t => t.id));
          const orphaned = existingDay.tasks.filter(
            t => t.sectionId === sectionId && !reorderedIds.has(t.id)
          );
          const nextTasks = [
            ...existingDay.tasks.filter(t => t.sectionId !== sectionId),
            ...reordered,
            ...orphaned,
          ];
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
          sideQuest: [],
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
            const reorderedIds = new Set(reordered.map(t => t.id));
            const orphaned = existingDay.tasks.filter(
              t => t.sectionId === fromSectionId && !reorderedIds.has(t.id)
            );
            const nextTasks = [
              ...existingDay.tasks.filter(t => t.sectionId !== fromSectionId),
              ...reordered,
              ...orphaned,
            ];
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

  /**
   * Copy tasks from a source day into the selected day, preserving scheduledAt
   * and durationMinutes. Existing tasks on the target day are kept; source roots
   * that already exist there (same section + title) are skipped, along with
   * their subtasks. Used for fill/copy buttons.
   */
  const handleCopyFromDay = useCallback(
    (sourceDate: string) => {
      updateAppState((prev) => {
        const sourceDayState = getOrCreateDay(prev, sourceDate);
        if (sourceDayState.tasks.length === 0) return prev;
        const existingDay = getOrCreateDay(prev, selectedDay);
        const existingKeys = new Set(
          existingDay.tasks
            .filter((t) => !t.parentId)
            .map((t) => `${t.sectionId}:${t.title.trim().toLowerCase()}`),
        );
        // MUSTs and Side Quests are personal — never copy them from another day.
        const copyableRootIds = new Set(
          sourceDayState.tasks
            .filter((t) => !t.parentId && t.sectionId !== 'mustDo' && t.sectionId !== 'sideQuest')
            .filter((t) => !existingKeys.has(`${t.sectionId}:${t.title.trim().toLowerCase()}`))
            .map((t) => t.id),
        );
        const sourceToCopy = sourceDayState.tasks.filter(
          (t) => copyableRootIds.has(t.id) || (t.parentId != null && copyableRootIds.has(t.parentId)),
        );
        if (sourceToCopy.length === 0) return prev;
        const newTasks = cloneTasksForDay(sourceToCopy, selectedDay);
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: { ...existingDay, tasks: [...existingDay.tasks, ...newTasks] },
          },
        };
      });
    },
    [selectedDay, updateAppState],
  );

  const handleUpdateTask = (
    taskId: string,
    patch: {
      scheduledAt?: string;
      durationMinutes?: number;
      title?: string;
      isShallow?: boolean;
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

  const handleUpdateMonthlyReview = useCallback((monthKey: string, review: MonthlyReview) => {
    updateAppState((prev) => ({
      ...prev,
      monthlyReviews: { ...(prev.monthlyReviews ?? {}), [monthKey]: review },
    }))
  }, [updateAppState])

  const handleUpdateWeeklyReview = useCallback((dateKey: string, review: import('../domain/types').WeeklyReview) => {
    updateAppState((prev) => ({
      ...prev,
      weeklyReviews: { ...(prev.weeklyReviews ?? {}), [dateKey]: review },
    }))
  }, [updateAppState])

  const handleToggleSideQuestCompletion = useCallback((id: string, value: boolean) => {
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, selectedDay)
      const currentCompletions = day.sideQuestCompletions ?? {}
      const wasComplete = currentCompletions[id] ?? false
      const newCompletions = { ...currentCompletions, [id]: value }

      // XP: tracks actual completions (decrements on untick)
      const xpDelta = (value && !wasComplete) ? 1 : (!value && wasComplete) ? -1 : 0

      // Streak: earned on first completion today only (not reverted on untick)
      // Only update when on today's date to prevent retroactive streak manipulation
      let newStreak = prev.sideQuestStreak ?? 0
      let newLastStreakDate = prev.sideQuestLastStreakDate
      if (value && !wasComplete && selectedDay === todayIso() && prev.sideQuestLastStreakDate !== selectedDay) {
        const yesterday = addDays(selectedDay, -1)
        newStreak = prev.sideQuestLastStreakDate === yesterday
          ? (prev.sideQuestStreak ?? 0) + 1
          : 1
        newLastStreakDate = selectedDay
      }

      return {
        ...prev,
        sideQuestXp: Math.max(0, (prev.sideQuestXp ?? 0) + xpDelta),
        sideQuestStreak: newStreak,
        sideQuestLastStreakDate: newLastStreakDate,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...day,
            sideQuestCompletions: newCompletions,
          },
        },
      }
    })
  }, [selectedDay, updateAppState])

  const handleSaveSideQuestDefs = useCallback((defs: SideQuestDef[]) => {
    updateAppState((prev) => ({ ...prev, sideQuestDefs: defs }))
  }, [updateAppState])

  /**
   * Record a completed deep work session into the current day. When the timer
   * was pointed at a task, `taskId` attributes the minutes to it - that is what
   * fills the task's progress boxes as earned rather than self-reported work.
   */
  const handleSessionComplete = useCallback((label: string, durationMinutes: number, taskId?: string) => {
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, selectedDay);
      const session: DeepWorkSession = {
        id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        durationMinutes,
        ...(taskId ? { taskId } : {}),
        startedAt: new Date(Date.now() - durationMinutes * 60_000).toISOString(),
        finishedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...day, deepWorkSessions: [...day.deepWorkSessions, session] },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  /**
   * Add or remove hand-logged minutes on a task. Kept separate from the timer
   * path on purpose: these minutes are self-reported, are the only ones the user
   * can take back, and never touch deepWorkSessions, so the weekly deep work
   * scoreboard stays a record of time actually worked.
   */
  const handleAdjustManualMinutes = useCallback((taskId: string, deltaMinutes: number) => {
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, selectedDay);
      const nextTasks = day.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const next = Math.max(0, (task.manualLoggedMinutes ?? 0) + deltaMinutes);
        return { ...task, manualLoggedMinutes: next === 0 ? undefined : next };
      });
      return {
        ...prev,
        days: { ...prev.days, [selectedDay]: { ...day, tasks: nextTasks } },
      };
    });
  }, [selectedDay, updateAppState]);

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

  const handleAddTomorrowMust = useCallback((title: string) => {
    const tomorrowDate = addDays(selectedDay, 1);
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, tomorrowDate);
      const task: Task = {
        id: `must-tmrw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        sectionId: 'mustDo',
        date: tomorrowDate,
        isDone: false,
      };
      return {
        ...prev,
        days: { ...prev.days, [tomorrowDate]: { ...day, tasks: [...day.tasks, task] } },
      };
    });
  }, [selectedDay, updateAppState]);

  const handleDeleteTomorrowMust = useCallback((taskId: string) => {
    const tomorrowDate = addDays(selectedDay, 1);
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, tomorrowDate);
      return {
        ...prev,
        days: {
          ...prev.days,
          [tomorrowDate]: { ...day, tasks: day.tasks.filter((t) => t.id !== taskId) },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  const handleEditTomorrowMust = useCallback((taskId: string, title: string) => {
    const tomorrowDate = addDays(selectedDay, 1);
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, tomorrowDate);
      return {
        ...prev,
        days: {
          ...prev.days,
          [tomorrowDate]: {
            ...day,
            tasks: day.tasks.map((t) => t.id === taskId ? { ...t, title } : t),
          },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  const handleUpdateTomorrowMust = useCallback((taskId: string, patch: { scheduledAt?: string; durationMinutes?: number }) => {
    const tomorrowDate = addDays(selectedDay, 1);
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, tomorrowDate);
      return {
        ...prev,
        days: {
          ...prev.days,
          [tomorrowDate]: { ...day, tasks: day.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  /**
   * Copy the currently-viewed day's MUSTs into tomorrow's MUST slots. Fills only
   * the empty slots (cap of 3), skips titles already set for tomorrow, resets
   * completion, and carries over scheduled time / duration. Lets the user repeat
   * a recurring MUST for the next day with one click instead of retyping it.
   */
  const handleCopyTodayMustsToTomorrow = useCallback(() => {
    const tomorrowDate = addDays(selectedDay, 1);
    updateAppState((prev) => {
      const sourceMusts = (prev.days[selectedDay]?.tasks ?? []).filter(
        (t) => t.sectionId === 'mustDo' && !t.parentId,
      );
      if (sourceMusts.length === 0) return prev;

      const tomorrow = getOrCreateDay(prev, tomorrowDate);
      const existingMusts = tomorrow.tasks.filter((t) => t.sectionId === 'mustDo' && !t.parentId);
      const toCopy = pickMustsToCopyForward(sourceMusts, existingMusts, MAX_TOMORROW_MUSTS);
      if (toCopy.length === 0) return prev;

      const stamp = Date.now();
      const additions: Task[] = toCopy.map((src, i) => ({
        id: `must-tmrw-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        title: src.title,
        sectionId: 'mustDo',
        date: tomorrowDate,
        isDone: false,
        ...(src.scheduledAt ? { scheduledAt: src.scheduledAt } : {}),
        ...(src.durationMinutes ? { durationMinutes: src.durationMinutes } : {}),
      }));

      return {
        ...prev,
        days: {
          ...prev.days,
          [tomorrowDate]: { ...tomorrow, tasks: [...tomorrow.tasks, ...additions] },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  const handleReorderSubtask = useCallback(
    (parentId: string, subtaskId: string, insertIndex: number) => {
      updateAppState((prev) => {
        try {
          const existingDay = getOrCreateDay(prev, selectedDay)
          const siblings = existingDay.tasks.filter(t => t.parentId === parentId)
          const fromIndex = siblings.findIndex(t => t.id === subtaskId)
          if (fromIndex < 0) return prev

          const reordered = reorderTasks(siblings, fromIndex, insertIndex)
          const withoutSiblings = existingDay.tasks.filter(t => t.parentId !== parentId)
          const parentIdx = withoutSiblings.findIndex(t => t.id === parentId)
          if (parentIdx < 0) return prev

          const nextTasks = [
            ...withoutSiblings.slice(0, parentIdx + 1),
            ...reordered,
            ...withoutSiblings.slice(parentIdx + 1),
          ]
          if (nextTasks.length !== existingDay.tasks.length) return prev
          return {
            ...prev,
            days: { ...prev.days, [selectedDay]: { ...existingDay, tasks: nextTasks } },
          }
        } catch {
          return prev
        }
      })
    },
    [updateAppState, selectedDay],
  )

  const handleMoveSubtask = useCallback(
    (subtaskId: string, newParentId: string | null) => {
      updateAppState((prev) => {
        try {
          const existingDay = getOrCreateDay(prev, selectedDay)
          const subtask = existingDay.tasks.find(t => t.id === subtaskId)
          if (!subtask) return prev

          if (newParentId === null) {
            const nextTasks = existingDay.tasks.map(t =>
              t.id === subtaskId ? { ...t, parentId: undefined } : t
            )
            return {
              ...prev,
              days: { ...prev.days, [selectedDay]: { ...existingDay, tasks: nextTasks } },
            }
          }

          const newParent = existingDay.tasks.find(t => t.id === newParentId)
          if (!newParent || newParentId === subtask.parentId) return prev

          const withoutSubtask = existingDay.tasks.filter(t => t.id !== subtaskId)
          const newParentIdx = withoutSubtask.findIndex(t => t.id === newParentId)
          if (newParentIdx < 0) return prev

          const moved: Task = { ...subtask, parentId: newParentId, sectionId: newParent.sectionId }

          let insertAfterIdx = newParentIdx
          for (let i = newParentIdx + 1; i < withoutSubtask.length; i++) {
            if (withoutSubtask[i]?.parentId === newParentId) {
              insertAfterIdx = i
            } else {
              break
            }
          }

          const nextTasks = [
            ...withoutSubtask.slice(0, insertAfterIdx + 1),
            moved,
            ...withoutSubtask.slice(insertAfterIdx + 1),
          ]
          if (nextTasks.length !== existingDay.tasks.length) return prev
          return {
            ...prev,
            days: { ...prev.days, [selectedDay]: { ...existingDay, tasks: nextTasks } },
          }
        } catch {
          return prev
        }
      })
    },
    [updateAppState, selectedDay],
  )

  return {
    draggedTask,
    setSelectedTaskIds,
    selectedTaskIds,
    handleToggleSelect,
    handleDeleteSelected,
    handleCompleteSelected,
    handleSetShallowSelected,
    handleMoveSelectedToSection,
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
    handleMoveTask,
    handleCopyFromDay,
    handleUpdateTask,
    handleUpdateMonthlyReview,
    handleUpdateWeeklyReview,
    handleToggleSideQuestCompletion,
    handleSaveSideQuestDefs,
    handleSessionComplete,
    handleAdjustManualMinutes,
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
    handleCopyTodayMustsToTomorrow,
    handleReorderSubtask,
    handleMoveSubtask,
  };
}
