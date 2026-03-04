/**
 * domain/sectionTimeBlocks.ts
 *
 * Time-of-day ranges for each section block. Used to highlight the current
 * block (e.g. Morning routine 5–9, Focus 9–5) so the user sees which part of
 * the day they are in. All times are local; minutes since midnight (0–1439).
 *
 * The core block definitions are static, but callers can supply a global
 * timeOffsetMinutes to shift the whole schedule earlier/later (clamped to
 * ±3 hours in the UI). This keeps the math simple while letting users adapt
 * the planner to their real day.
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

/** Clamp offset so helpers behave even if callers pass something wild. */
function clampOffsetMinutes(offsetMinutes: number | undefined): number {
  if (typeof offsetMinutes !== 'number' || Number.isNaN(offsetMinutes)) return 0
  const MAX = 3 * 60
  return Math.max(-MAX, Math.min(MAX, Math.trunc(offsetMinutes)))
}

/** Wrap minutes into the 0–1439 range. */
function wrapMinutes(minutes: number): number {
  const m = minutes % (24 * 60)
  return m < 0 ? m + 24 * 60 : m
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
 * Sleep block: 11 PM – 5 AM (crosses midnight) in the default schedule.
 * timeOffsetMinutes shifts this window earlier/later along with the sections.
 */
export function isSleepTime(currentMinutes: number, timeOffsetMinutes?: number): boolean {
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const adjusted = wrapMinutes(currentMinutes - offset)
  return adjusted >= MINS.h23 || adjusted < MINS.h5
}

/**
 * Section ids for which the current time falls inside their block.
 * Empty during sleep (5–9 AM morning, 9 AM–5 PM high, 5–9 PM medium+low, 9–11 PM night).
 *
 * timeOffsetMinutes shifts the whole schedule; +60 means "treat 6 AM as the
 * default 5 AM morning start", effectively moving all blocks one hour later.
 */
export function getActiveSectionIds(
  currentMinutes: number,
  timeOffsetMinutes?: number,
): TaskSectionId[] {
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

/** Human-readable sleep window for UI, respecting the global offset. */
export function getSleepWindowLabel(timeOffsetMinutes?: number): string {
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const start = wrapMinutes(MINS.h23 + offset)
  const end = wrapMinutes(MINS.h5 + offset)
  return `${formatTimeOfDay(start)} – ${formatTimeOfDay(end)}`
}

/** Human-readable timeframe for a specific section (or null if untimed). */
export function getSectionTimeframeLabel(
  sectionId: TaskSectionId,
  timeOffsetMinutes?: number,
): string | null {
  const base = getSectionBlock(sectionId)
  if (!base) return null
  const offset = clampOffsetMinutes(timeOffsetMinutes)
  const start = wrapMinutes(base.start + offset)
  const end = wrapMinutes(base.end + offset)
  return `${formatTimeOfDay(start)} – ${formatTimeOfDay(end)}`
}
