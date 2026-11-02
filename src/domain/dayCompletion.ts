/**
 * domain/dayCompletion.ts
 *
 * How much of the day's plan is done, in planned minutes.
 *
 * Each root task is worth its duration; a task without one counts as
 * DEFAULT_TASK_DURATION_MINUTES, and the header says how many were counted
 * that way, so the denominator is never a silent guess. A leaf earns all of
 * its minutes when ticked. A task with subtasks earns its minutes in
 * proportion to the subtask minutes done, and its own tick is ignored: the
 * subtasks are the work.
 *
 * Restored from the pre-rewrite scoring (a2aa4da, `computePoints`) without
 * the section weights and the subtask bonus, so the number is minutes a
 * person can read rather than points.
 *
 * Abandoned tasks are not in `DayState.tasks` (abandoning moves them to
 * `abandonedTasks`), so they leave the plan rather than count as undone.
 */

import type { Task } from './types'
import { DEFAULT_TASK_DURATION_MINUTES } from './durations'

export interface DayCompletion {
  plannedMinutes: number
  /** May be fractional when a task with subtasks is part done. */
  doneMinutes: number
  /** 0..1; 0 when nothing is planned. */
  ratio: number
  rootCount: number
  /** Roots that earned all of their minutes. */
  doneRootCount: number
  /** Roots without a duration, counted as DEFAULT_TASK_DURATION_MINUTES. */
  unestimatedCount: number
}

function minutesOf(task: Task): number {
  const value = task.durationMinutes
  return value != null && Number.isFinite(value) && value >= 0 ? value : DEFAULT_TASK_DURATION_MINUTES
}

function hasDuration(task: Task): boolean {
  const value = task.durationMinutes
  return value != null && Number.isFinite(value) && value >= 0
}

export function computeDayCompletion(tasks: Task[]): DayCompletion {
  const children = new Map<string, Task[]>()
  const roots: Task[] = []
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = children.get(task.parentId) ?? []
      siblings.push(task)
      children.set(task.parentId, siblings)
    } else {
      roots.push(task)
    }
  }

  let plannedMinutes = 0
  let doneMinutes = 0
  let doneRootCount = 0
  let unestimatedCount = 0

  for (const root of roots) {
    const worth = minutesOf(root)
    if (!hasDuration(root)) unestimatedCount += 1
    plannedMinutes += worth

    const subtasks = children.get(root.id) ?? []
    let doneShare: number
    if (subtasks.length === 0) {
      doneShare = root.isDone ? 1 : 0
    } else {
      const total = subtasks.reduce((sum, s) => sum + minutesOf(s), 0)
      const done = subtasks.filter((s) => s.isDone).reduce((sum, s) => sum + minutesOf(s), 0)
      doneShare = total > 0 ? done / total : subtasks.every((s) => s.isDone) ? 1 : 0
    }
    doneMinutes += worth * doneShare
    if (doneShare >= 1) doneRootCount += 1
  }

  const ratio = plannedMinutes > 0 ? Math.min(1, doneMinutes / plannedMinutes) : 0

  return {
    plannedMinutes,
    doneMinutes,
    ratio,
    rootCount: roots.length,
    doneRootCount,
    unestimatedCount,
  }
}

export interface GaugeFigures {
  /** Whole minutes done, floored and never above `planned`. */
  done: number
  /** Whole minutes planned. */
  planned: number
  /** 0..100, the exact floor of done over planned. */
  percent: number
}

/**
 * What the header gauge shows. Integer arithmetic on purpose: 145 of 250 is
 * 58%, but `Math.floor(0.58 * 100)` is 57 because 0.58 is 57.999… in floating
 * point. Done is floored, so the gauge never reads full before the day is.
 */
export function gaugeFigures(completion: Pick<DayCompletion, 'plannedMinutes' | 'doneMinutes'>): GaugeFigures {
  const planned = Math.max(0, Math.round(completion.plannedMinutes))
  const done = Math.max(0, Math.min(planned, Math.floor(completion.doneMinutes + 1e-9)))
  const percent = planned > 0 ? Math.floor((done * 100) / planned) : 0
  return { done, planned, percent }
}

/** "3 hours 30", "1 hour", "45 minutes", "0 minutes": for screen readers. */
export function minutesInWords(minutes: number): string {
  const whole = Math.round(minutes)
  if (whole < 60) return `${whole} ${whole === 1 ? 'minute' : 'minutes'}`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  const head = `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  return rest === 0 ? head : `${head} ${rest}`
}
