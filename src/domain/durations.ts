/**
 * domain/durations.ts
 *
 * The one list a task's length is chosen from, on a phone and on a desktop.
 *
 * It is an ascending ladder of plain lengths, 30 minutes to a working day,
 * with the short errands kept above it: a 10-minute call has a cost too. It
 * replaced a list in focus blocks ("3 blocks · 2h15"), which had no 30m, 1h or
 * 2h, and which changed whenever the block length did.
 *
 * Past four hours the steps are whole hours: nobody plans 5h15.
 *
 * Minutes stay the stored truth. A stored value that is not on the list (an
 * old 150, a 5) is shown in its place in the order, never rewritten or dropped.
 */

export const QUICK_DURATION_MINUTES = [10, 15, 20]

export const DURATION_LADDER_MINUTES = [30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480]

/** What a task without a duration is counted as in the day's gauge. */
export const DEFAULT_TASK_DURATION_MINUTES = 30

/**
 * Every length to offer, ascending: the quick ones, then the ladder, with
 * `stored` inserted in order when it is off both lists.
 */
export function durationOptions(stored?: number): number[] {
  const options = [...QUICK_DURATION_MINUTES, ...DURATION_LADDER_MINUTES]
  if (stored != null && Number.isFinite(stored) && stored >= 0 && !options.includes(stored)) {
    options.push(stored)
    options.sort((a, b) => a - b)
  }
  return options
}
