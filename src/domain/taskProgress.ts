/**
 * domain/taskProgress.ts
 *
 * Turns a task's planned duration into a row of focus blocks, and works out how
 * much of each block has actually been filled.
 *
 * One slot is one focus block, which is one run of the deep work timer. That is
 * the whole idea: the row is not a ruler laid over a duration, it is the list of
 * sittings the task needs, and each empty one can be started. The block length
 * is a setting (`AppState.focusBlockMinutes`) rather than a constant, so a
 * 45-minute task under a 45-minute block is exactly one slot instead of a
 * 30-slot next to a 15-slot drawn the same width.
 *
 * Minutes stay the stored truth. A duration that is not a whole number of
 * blocks still renders honestly - the trailing slot carries the remainder and
 * the UI draws it narrow, in proportion - so changing the block length
 * re-buckets existing history without a migration and without lying about it.
 *
 * The point of the split between timer minutes and manual minutes is honesty.
 * Timer minutes are earned: they come from DayState.deepWorkSessions, which is
 * only ever written when a real countdown finishes, and are attributed here by
 * DeepWorkSession.taskId. Manual minutes are self-reported and live on the task
 * itself. Both fill slots, but the UI renders them differently, so a glance at
 * a task never confuses "I worked three hours" with "I claimed three hours".
 *
 * Timer minutes always fill from the left, ahead of manual minutes, so the
 * earned portion of a row is one contiguous run starting at block 1.
 */

import type { DeepWorkSession, Task } from './types'
import { DEFAULT_FOCUS_BLOCK_MINUTES, normalizeFocusBlockMinutes } from './focusBlocks'

/**
 * The shortest task that gets a progress row. A block always earns one, and
 * below half an hour nothing does - a 20-minute errand does not need a
 * progress bar, and a single slot that means "20 min" reads as a lie.
 */
export function minTrackableMinutes(blockMinutes: number): number {
  return Math.min(normalizeFocusBlockMinutes(blockMinutes), 30)
}

/** Trackability threshold at the default block length, for callers without one. */
export const MIN_TRACKABLE_MINUTES = minTrackableMinutes(DEFAULT_FOCUS_BLOCK_MINUTES)

/** Above this many slots the UI collapses the row into a single segmented bar. */
export const MAX_INLINE_SLOTS = 8

export interface TaskProgressSlot {
  /** Minutes this block represents (a full block, or the remainder for a trailing one). */
  capacityMinutes: number
  /** Earned minutes sitting in this block. */
  timerMinutes: number
  /** Hand-logged minutes sitting in this block. */
  manualMinutes: number
  /** 0-1, how full the block is. */
  filledRatio: number
  /** 0-1 of a full block, so a short trailing block can be drawn narrow. */
  widthRatio: number
  /** True for blocks past the planned duration (logged more than estimated). */
  isOverflow: boolean
}

export interface TaskProgress {
  slots: TaskProgressSlot[]
  /** The block length this row was built against. */
  blockMinutes: number
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
 * (no duration, or a duration too short to be worth a row).
 */
export function computeTaskProgress(
  task: Task,
  sessions: DeepWorkSession[],
  blockMinutesInput: number = DEFAULT_FOCUS_BLOCK_MINUTES,
): TaskProgress | null {
  const blockMinutes = normalizeFocusBlockMinutes(blockMinutesInput)
  const goalMinutes = Math.floor(task.durationMinutes ?? 0)
  if (!Number.isFinite(goalMinutes) || goalMinutes < minTrackableMinutes(blockMinutes)) return null

  const timerMinutes = computeTimerMinutesForTask(task.id, sessions)
  const rawManual = Math.floor(task.manualLoggedMinutes ?? 0)
  const manualMinutes = Number.isFinite(rawManual) && rawManual > 0 ? rawManual : 0
  const totalMinutes = timerMinutes + manualMinutes

  const slots = buildSlots(goalMinutes, totalMinutes, blockMinutes)
  fill(slots, timerMinutes, 'timerMinutes')
  fill(slots, manualMinutes, 'manualMinutes')
  for (const slot of slots) {
    slot.filledRatio = slot.capacityMinutes === 0
      ? 0
      : Math.min(1, (slot.timerMinutes + slot.manualMinutes) / slot.capacityMinutes)
  }

  return {
    slots,
    blockMinutes,
    timerMinutes,
    manualMinutes,
    totalMinutes,
    goalMinutes,
    isOverflowing: totalMinutes > goalMinutes,
    isComplete: totalMinutes >= goalMinutes,
  }
}

/**
 * Blocks covering the planned duration, plus overflow blocks for anything
 * logged beyond it. The last planned block holds the remainder, so at a 45-min
 * block a 60-min task is a full block and a 15-min one rather than two blocks
 * that pretend to be an hour and a half.
 */
function buildSlots(goalMinutes: number, totalMinutes: number, blockMinutes: number): TaskProgressSlot[] {
  const slots: TaskProgressSlot[] = []
  for (let remaining = goalMinutes; remaining > 0; remaining -= blockMinutes) {
    slots.push(emptySlot(Math.min(blockMinutes, remaining), blockMinutes, false))
  }
  for (let over = totalMinutes - goalMinutes; over > 0; over -= blockMinutes) {
    slots.push(emptySlot(blockMinutes, blockMinutes, true))
  }
  return slots
}

function emptySlot(capacityMinutes: number, blockMinutes: number, isOverflow: boolean): TaskProgressSlot {
  return {
    capacityMinutes,
    timerMinutes: 0,
    manualMinutes: 0,
    filledRatio: 0,
    widthRatio: blockMinutes > 0 ? Math.min(1, capacityMinutes / blockMinutes) : 1,
    isOverflow,
  }
}

/** Pour a pool of minutes into the blocks left to right, filling each to capacity. */
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
