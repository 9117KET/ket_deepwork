/**
 * domain/stats.ts
 *
 * Functions for computing weekly task completion statistics.
 *
 * Scoring rule:
 *   - A root task with NO subtasks counts as 1 point (0 or 1 depending on isDone).
 *   - A root task WITH subtasks counts as 1 point total, weighted by how many
 *     subtasks are done: e.g. 2 of 4 subtasks done → 0.5 points toward completion.
 *   - The parent task's own isDone flag is ignored for scoring when it has children
 *     (the parent is marked done automatically when all children are done).
 *
 * This way a task-group always contributes exactly 1 point, regardless of how many
 * subtasks it has, keeping percentages meaningful.
 */

import type { AppState, Task, WeeklyStats, WeeklyStatsDaySummary } from './types'
import { weekForDay } from './dateUtils'

/**
 * Compute points {total, completed} for a list of tasks.
 * Each root task = 1 point. Subtask completion drives the fraction earned.
 */
function computePoints(tasks: Task[]): { total: number; completed: number } {
  const childrenByParent = new Map<string, Task[]>()
  const roots: Task[] = []

  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childrenByParent.get(task.parentId) ?? []
      siblings.push(task)
      childrenByParent.set(task.parentId, siblings)
    } else {
      roots.push(task)
    }
  }

  let total = 0
  let completed = 0

  for (const root of roots) {
    total += 1
    const children = childrenByParent.get(root.id) ?? []

    if (children.length === 0) {
      // Leaf task: simply done or not
      completed += root.isDone ? 1 : 0
    } else {
      // Has subtasks: fraction of children done
      const doneSubs = children.filter((c) => c.isDone).length
      completed += doneSubs / children.length
    }
  }

  return { total, completed }
}

export function computeWeeklyStats(state: AppState, referenceDayIso: string): WeeklyStats {
  const week = weekForDay(referenceDayIso)

  const days: WeeklyStatsDaySummary[] = week.days.map((dayIso) => {
    const dayState = state.days[dayIso]
    const { total, completed } = computePoints(dayState?.tasks ?? [])

    return {
      date: dayIso,
      completedCount: completed,
      totalCount: total,
    }
  })

  const totalCompleted = days.reduce((sum, day) => sum + day.completedCount, 0)
  const totalTasks = days.reduce((sum, day) => sum + day.totalCount, 0)

  return {
    days,
    totalCompleted,
    totalTasks,
  }
}

export function computeDayCompletion(state: AppState, dayIso: string): WeeklyStatsDaySummary {
  const dayState = state.days[dayIso]
  const { total, completed } = computePoints(dayState?.tasks ?? [])

  return {
    date: dayIso,
    completedCount: completed,
    totalCount: total,
  }
}

