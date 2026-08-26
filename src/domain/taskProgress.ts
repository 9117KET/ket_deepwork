/**
 * domain/taskProgress.ts
 *
 * Turns a task's planned duration into a row of 30-minute progress boxes, and
 * works out how much of each box has actually been filled.
 *
 * The point of the split between timer minutes and manual minutes is honesty.
 * Timer minutes are earned: they come from DayState.deepWorkSessions, which is
 * only ever written when a real countdown finishes, and are attributed here by
 * DeepWorkSession.taskId. Manual minutes are self-reported and live on the task
 * itself. Both fill boxes, but the UI renders them differently, so a glance at
 * a task never confuses "I worked three hours" with "I claimed three hours".
 *
 * Timer minutes always fill from the left, ahead of manual minutes, so the
 * earned portion of a row is one contiguous run starting at box 1.
 */

import type { DeepWorkSession, Task } from './types'

/** One progress box. Boxes are 30 minutes except the last, which holds the remainder. */
export const SLOT_MINUTES = 30

/**
 * Below this, a task gets no boxes at all - a 20-minute errand doesn't need a
 * progress bar, and a single box that means "20 min" reads as a lie.
 */
export const MIN_TRACKABLE_MINUTES = SLOT_MINUTES

/** Above this many boxes the UI collapses the row into a single segmented bar. */
export const MAX_INLINE_SLOTS = 6

export interface TaskProgressSlot {
  /** Minutes this box represents (30, or the remainder for a trailing box). */
  capacityMinutes: number
  /** Earned minutes sitting in this box. */
  timerMinutes: number
  /** Hand-logged minutes sitting in this box. */
  manualMinutes: number
  /** 0-1, how full the box is. */
  filledRatio: number
  /** True for boxes past the planned duration (logged more than estimated). */
  isOverflow: boolean
}

export interface TaskProgress {
  slots: TaskProgressSlot[]
  /** Minutes earned via the deep work timer. */
  timerMinutes: number
  /** Minutes logged by hand. */
  manualMinutes: number
  totalMinutes: number
  /** The task's planned duration. */
  goalMinutes: number
  /** Logged more than planned - the estimate was wrong, and that stays visible. */
  isOverflowing: boolean
  isComplete: boolean
}

/**
 * Sum the timer minutes credited to a task. Only sessions that finished count:
 * a cancelled session earned nothing.
 *
 * `sessions` should be the sessions of the task's own day. Cross-day
 * attribution is deliberately not supported - a task belongs to a day, and so
 * does the work done on it.
 */
export function computeTimerMinutesForTask(taskId: string, sessions: DeepWorkSession[]): number {
  let total = 0
  for (const session of sessions) {
    if (session.taskId !== taskId) continue
    if (session.cancelledAt) continue
    const minutes = Math.floor(session.durationMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) continue
    total += minutes
  }
  return total
}

/**
 * Build the progress row for a task, or null when the task is not trackable
 * (no duration, or a duration too short to be worth boxing).
 */
export function computeTaskProgress(task: Task, sessions: DeepWorkSession[]): TaskProgress | null {
  const goalMinutes = Math.floor(task.durationMinutes ?? 0)
  if (!Number.isFinite(goalMinutes) || goalMinutes < MIN_TRACKABLE_MINUTES) return null

  const timerMinutes = computeTimerMinutesForTask(task.id, sessions)
  const rawManual = Math.floor(task.manualLoggedMinutes ?? 0)
  const manualMinutes = Number.isFinite(rawManual) && rawManual > 0 ? rawManual : 0
  const totalMinutes = timerMinutes + manualMinutes

  const slots = buildSlots(goalMinutes, totalMinutes)
  fill(slots, timerMinutes, 'timerMinutes')
  fill(slots, manualMinutes, 'manualMinutes')
  for (const slot of slots) {
    slot.filledRatio = slot.capacityMinutes === 0
      ? 0
      : Math.min(1, (slot.timerMinutes + slot.manualMinutes) / slot.capacityMinutes)
  }

  return {
    slots,
    timerMinutes,
    manualMinutes,
    totalMinutes,
    goalMinutes,
    isOverflowing: totalMinutes > goalMinutes,
    isComplete: totalMinutes >= goalMinutes,
  }
}

/**
 * Boxes covering the planned duration, plus overflow boxes for anything logged
 * beyond it. The last planned box holds the remainder, so 45 min is a 30 box
 * and a 15 box rather than two boxes that pretend to be an hour.
 */
function buildSlots(goalMinutes: number, totalMinutes: number): TaskProgressSlot[] {
  const slots: TaskProgressSlot[] = []
  for (let remaining = goalMinutes; remaining > 0; remaining -= SLOT_MINUTES) {
    slots.push(emptySlot(Math.min(SLOT_MINUTES, remaining), false))
  }
  for (let over = totalMinutes - goalMinutes; over > 0; over -= SLOT_MINUTES) {
    slots.push(emptySlot(SLOT_MINUTES, true))
  }
  return slots
}

function emptySlot(capacityMinutes: number, isOverflow: boolean): TaskProgressSlot {
  return { capacityMinutes, timerMinutes: 0, manualMinutes: 0, filledRatio: 0, isOverflow }
}

/** Pour a pool of minutes into the boxes left to right, filling each to capacity. */
function fill(slots: TaskProgressSlot[], pool: number, key: 'timerMinutes' | 'manualMinutes'): void {
  let left = pool
  for (const slot of slots) {
    if (left <= 0) return
    const used = slot.timerMinutes + slot.manualMinutes
    const room = slot.capacityMinutes - used
    if (room <= 0) continue
    const take = Math.min(room, left)
    slot[key] += take
    left -= take
  }
}

/**
 * Human-readable summary for tooltips and aria-labels, e.g.
 * "1h30 of 3h logged - 1h by timer, 30m by hand".
 */
export function describeTaskProgress(progress: TaskProgress): string {
  const head = `${formatMinutes(progress.totalMinutes)} of ${formatMinutes(progress.goalMinutes)} logged`
  const parts: string[] = []
  if (progress.timerMinutes > 0) parts.push(`${formatMinutes(progress.timerMinutes)} by timer`)
  if (progress.manualMinutes > 0) parts.push(`${formatMinutes(progress.manualMinutes)} by hand`)
  return parts.length > 0 ? `${head} - ${parts.join(', ')}` : head
}

/** 90 -> "1h30", 60 -> "1h", 45 -> "45m". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`
}
