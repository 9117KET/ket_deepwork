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
  type Task,
  type TaskSectionId,
  type TaskPatch,
} from "../domain/types";
import { deriveActiveDaysFromDays } from "../domain/dateUtils";
import {
  createTaskId,
  reorderTasks,
  getOrderedTasksForSection,
  getDescendantIds,
  cloneTasksForDay,
} from "../domain/taskUtils";
import { blockDayIso, detachSessionsFromTasks, reattributeSession } from "../domain/workSafety";
import { withdrawManualMinutes } from "../domain/taskProgress";
import { getOrCreateDay } from "../storage/localStorageState";


export function useTaskHandlers(
  updateAppState: (updater: (prev: AppState) => AppState) => void,
  selectedDay: string,
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
        [selectedDay]: {
          ...existingDay,
          tasks: nextTasks,
          // Minutes that were really worked survive the task they were worked
          // on. The session keeps counting toward the weekly total and carries
          // the old title in its label instead of a dangling id.
          deepWorkSessions: detachSessionsFromTasks(
            existingDay.deepWorkSessions,
            existingDay.tasks,
            [...toRemove],
          ),
        },
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

  const handleUpdateTask = (taskId: string, patch: TaskPatch) => {
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

  /**
   * Apply what changed in Google Tasks - a tick, an un-tick, a rename - to the
   * planner's copy. Only the named fields move; everything else on the task
   * (duration, schedule, logged work, subtasks) is the planner's alone. Done
   * state is applied per task, not cascaded: Google already reports each
   * subtask on its own.
   */
  const handleApplyRemoteTaskChanges = useCallback(
    (date: string, changes: Array<{ taskId: string; title?: string; isDone?: boolean }>) => {
      if (changes.length === 0) return;
      updateAppState((prev) => {
        const day = prev.days[date];
        if (!day) return prev;
        const byId = new Map(changes.map((c) => [c.taskId, c]));
        let changed = false;
        const nextTasks = day.tasks.map((task) => {
          const change = byId.get(task.id);
          if (!change) return task;
          const title = change.title ?? task.title;
          const isDone = change.isDone ?? task.isDone;
          if (title === task.title && isDone === task.isDone) return task;
          changed = true;
          return { ...task, title, isDone };
        });
        if (!changed) return prev;
        const nextDays = { ...prev.days, [date]: { ...day, tasks: nextTasks } };
        return { ...prev, days: nextDays, activeDays: deriveActiveDaysFromDays(nextDays) };
      });
    },
    [updateAppState],
  );

  /**
   * Record a completed deep work session into the current day. When the timer
   * was pointed at a task, `taskId` attributes the minutes to it - that is what
   * fills the task's progress boxes as earned rather than self-reported work.
   */
  const handleSessionComplete = useCallback((
    label: string,
    durationMinutes: number,
    taskId?: string,
    startedAt?: string,
  ) => {
    updateAppState((prev) => {
      // The block belongs to the day it STARTED on, not the day on screen when
      // it lands. Starting a block and paging back to yesterday to check
      // something used to write the whole session onto yesterday.
      const targetDay = blockDayIso(startedAt, selectedDay);
      const day = getOrCreateDay(prev, targetDay);
      const startedIso = startedAt ?? new Date(Date.now() - durationMinutes * 60_000).toISOString();
      const session: DeepWorkSession = {
        id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        durationMinutes,
        ...(taskId ? { taskId } : {}),
        startedAt: startedIso,
        finishedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [targetDay]: { ...day, deepWorkSessions: [...day.deepWorkSessions, session] },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  /**
   * Record a block that ran to completion while the app was closed, against the
   * day it was started on rather than whichever day is on screen now.
   *
   * These are earned minutes, so they land in `deepWorkSessions` alongside
   * blocks watched from start to finish - the clock measured the same interval
   * either way, and the user has confirmed they worked it. The real start and
   * finish instants come from the stored block, so the session records when the
   * work happened rather than when it was claimed.
   */
  const handleRecordAwaySession = useCallback(
    (block: {
      dayIso: string;
      taskId?: string;
      label: string;
      minutes: number;
      startedAt: string;
      finishedAt: string;
    }) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, block.dayIso);
        const session: DeepWorkSession = {
          id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: block.label,
          durationMinutes: block.minutes,
          ...(block.taskId ? { taskId: block.taskId } : {}),
          startedAt: block.startedAt,
          finishedAt: block.finishedAt,
        };
        return {
          ...prev,
          days: {
            ...prev.days,
            [block.dayIso]: { ...day, deepWorkSessions: [...day.deepWorkSessions, session] },
          },
        };
      });
    },
    [updateAppState],
  );

  /**
   * Record a stretch of work the timer never saw.
   *
   * It lands in `deepWorkSessions` like any other block, marked
   * `source: 'manual'` - which is what keeps it out of every earned total while
   * still giving it the things a bare number on the task never had: a place in
   * the day, an entry that can be taken back on its own, and survival when the
   * task is deleted, since sessions are detached rather than dropped.
   *
   * `interval` is passed only when the person actually gave clock times. With
   * none, the entry records when it was claimed and says nothing about when it
   * was worked, because inventing a plausible interval is how a record stops
   * meaning anything.
   */
  const handleLogManualMinutes = useCallback(
    (
      taskId: string,
      minutes: number,
      interval?: { startedAt: string; finishedAt: string },
    ) => {
      const amount = Math.floor(minutes);
      if (!Number.isFinite(amount) || amount <= 0) return;
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay);
        const task = day.tasks.find((t) => t.id === taskId);
        if (!task) return prev;
        const loggedAt = new Date().toISOString();
        const session: DeepWorkSession = {
          id: `dw-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: task.title,
          durationMinutes: amount,
          taskId,
          source: 'manual',
          loggedAt,
          startedAt: interval?.startedAt ?? loggedAt,
          ...(interval ? { finishedAt: interval.finishedAt } : {}),
        };
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDay]: { ...day, deepWorkSessions: [...day.deepWorkSessions, session] },
          },
        };
      });
    },
    [selectedDay, updateAppState],
  );

  /**
   * Take hand-logged minutes back. Self-reported time is the only kind the user
   * can remove - earned minutes are never touched here - and the newest entries
   * go first. Anything left over comes off the legacy per-task total, which is
   * where minutes logged before entries existed still live.
   */
  const handleUndoManualMinutes = useCallback((taskId: string, minutes: number) => {
    updateAppState((prev) => {
      const day = getOrCreateDay(prev, selectedDay);
      const { sessions, legacyRemainder } = withdrawManualMinutes(
        day.deepWorkSessions,
        taskId,
        minutes,
      );
      const nextTasks =
        legacyRemainder > 0
          ? day.tasks.map((task) => {
              if (task.id !== taskId) return task;
              const next = Math.max(0, (task.manualLoggedMinutes ?? 0) - legacyRemainder);
              return { ...task, manualLoggedMinutes: next === 0 ? undefined : next };
            })
          : day.tasks;
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...day, tasks: nextTasks, deepWorkSessions: sessions },
        },
      };
    });
  }, [selectedDay, updateAppState]);

  /**
   * Point a recorded block at a different task, or at none.
   *
   * The one repair the ledger never had. Minutes earned against the wrong task
   * - a "Working on" picked in a hurry - could not be moved, only deleted along
   * with the task holding them. Nothing here changes how long anything was,
   * when it happened or whether it was earned; only what it was for.
   */
  const handleReattributeSession = useCallback(
    (sessionId: string, toTaskId: string | undefined) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay);
        const sessions = reattributeSession(
          day.deepWorkSessions,
          sessionId,
          toTaskId,
          day.tasks,
        );
        return {
          ...prev,
          days: { ...prev.days, [selectedDay]: { ...day, deepWorkSessions: sessions } },
        };
      });
    },
    [selectedDay, updateAppState],
  );

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
    handleUpdateTask,
    handleApplyRemoteTaskChanges,
    handleSessionComplete,
    handleRecordAwaySession,
    handleLogManualMinutes,
    handleUndoManualMinutes,
    handleReattributeSession,
    handleAbandonTask,
    handleReorderSubtask,
    handleMoveSubtask,
  };
}
