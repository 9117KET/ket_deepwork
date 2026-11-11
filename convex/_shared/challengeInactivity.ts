/**
 * convex/_shared/challengeInactivity.ts
 *
 * When does a quiet member put a challenge at risk? Pure rules, judged per
 * member on the member's own clock by the 15-minute sweep. Only full local
 * days count (yesterday backwards), never today: today is still open.
 *
 * A day is missed when the member's row for it has neither a lock-in nor a
 * check-in, or when there is no row at all (a member who never opens the
 * planner leaves no row, and that is the quietest day of all). Days before
 * the start, or before the member joined, are nobody's fault and never count.
 *
 * Three missed days in a row ⇒ warn (one email to each member). A fourth,
 * with the warning still on file ⇒ close: with two members or one the
 * challenge ends; with three or more the sweep drops that member alone and
 * the challenge runs on. Any act clears the warning; the
 * mutations do that at once, the sweep does it when it sees the run broken.
 */

/** Missed days that raise the warning. */
export const WARN_AFTER_DAYS = 3
/** Missed days, warning on file, that close the challenge. */
export const CLOSE_AFTER_DAYS = 4

const DAY_MS = 24 * 60 * 60 * 1000

/** `iso` moved by `n` days; UTC arithmetic, so DST cannot skew it. */
function shiftIso(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `a` to `b`, both ISO dates. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/**
 * The last `n` full local dates before `today`, oldest first, keeping only
 * those on or after both the member's join date and the challenge's start.
 */
export function countableDates(memberJoinedDate: string, startDate: string, today: string, n: number): string[] {
  const from = memberJoinedDate > startDate ? memberJoinedDate : startDate
  const out: string[] = []
  for (let back = n; back >= 1; back--) {
    const date = shiftIso(today, -back)
    if (date >= from) out.push(date)
  }
  return out
}

/**
 * The first date a member can be judged on, before the start is applied:
 * the later of their join date and the day after the challenge's latest
 * reopen. A reopened challenge counts no day it spent closed, nor the reopen
 * day itself (part of it was spent closed, and the others may not have seen
 * the reopen yet), so its first warning comes after three full days of it
 * running and a close after four. Pass the result to `countableDates`.
 */
export function inactivityFrom(memberJoinedDate: string, reopenedDate: string | undefined): string {
  if (reopenedDate === undefined) return memberJoinedDate
  const afterReopen = shiftIso(reopenedDate, 1)
  return afterReopen > memberJoinedDate ? afterReopen : memberJoinedDate
}

export interface InactivityRow {
  date: string
  planSetAt?: number | null
  checkinAt?: number | null
}

/**
 * The length of the run of missed days ending at the last of `dates` (the
 * member's countable local dates, oldest first). A date with no row in
 * `rows` is missed, exactly like a row with neither stamp.
 */
export function missedRun(rows: InactivityRow[], dates: string[]): number {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  let run = 0
  for (let i = dates.length - 1; i >= 0; i--) {
    const row = byDate.get(dates[i]!)
    if (row && (row.planSetAt || row.checkinAt)) break
    run++
  }
  return run
}

export type InactivityDecision = "warn" | "close" | "clear" | null

/**
 * What the sweep does about one member.
 *
 * - No warning on file and `missed` ≥ 3 ⇒ "warn".
 * - A warning on file for this member: `missed` < 3 ⇒ "clear" (the run was
 *   broken); `missed` ≥ 4 ⇒ "close", but only once a full day has passed
 *   since the three days the warning counted (`missedSince` is the first of
 *   them, `lastDate` the newest countable date). Without that, a member seen
 *   for the first time with four missed days would be warned and closed in
 *   two sweeps fifteen minutes apart, with no day to answer the warning.
 * - A warning on file for the *other* member: nothing; one warning at a time.
 */
export function inactivityDecision(args: {
  missed: number
  warning: { userId: string; missedSince: string } | null | undefined
  userId: string
  /** The newest countable date (normally yesterday). Omitted, a warning on file closes at four. */
  lastDate?: string
}): InactivityDecision {
  const { missed, warning, userId } = args
  if (!warning) return missed >= WARN_AFTER_DAYS ? "warn" : null
  if (warning.userId !== userId) return null
  if (missed < WARN_AFTER_DAYS) return "clear"
  if (missed < CLOSE_AFTER_DAYS) return null
  if (args.lastDate !== undefined && daysBetween(warning.missedSince, args.lastDate) < CLOSE_AFTER_DAYS - 1) return null
  return "close"
}

/** The first of the three missed days a new warning counts: two days before the newest countable date. */
export function warningMissedSince(dates: string[]): string {
  return dates[dates.length - WARN_AFTER_DAYS] ?? dates[0] ?? ""
}
