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
    // Hand-logged entries live in the same list; they are not earned.
    if (isManualSession(session)) continue
    const minutes = Math.floor(session.durationMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) continue
    total += minutes
  }
  return total
}

/** A session someone wrote down rather than one a countdown measured. */
export function isManualSession(session: DeepWorkSession): boolean {
  return session.source === 'manual'
}

/**
 * Sum the minutes claimed by hand against a task.
 *
 * Two places, one number. Entries logged since hand-logged time became a
 * session live in `sessions` and carry when they were claimed; the bare total
 * that used to sit on the task itself is still read so old days keep their
 * rows. Nothing writes the legacy field any more, so the second term only ever
 * shrinks.
 */
export function computeManualMinutesForTask(
  taskId: string,
  sessions: DeepWorkSession[],
  legacyMinutes?: number,
): number {
  let total = 0
  for (const session of sessions) {
    if (session.taskId !== taskId) continue
    if (session.cancelledAt) continue
    if (!isManualSession(session)) continue
    const minutes = Math.floor(session.durationMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) continue
    total += minutes
  }
  const legacy = Math.floor(legacyMinutes ?? 0)
  if (Number.isFinite(legacy) && legacy > 0) total += legacy
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
  const manualMinutes = computeManualMinutesForTask(task.id, sessions, task.manualLoggedMinutes)
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

/**
 * Minutes between two "HH:MM" clock times, or null when the pair says nothing
 * usable.
 *
 * Used for hand-logging a stretch of work by the times it actually ran between,
 * which is how anyone remembers time spent away from the desk. An end before
 * the start is read as a stretch that ran past midnight - a late block
 * genuinely does - rather than rejected as backwards.
 */
export function parseClockRangeMinutes(from: string, to: string): number | null {
  const start = parseClock(from)
  const end = parseClock(to)
  if (start == null || end == null) return null
  // Identical times are a half-finished entry, not a 24-hour stretch.
  if (start === end) return null
  return end > start ? end - start : end + 24 * 60 - start
}

/** "HH:MM" as minutes past midnight, or null when it is not a clock time. */
function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  return hours * 60 + mins
}

/**
 * The amounts a person can hand-log in one go, counted in the blocks the task
 * was actually planned as.
 *
 * People do not remember unwatched work in minutes, they remember it in
 * sittings: "I set aside eight blocks for this and got through two". So the
 * choice offered is over the row already on screen - block 1, blocks 1-2, ...
 * up to everything still empty - and each option carries the minutes those
 * blocks really hold. The trailing block of a task that is not a whole number
 * of blocks carries its remainder, so "all of it" lands exactly on the estimate
 * instead of overshooting it.
 *
 * `overflowBlocks` appends whole blocks past the plan, for the case the
 * estimate was simply short. Zero of them is the right choice anywhere the
 * question is "how much of what you allocated did you do".
 */
export interface BlockAmountOption {
  /** Blocks covered, 1-based - the nth option covers the first n empty blocks. */
  blocks: number
  /** Minutes logging this option would add. */
  minutes: number
  /** True once the option runs past the planned duration. */
  isOverflow: boolean
}

export function blockAmountOptions(
  progress: TaskProgress,
  overflowBlocks = 0,
): BlockAmountOption[] {
  const options: BlockAmountOption[] = []
  let running = 0
  for (const slot of progress.slots) {
    if (slot.isOverflow) continue
    const room = slot.capacityMinutes - slot.timerMinutes - slot.manualMinutes
    if (room <= 0) continue
    running += room
    options.push({ blocks: options.length + 1, minutes: running, isOverflow: false })
  }
  for (let i = 0; i < overflowBlocks; i += 1) {
    running += progress.blockMinutes
    options.push({ blocks: options.length + 1, minutes: running, isOverflow: true })
  }
  return options
}

/**
 * The real instants behind a hand-logged clock range, on the day the task
 * belongs to.
 *
 * Only built when the person actually gave both times. A stretch logged in
 * blocks has no known interval and gets none invented for it - the entry
 * records when it was claimed and nothing more.
 *
 * The end is derived from the start plus the measured duration rather than
 * parsed separately, so a stretch that ran past midnight lands on the next day
 * instead of ending before it began.
 */
export function manualIntervalFromClockRange(
  dayIso: string,
  from: string,
  to: string,
): { startedAt: string; finishedAt: string } | null {
  const minutes = parseClockRangeMinutes(from, to)
  if (minutes == null || minutes <= 0) return null
  const startMinutes = parseClock(from)
  if (startMinutes == null) return null
  const parts = dayIso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const start = new Date(parts[0]!, parts[1]! - 1, parts[2]!, 0, startMinutes, 0, 0)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + minutes * 60_000)
  return { startedAt: start.toISOString(), finishedAt: end.toISOString() }
}

/**
 * Take hand-logged minutes back off a task, newest entry first.
 *
 * Newest first because taking time back is nearly always undoing what you just
 * said, not editing something from this morning. An entry only partly taken
 * back keeps the rest, and loses its `finishedAt`: half of a stretch that ran
 * seven to nine is no longer a stretch that ran seven to nine, and a record
 * that quietly keeps claiming it would be a lie the UI would happily draw.
 *
 * Earned sessions are never touched. The caller applies `legacyRemainder` to
 * the old per-task total, which is the only place minutes can still be after
 * the entries run out.
 */
export function withdrawManualMinutes(
  sessions: readonly DeepWorkSession[],
  taskId: string,
  minutes: number,
): { sessions: DeepWorkSession[]; legacyRemainder: number } {
  let left = Math.max(0, Math.floor(minutes))
  if (left === 0) return { sessions: [...sessions], legacyRemainder: 0 }

  const next = [...sessions]
  for (let i = next.length - 1; i >= 0 && left > 0; i -= 1) {
    const session = next[i]!
    if (session.taskId !== taskId) continue
    if (session.cancelledAt || !isManualSession(session)) continue
    const held = Math.max(0, Math.floor(session.durationMinutes))
    if (held === 0) continue
    if (held <= left) {
      next.splice(i, 1)
      left -= held
      continue
    }
    const { finishedAt: _dropped, ...rest } = session
    next[i] = { ...rest, durationMinutes: held - left }
    left = 0
  }

  return { sessions: next, legacyRemainder: left }
}

/** One thing a person logged by hand, in the order they logged it. */
export interface ManualLogEntry {
  /** The session's id, or `legacy` for the pre-entry per-task total. */
  id: string
  minutes: number
  /** When the claim was made, when that is known. */
  loggedAt?: string
  /** The real interval worked, when the person gave one. */
  startedAt?: string
  finishedAt?: string
  /** True for the old per-task total, which is one lump with no history. */
  isLegacy: boolean
}

/**
 * Everything hand-logged against a task, oldest first.
 *
 * The legacy per-task total comes first and as a single entry, because that is
 * exactly what it is: one number with no history behind it. Real entries follow
 * in the order they were recorded, so "the last thing I logged" is the last of
 * these - which is what an undo should take back, in one go, however many
 * blocks it happened to cover.
 */
export function listManualEntries(
  taskId: string,
  sessions: readonly DeepWorkSession[],
  legacyMinutes?: number,
): ManualLogEntry[] {
  const entries: ManualLogEntry[] = []
  const legacy = Math.floor(legacyMinutes ?? 0)
  if (Number.isFinite(legacy) && legacy > 0) {
    entries.push({ id: 'legacy', minutes: legacy, isLegacy: true })
  }
  for (const session of sessions) {
    if (session.taskId !== taskId) continue
    if (session.cancelledAt || !isManualSession(session)) continue
    const minutes = Math.floor(session.durationMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) continue
    entries.push({
      id: session.id,
      minutes,
      loggedAt: session.loggedAt,
      // Only a stretch with both ends knows the interval it covered.
      ...(session.finishedAt ? { startedAt: session.startedAt, finishedAt: session.finishedAt } : {}),
      isLegacy: false,
    })
  }
  return entries
}
