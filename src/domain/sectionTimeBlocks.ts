/**
 * domain/sectionTimeBlocks.ts
 *
 * Time-of-day ranges for each section block. Used to highlight the current
 * block (e.g. Morning routine 5-9, Focus 9-5) so the user sees which part of
 * the day they are in. All times are local; minutes since midnight (0-1439).
 *
 * Two modes:
 * 1. Static blocks (BLOCKS constant) shifted by a global timeOffsetMinutes (±5h).
 * 2. Per-day computed blocks via computeBlocksFromWakeSleep(), which derive all
 *    four section boundaries from the user's actual wake and sleep times.
 *    When computed blocks are provided, they shadow the static BLOCKS array.
 */

import type { TaskSectionId } from './types'

/** Minutes since midnight. Ranges are [start, end) (end exclusive). */
const MINS = {
  h5: 5 * 60,   // 300
  h9: 9 * 60,   // 540
  h17: 17 * 60, // 1020
  h21: 21 * 60, // 1260
  h23: 23 * 60, // 1380
} as const

/** Time blocks: [startMin, endMin) and section id(s). */
const BLOCKS: { start: number; end: number; sectionIds: TaskSectionId[] }[] = [
  { start: MINS.h5,  end: MINS.h9,   sectionIds: ['morningRoutine'] },
  { start: MINS.h9,  end: MINS.h17,  sectionIds: ['highPriority'] },
  { start: MINS.h17, end: MINS.h21,  sectionIds: ['mediumPriority', 'lowPriority'] },
  { start: MINS.h21, end: MINS.h23,  sectionIds: ['nightRoutine'] },
]

export type DayBlocks = { start: number; end: number; sectionIds: TaskSectionId[] }[]

/**
 * Derive four dynamic time blocks from a wake time and sleep target.
 * Both inputs are "HH:MM" 24-hour strings (same format as Task.scheduledAt).
 * Layout:
 *   morningRoutine: wakeTime → wakeTime + 2h
 *   highPriority:   wakeTime + 2h → midpoint of awake window
 *   medium+low:     midpoint → sleepTarget - 2h
 *   nightRoutine:   sleepTarget - 2h → sleepTarget
 */
export function computeBlocksFromWakeSleep(
  wakeTimeHHMM: string,
  sleepTargetHHMM: string,
): DayBlocks {
  const wakeMin = parseHHMM(wakeTimeHHMM)
  const rawSleep = parseHHMM(sleepTargetHHMM)
  // Handle post-midnight sleep (e.g. wake 6AM, sleep 1AM next day)
  const sleepMin = rawSleep <= wakeMin ? rawSleep + 1440 : rawSleep
  const awake = Math.min(sleepMin - wakeMin, 1439)

  // Proportional allocation so blocks never collapse to zero width.
  // For normal days (16h) this produces the same 2h / ~6h / ~6h / 2h split.
  // Caps: morning ≤ 2h, night ≤ 2h. Minimum per block: 30 min.
  const morningDur = Math.max(30, Math.min(120, Math.floor(awake * 0.20)))
  const nightDur   = Math.max(30, Math.min(120, Math.floor(awake * 0.15)))
  const focusDur   = Math.max(0, awake - morningDur - nightDur)
  const highDur    = Math.floor(focusDur / 2)

  const morningEnd  = wrapMinutes(wakeMin + morningDur)
  const midpoint    = wrapMinutes(wakeMin + morningDur + highDur)
  const nightStart  = wrapMinutes(sleepMin - nightDur)

  return [
    { start: wakeMin % 1440, end: morningEnd,       sectionIds: ['morningRoutine'] },
    { start: morningEnd,     end: midpoint,          sectionIds: ['highPriority'] },
    { start: midpoint,       end: nightStart,        sectionIds: ['mediumPriority', 'lowPriority'] },
    { start: nightStart,     end: sleepMin % 1440,   sectionIds: ['nightRoutine'] },
  ]
}

/** Clamp offset so helpers behave even if callers pass something wild. */
function clampOffsetMinutes(offsetMinutes: number | undefined): number {
  if (typeof offsetMinutes !== 'number' || Number.isNaN(offsetMinutes)) return 0
  const MAX = 5 * 60
  return Math.max(-MAX, Math.min(MAX, Math.trunc(offsetMinutes)))
}

/** Wrap minutes into the 0-1439 range. */
function wrapMinutes(minutes: number): number {
  const m = minutes % (24 * 60)
  return m < 0 ? m + 24 * 60 : m
}

/** Parse "HH:MM" string to minutes since midnight. */
function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function formatTimeOfDay(minutes: number): string {
  const mins = wrapMinutes(minutes)
  const hours24 = Math.floor(mins / 60)
  const minsPart = mins % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const minsStr = minsPart === 0 ? '' : `:${String(minsPart).padStart(2, '0')}`
  return `${hours12}${minsStr} ${period}`
}

function getSectionBlock(sectionId: TaskSectionId): { start: number; end: number } | null {
  for (const block of BLOCKS) {
    if (block.sectionIds.includes(sectionId)) {
      return { start: block.start, end: block.end }
    }
  }
  return null
}

/**
 * Sleep block: 11 PM - 5 AM (crosses midnight) in the default schedule.
 * When computed blocks are provided, sleep is the gap between the last block's
 * end and the first block's start (i.e. sleepTarget → wakeTime).
 */
export function isSleepTime(
  currentMinutes: number,
  timeOffsetMinutes?: number,
  blocks?: DayBlocks,
): boolean {
  if (blocks && blocks.length > 0) {
    const first = blocks[0]!
    const last = blocks[blocks.length - 1]!
    // Sleep window: last.end → first.start (may cross midnight)
    const sleepStart = last.end
    const wakeStart = first.start
    const adjusted = wrapMinutes(currentMinutes)
    if (sleepStart > wakeStart) {
      // Sleep does not cross midnight
      return adjusted >= sleepStart || adjusted < wakeStart
    } else {
      // Sleep crosses midnight
      return adjusted >= sleepStart && adjusted < wakeStart
    }
  }
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const adjusted = wrapMinutes(currentMinutes - offset)
  return adjusted >= MINS.h23 || adjusted < MINS.h5
}

/**
 * Section ids for which the current time falls inside their block.
 * When computed blocks are provided (from computeBlocksFromWakeSleep), they
 * are used instead of the static BLOCKS. timeOffsetMinutes is ignored when
 * computed blocks are active (the blocks are already absolute times).
 */
export function getActiveSectionIds(
  currentMinutes: number,
  timeOffsetMinutes?: number,
  blocks?: DayBlocks,
): TaskSectionId[] {
  if (blocks && blocks.length > 0) {
    if (isSleepTime(currentMinutes, timeOffsetMinutes, blocks)) return []
    const adjusted = wrapMinutes(currentMinutes)
    for (const block of blocks) {
      if (block.start <= block.end) {
        if (adjusted >= block.start && adjusted < block.end) return block.sectionIds
      } else {
        // Block crosses midnight
        if (adjusted >= block.start || adjusted < block.end) return block.sectionIds
      }
    }
    return []
  }
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const adjusted = wrapMinutes(currentMinutes - offset)
  if (isSleepTime(currentMinutes, timeOffsetMinutes)) return []
  for (const block of BLOCKS) {
    if (adjusted >= block.start && adjusted < block.end) {
      return block.sectionIds
    }
  }
  return []
}

/** Human-readable sleep window for UI, respecting computed blocks or global offset. */
export function getSleepWindowLabel(timeOffsetMinutes?: number, blocks?: DayBlocks): string {
  if (blocks && blocks.length > 0) {
    const first = blocks[0]!
    const last = blocks[blocks.length - 1]!
    return `${formatTimeOfDay(last.end)} - ${formatTimeOfDay(first.start)}`
  }
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const start = wrapMinutes(MINS.h23 + offset)
  const end = wrapMinutes(MINS.h5 + offset)
  return `${formatTimeOfDay(start)} - ${formatTimeOfDay(end)}`
}

/** Human-readable timeframe for a specific section (or null if untimed). */
export function getSectionTimeframeLabel(
  sectionId: TaskSectionId,
  timeOffsetMinutes?: number,
  blocks?: DayBlocks,
): string | null {
  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      if (block.sectionIds.includes(sectionId)) {
        return `${formatTimeOfDay(block.start)} - ${formatTimeOfDay(block.end)}`
      }
    }
    return null
  }
  const base = getSectionBlock(sectionId)
  if (!base) return null
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const start = wrapMinutes(base.start + offset)
  const end = wrapMinutes(base.end + offset)
  return `${formatTimeOfDay(start)} - ${formatTimeOfDay(end)}`
}
