/**
 * domain/stats.ts
 *
 * Functions for computing weekly task completion statistics.
 *
 * Scoring rule (weighted points):
 *   - Each ROOT task contributes a number of possible points based on its section.
 *   - Leaf root tasks: earn all points if done, else 0.
 *   - Root tasks WITH subtasks: earn a fraction based on subtask completion
 *     (doneSubs / subtaskCount). Parent isDone is ignored for scoring.
 *   - Subtasks add a small capped bonus to the root task's possible points so
 *     completing a structured task feels slightly more rewarding without being gameable.
 */

import type { AppState, Task, WeeklyStats, WeeklyStatsDaySummary } from './types'
import { weekForDay } from './dateUtils'

const SECTION_WEIGHTS: Record<Task['sectionId'], number> = {
  mustDo: 3.0,
  highPriority: 2.0,
  mediumPriority: 1.5,
  morningRoutine: 1.0,
  nightRoutine: 1.0,
  lowPriority: 0.5,
}

const SUBTASK_BONUS_PER_TASK = 0.1
const SUBTASK_BONUS_CAP = 3

/**
 * Compute points {total, completed} for a list of tasks.
 * Each root task contributes weighted possible points. Subtask completion drives the fraction earned.
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
    const baseWeight = SECTION_WEIGHTS[root.sectionId] ?? 1
    const children = childrenByParent.get(root.id) ?? []

    if (children.length === 0) {
      total += baseWeight
      completed += root.isDone ? baseWeight : 0
    } else {
      const effectiveWeight =
        baseWeight + Math.min(children.length, SUBTASK_BONUS_CAP) * SUBTASK_BONUS_PER_TASK
      total += effectiveWeight
      const doneSubs = children.filter((c) => c.isDone).length
      completed += effectiveWeight * (doneSubs / children.length)
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

/**
 * For a list of tasks, returns how many root tasks are total vs completed
 * broken down by section. Only root tasks are counted (parentId absent) —
 * subtasks are owned by their parent's score.
 */
export function computeSectionCompletion(
  tasks: Task[],
): Partial<Record<Task['sectionId'], { total: number; completed: number }>> {
  const result: Partial<Record<Task['sectionId'], { total: number; completed: number }>> = {}

  for (const task of tasks) {
    if (task.parentId) continue // subtasks don't count independently
    const bucket = result[task.sectionId] ?? { total: 0, completed: 0 }
    bucket.total++
    if (task.isDone) bucket.completed++
    result[task.sectionId] = bucket
  }

  return result
}

