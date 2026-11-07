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

/*
 * Typed lengths.
 *
 * The row's chip, the phone's schedule sheet and the add line all accept a
 * length typed the way people write one. `parseDurationInput` reads, ignoring
 * case and spaces:
 *
 *  - hours with a unit: "2h", "2 h", "2hr", "2 hours", "1.5h", "1,5h";
 *  - minutes with a unit: "30m", "30 min", "30 minutes";
 *  - both: "2h30", "2h 30m";
 *  - a clock length, h:mm: "1:30";
 *  - a bare number: a whole number of 10 or more is minutes ("45"), anything
 *    below 10 or with a decimal is hours ("2", "1.5", "0.5"). Nobody plans a
 *    2-minute task, and nobody plans 45 hours.
 *
 * The result is whole minutes, or null when the text says nothing usable, is
 * zero or less, or runs past a day (24h).
 *
 * `extractTrailingDuration` takes a length off the end of a new task's title:
 * only the last word (or "2h 30m" pair), separated by a space, and only when it
 * carries a unit or is h:mm, so "Call 911" stays a title. A title must be left
 * over: "2h" alone is not a task. A trailing h:mm is read only with a
 * one-digit hour, so "Standup 10:30" is a clock time, not ten and a half hours.
 */

const MAX_TYPED_MINUTES = 24 * 60

const HOUR_UNIT = '(?:h|hr|hrs|hour|hours)'
const MINUTE_UNIT = '(?:m|min|mins|minute|minutes)'
const NUMBER = '\\d+(?:\\.\\d+)?'

const HOURS_RE = new RegExp(`^(${NUMBER})\\s*${HOUR_UNIT}(?:\\s*(\\d+)\\s*(?:${MINUTE_UNIT})?)?$`)
const MINUTES_RE = new RegExp(`^(\\d+)\\s*${MINUTE_UNIT}$`)
const CLOCK_RE = /^(\d{1,2}):([0-5]\d)$/
const BARE_RE = new RegExp(`^${NUMBER}$`)

function inRange(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null
  const whole = Math.round(minutes)
  return whole > 0 && whole <= MAX_TYPED_MINUTES ? whole : null
}

/** A typed length as whole minutes, or null. See the rules above. */
export function parseDurationInput(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/,/g, '.')
  if (!text) return null

  const clock = CLOCK_RE.exec(text)
  if (clock) return inRange(Number(clock[1]) * 60 + Number(clock[2]))

  const hours = HOURS_RE.exec(text)
  if (hours) return inRange(Number(hours[1]) * 60 + (hours[2] ? Number(hours[2]) : 0))

  const minutes = MINUTES_RE.exec(text)
  if (minutes) return inRange(Number(minutes[1]))

  if (BARE_RE.test(text)) {
    const n = Number(text)
    const isHours = text.includes('.') || n < 10
    return inRange(isHours ? n * 60 : n)
  }

  return null
}

const TRAILING_RE = new RegExp(
  // Lazy title, so "Write report 2h 30m" keeps the pair as one length.
  `^(.*?\\S)\\s+(` +
    `\\d+(?:[.,]\\d+)?\\s*${HOUR_UNIT}(?:\\s*\\d+\\s*(?:${MINUTE_UNIT})?)?` +
    `|\\d+\\s*${MINUTE_UNIT}` +
    `|\\d:[0-5]\\d` +
    `)$`,
  'i',
)

/**
 * A length typed at the end of a new task's title, split off: "Write report
 * 2h" is "Write report" for 120 minutes. Null when there is none.
 */
export function extractTrailingDuration(title: string): { title: string; minutes: number } | null {
  const match = TRAILING_RE.exec(title.trim())
  if (!match) return null
  const minutes = parseDurationInput(match[2])
  const rest = match[1].trim()
  if (minutes == null || !rest) return null
  return { title: rest, minutes }
}
