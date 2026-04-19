/**
 * domain/stats.ts
 *
 * Functions for computing weekly task completion statistics.
 *
 * Scoring rule (duration × section weighted points):
 *   - Each ROOT task's base weight = durationMinutes × sectionWeight.
 *     Tasks without a duration fall back to DEFAULT_TASK_DURATION_MINUTES.
 *   - Leaf root tasks: earn all points if done, else 0.
 *   - Root tasks WITH subtasks: earn a fraction based on duration-weighted subtask
 *     completion (doneSubDuration / totalSubDuration). Parent isDone is ignored for scoring.
 *   - Subtasks add a small capped bonus (numerically negligible at this scale, kept for
 *     continuity) so completing a structured task feels slightly more rewarding.
 */

import type { AppState, DayState, Task, WeeklyStats, WeeklyStatsDaySummary } from './types'
import { addDays, weekForDay } from './dateUtils'

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
/** Fallback duration (minutes) for tasks that have no durationMinutes set. */
const DEFAULT_TASK_DURATION_MINUTES = 30

/**
 * Compute points {total, completed} for a list of tasks.
 * Each root task's weight = durationMinutes × sectionWeight (duration-proportional scoring).
 * Subtask completion fraction is also duration-weighted.
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
    const sectionWeight = SECTION_WEIGHTS[root.sectionId] ?? 1
    const duration = root.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES
    const baseWeight = duration * sectionWeight
    const children = childrenByParent.get(root.id) ?? []

    if (children.length === 0) {
      total += baseWeight
      completed += root.isDone ? baseWeight : 0
    } else {
      const effectiveWeight =
        baseWeight + Math.min(children.length, SUBTASK_BONUS_CAP) * SUBTASK_BONUS_PER_TASK
      total += effectiveWeight
      const totalSubDuration = children.reduce(
        (s, c) => s + (c.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES),
        0,
      )
      const doneSubDuration = children
        .filter((c) => c.isDone)
        .reduce((s, c) => s + (c.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES), 0)
      completed += effectiveWeight * (doneSubDuration / totalSubDuration)
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
/**
 * For each habit id, compute the current consecutive-day streak ending on `untilDate`.
 * A day counts when `habitCompletions[habitId] === true`.
 * Caps lookback at 365 days.
 */
export function computePerHabitStreaks(
  days: Record<string, DayState | undefined>,
  habitIds: string[],
  untilDate: string,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const id of habitIds) {
    let streak = 0
    let date = untilDate
    for (let i = 0; i < 365; i++) {
      const completions = days[date]?.habitCompletions
      if (completions?.[id] === true) {
        streak++
        date = addDays(date, -1)
      } else {
        break
      }
    }
    result[id] = streak
  }
  return result
}

/**
 * Returns habit ids that are "at risk" of being missed twice in a row.
 * A habit is at risk when: it was NOT completed yesterday AND WAS completed the day before.
 * This implements the Atomic Habits "never miss twice" rule.
 */
export function getAtRiskHabitIds(
  days: Record<string, DayState | undefined>,
  habitIds: string[],
  today: string,
): Set<string> {
  const yesterday = addDays(today, -1)
  const dayBeforeYesterday = addDays(today, -2)
  const atRisk = new Set<string>()
  for (const id of habitIds) {
    const missedYesterday = days[yesterday]?.habitCompletions?.[id] !== true
    const doneDayBefore = days[dayBeforeYesterday]?.habitCompletions?.[id] === true
    if (missedYesterday && doneDayBefore) {
      atRisk.add(id)
    }
  }
  return atRisk
}

/**
 * Returns total deep work minutes for a day from completed (not cancelled) sessions.
 */
export function computeDailyDeepWorkMinutes(day: DayState | undefined): number {
  if (!day) return 0
  return day.deepWorkSessions
    .filter((s) => s.finishedAt && !s.cancelledAt)
    .reduce((sum, s) => sum + s.durationMinutes, 0)
}

/**
 * Returns deep work hours accumulated across a week (array of 7 ISO dates).
 */
export function computeWeeklyDeepWorkHours(
  days: Record<string, DayState | undefined>,
  weekDays: string[],
): number {
  const totalMinutes = weekDays.reduce(
    (sum, iso) => sum + computeDailyDeepWorkMinutes(days[iso]),
    0,
  )
  return totalMinutes / 60
}

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

