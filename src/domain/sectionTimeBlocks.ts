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

import type { TaskSectionId, BlockDurations, BlockDurationRatios } from './types'

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
 * Derive five dynamic time blocks from a wake time and sleep target.
 * Medium and Low priority are now separate blocks (2:1 time split).
 * Layout:
 *   morningRoutine: wakeTime → wakeTime + ~20% awake
 *   highPriority:   next ~30% of awake window
 *   mediumPriority: next ~20% (2/3 of the old combined mid block)
 *   lowPriority:    next ~10% (1/3 of the old combined mid block)
 *   nightRoutine:   last ~15% up to sleepTarget
 */
export function computeBlocksFromWakeSleep(
  wakeTimeHHMM: string,
  sleepTargetHHMM: string,
): DayBlocks {
  const wakeMin = parseHHMM(wakeTimeHHMM)
  const rawSleep = parseHHMM(sleepTargetHHMM)
  const sleepMin = rawSleep <= wakeMin ? rawSleep + 1440 : rawSleep
  const awake = Math.min(sleepMin - wakeMin, 1439)

  const morningDur = Math.max(30, Math.min(120, Math.floor(awake * 0.20)))
  const nightDur   = Math.max(30, Math.min(120, Math.floor(awake * 0.15)))
  const focusDur   = Math.max(0, awake - morningDur - nightDur)
  const highDur    = Math.floor(focusDur / 2)
  const midLowDur  = focusDur - highDur
  const mediumDur  = Math.max(15, Math.floor(midLowDur * 2 / 3))
  const lowDur     = Math.max(15, midLowDur - mediumDur)

  let cursor = wakeMin
  const next = (dur: number) => { const s = cursor; cursor += dur; return { s, e: wrapMinutes(cursor) } }
  const morning = next(morningDur)
  const high    = next(highDur)
  const medium  = next(mediumDur)
  const low     = next(lowDur)
  const night   = next(nightDur)

  return [
    { start: wakeMin % 1440, end: morning.e, sectionIds: ['morningRoutine'] },
    { start: morning.e,      end: high.e,    sectionIds: ['highPriority'] },
    { start: high.e,         end: medium.e,  sectionIds: ['mediumPriority'] },
    { start: medium.e,       end: low.e,     sectionIds: ['lowPriority'] },
    { start: low.e,          end: night.e,   sectionIds: ['nightRoutine'] },
  ]
}

/**
 * Compute blocks from manually set per-block durations.
 * Used when the user has overridden the auto-computed allocation.
 */
export function computeBlocksFromDurations(
  wakeTimeHHMM: string,
  durations: BlockDurations,
): DayBlocks {
  const wakeMin = parseHHMM(wakeTimeHHMM)
  let cursor = wakeMin
  const order: [TaskSectionId, number][] = [
    ['morningRoutine', durations.morningRoutine],
    ['highPriority',   durations.highPriority],
    ['mediumPriority', durations.mediumPriority],
    ['lowPriority',    durations.lowPriority],
    ['nightRoutine',   durations.nightRoutine],
  ]
  return order.map(([sectionId, dur]) => {
    const start = wrapMinutes(cursor)
    cursor += dur
    const end = wrapMinutes(cursor)
    return { start, end, sectionIds: [sectionId] }
  })
}

/** Extract default block durations (minutes) from auto-computed blocks. */
export function getDefaultBlockDurations(
  wakeTimeHHMM: string,
  sleepTargetHHMM: string,
): BlockDurations {
  const blocks = computeBlocksFromWakeSleep(wakeTimeHHMM, sleepTargetHHMM)
  const dur = (b: { start: number; end: number }) =>
    b.end >= b.start ? b.end - b.start : b.end + 1440 - b.start
  return {
    morningRoutine: dur(blocks[0]!),
    highPriority:   dur(blocks[1]!),
    mediumPriority: dur(blocks[2]!),
    lowPriority:    dur(blocks[3]!),
    nightRoutine:   dur(blocks[4]!),
  }
}

/** Length of the awake window in minutes (wake → sleep target). */
export function computeAwakeMinutes(wakeTimeHHMM: string, sleepTargetHHMM: string): number {
  const wakeMin = parseHHMM(wakeTimeHHMM)
  const rawSleep = parseHHMM(sleepTargetHHMM)
  const sleepMin = rawSleep <= wakeMin ? rawSleep + 1440 : rawSleep
  return Math.min(sleepMin - wakeMin, 1439)
}

export function blockDurationsToRatios(d: BlockDurations): BlockDurationRatios {
  const sum = BLOCK_ORDER.reduce((acc, k) => acc + d[k], 0)
  if (sum <= 0) {
    return {
      morningRoutine: 0.2,
      highPriority: 0.3,
      mediumPriority: 0.2,
      lowPriority: 0.1,
      nightRoutine: 0.2,
    }
  }
  return {
    morningRoutine: d.morningRoutine / sum,
    highPriority: d.highPriority / sum,
    mediumPriority: d.mediumPriority / sum,
    lowPriority: d.lowPriority / sum,
    nightRoutine: d.nightRoutine / sum,
  }
}

/**
 * Turn fractional split into integer minutes per block that sum exactly to `awakeMinutes`
 * while respecting each block minimum.
 */
export function ratiosToBlockDurations(
  ratios: BlockDurationRatios,
  awakeMinutes: number,
): BlockDurations {
  const keys = BLOCK_ORDER
  const ideal = keys.map((k) => ratios[k] * awakeMinutes)
  const d = {} as BlockDurations
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!
    d[k] = Math.max(BLOCK_MIN_MINUTES[k], Math.round(ideal[i]!))
  }
  const sum = keys.reduce((acc, k) => acc + d[k], 0)
  let diff = awakeMinutes - sum
  let guard = 0
  while (diff !== 0 && guard < 5000) {
    guard++
    if (diff > 0) {
      let best: keyof BlockDurations | null = null
      let bestSlack = -Infinity
      for (const k of keys) {
        const slack = ideal[keys.indexOf(k)]! - d[k]
        if (slack > bestSlack) {
          bestSlack = slack
          best = k
        }
      }
      if (best) d[best] += 1
      else d.highPriority += 1
      diff -= 1
    } else {
      let best: keyof BlockDurations | null = null
      let bestSlack = -Infinity
      for (const k of keys) {
        if (d[k] <= BLOCK_MIN_MINUTES[k]) continue
        const slack = d[k] - ideal[keys.indexOf(k)]!
        if (slack > bestSlack) {
          bestSlack = slack
          best = k
        }
      }
      if (best) {
        d[best] -= 1
        diff += 1
      } else {
        break
      }
    }
  }
  return d
}

export const BLOCK_MIN_MINUTES: Record<keyof BlockDurations, number> = {
  morningRoutine: 15,
  highPriority:   30,
  mediumPriority: 15,
  lowPriority:    15,
  nightRoutine:   15,
}

export const SLEEP_WARN_MINUTES = 7 * 60   // 420 min -- warn below 7h
export const SLEEP_MIN_MINUTES  = 6 * 60   // 360 min -- hard floor

export const BLOCK_ORDER: (keyof BlockDurations)[] = [
  'morningRoutine', 'highPriority', 'mediumPriority', 'lowPriority', 'nightRoutine',
]

/**
 * Apply a duration change to one block, cascading the delta into adjacent blocks.
 * Returns the updated durations and (if Night Routine changed) updated sleep minutes.
 * Returns null if the change is impossible (would violate sleep minimum).
 */
export function applyBlockDurationChange(
  durations: BlockDurations,
  changedBlock: keyof BlockDurations,
  newDurationMinutes: number,
  currentSleepMinutes: number,
): { durations: BlockDurations; sleepMinutes: number; sleepWarning: boolean } | null {
  const delta = newDurationMinutes - durations[changedBlock]
  if (delta === 0) return { durations, sleepMinutes: currentSleepMinutes, sleepWarning: false }

  const result = { ...durations, [changedBlock]: newDurationMinutes }
  const idx = BLOCK_ORDER.indexOf(changedBlock)
  let remaining = delta

  // Cascade into subsequent day blocks
  for (let i = idx + 1; i < BLOCK_ORDER.length && remaining !== 0; i++) {
    const key = BLOCK_ORDER[i]!
    if (delta > 0) {
      // Growing: shrink next block
      const available = result[key] - BLOCK_MIN_MINUTES[key]
      const take = Math.min(remaining, available)
      result[key] -= take
      remaining -= take
    } else {
      // Shrinking: grow next block
      result[key] += Math.abs(remaining)
      remaining = 0
    }
  }

  // Overflow into sleep block
  let sleepMinutes = currentSleepMinutes
  if (remaining > 0) {
    // Night Routine (or cascaded change) needs to eat into sleep
    const newSleep = currentSleepMinutes - remaining
    if (newSleep < SLEEP_MIN_MINUTES) return null  // hard floor -- reject
    sleepMinutes = newSleep
  } else if (remaining < 0) {
    // Night Routine shrunk -- give minutes back to sleep (cap at 12h)
    sleepMinutes = Math.min(currentSleepMinutes + Math.abs(remaining), 12 * 60)
  }

  return {
    durations: result,
    sleepMinutes,
    sleepWarning: sleepMinutes < currentSleepMinutes && sleepMinutes < SLEEP_WARN_MINUTES,
  }
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
