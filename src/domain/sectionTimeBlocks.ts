/**
 * domain/sectionTimeBlocks.ts
 *
 * Time-of-day ranges for each section block. Used to highlight the current
 * block (e.g. Morning routine 5–9, Focus 9–5) so the user sees which part of
 * the day they are in. All times are local; minutes since midnight (0–1439).
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

/** Time blocks: [startMin, endMin) and section id(s). End can be less than start for overnight (sleep). */
const BLOCKS: { start: number; end: number; sectionIds: TaskSectionId[] }[] = [
  { start: MINS.h5,  end: MINS.h9,   sectionIds: ['morningRoutine'] },
  { start: MINS.h9,  end: MINS.h17,  sectionIds: ['highPriority'] },
  { start: MINS.h17, end: MINS.h21,  sectionIds: ['mediumPriority', 'lowPriority'] },
  { start: MINS.h21, end: MINS.h23,  sectionIds: ['nightRoutine'] },
]

/** Sleep block: 11 PM – 5 AM (crosses midnight). No section id; shown as a separate indicator. */
export function isSleepTime(currentMinutes: number): boolean {
  return currentMinutes >= MINS.h23 || currentMinutes < MINS.h5
}

/**
 * Section ids for which the current time falls inside their block.
 * Empty during sleep (5–9 AM morning, 9 AM–5 PM high, 5–9 PM medium+low, 9–11 PM night).
 */
export function getActiveSectionIds(currentMinutes: number): TaskSectionId[] {
  if (isSleepTime(currentMinutes)) return []
  for (const block of BLOCKS) {
    if (currentMinutes >= block.start && currentMinutes < block.end) {
      return block.sectionIds
    }
  }
  return []
}

/** Human-readable sleep window for UI. */
export const SLEEP_WINDOW_LABEL = '11 PM – 5 AM'
