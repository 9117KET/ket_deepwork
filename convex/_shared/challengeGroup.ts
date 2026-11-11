/**
 * convex/_shared/challengeGroup.ts
 *
 * Group challenges and reopening: pure rules, no Convex and no DOM, shared by
 * `challenges.ts` and `challengesInternal.ts` (and unit-tested beside).
 *
 * A challenge holds up to `MAX_MEMBERS` active members. A member who leaves
 * or is dropped keeps their row, marked `leftAt` (a former member), so the
 * row count can exceed the cap; reads are bounded by `MEMBER_ROW_BOUND`.
 * The creator role moves to the longest-standing active member (earliest
 * `joinedAt`) when the creator goes. A reopened challenge records the
 * stretch it spent closed, and those days count as missed for nobody.
 */

import type { ClosedSpan } from "./challengeValidators"

/** Active members one challenge may hold at once. */
export const MAX_MEMBERS = 8
/**
 * Member rows (active and former) read per challenge. Former rows are kept
 * forever, so this is the bound on the read; a join that would add a row
 * past it is refused as full.
 */
export const MEMBER_ROW_BOUND = 64
/** Closed stretches kept on a challenge; the oldest drop off past this. */
export const MAX_CLOSED_SPANS = 20
/** A reopened season runs at most this many days, counted from the reopen day. */
export const MAX_REOPEN_SPAN_DAYS = 366
/** With this many active members or more, a quiet member drops out alone instead of closing the challenge. */
export const GROUP_DROP_MIN_MEMBERS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/** `iso` moved by `n` days; UTC arithmetic, so DST cannot skew it. */
export function shiftIso(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `a` to `b`, both ISO dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

export interface MemberLike {
  userId: string
  joinedAt: number
  leftAt?: number
}

/** The active members (no `leftAt`), longest-standing first. Ties keep their input order. */
export function activeInJoinOrder<T extends MemberLike>(rows: readonly T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.leftAt === undefined)
    .sort((a, b) => a.row.joinedAt - b.row.joinedAt || a.i - b.i)
    .map(({ row }) => row)
}

/**
 * Who becomes creator when `leavingUserId` goes: the active member with the
 * earliest `joinedAt` other than them, or null when nobody is left.
 */
export function successorOf<T extends MemberLike>(rows: readonly T[], leavingUserId: string): T | null {
  return activeInJoinOrder(rows).find((m) => m.userId !== leavingUserId) ?? null
}

/**
 * The stretch a challenge spent ended, as a reopen on `reopenedDate` records
 * it. `endedDate` is the local date of `endedAt` on the reopener's clock;
 * when a lock-in or check-in exists on that date, the day was lived and the
 * span starts the day after. It runs to the day before the reopen. Null when
 * that leaves nothing (a reopen on the day it ended, or the next day after a
 * lived end day).
 */
export function closedSpanFor(args: { endedDate: string; actedOnEndedDate: boolean; reopenedDate: string }): ClosedSpan | null {
  const from = args.actedOnEndedDate ? shiftIso(args.endedDate, 1) : args.endedDate
  const to = shiftIso(args.reopenedDate, -1)
  return from <= to ? { from, to } : null
}

/** `spans` with `span` appended (when given), keeping only the newest `MAX_CLOSED_SPANS`. */
export function appendClosedSpan(spans: readonly ClosedSpan[] | undefined, span: ClosedSpan | null): ClosedSpan[] {
  const next = [...(spans ?? []), ...(span ? [span] : [])]
  return next.slice(Math.max(0, next.length - MAX_CLOSED_SPANS))
}

export type ReopenEndProblem = "needsEndDate" | "beforeStart" | "tooLong" | null

/**
 * Whether a reopen may run to `endDate`. It must be on or after every active
 * member's local today (else the season-over sweep ends it at once: the
 * client asks for a new date), on or after the start, and no more than
 * `MAX_REOPEN_SPAN_DAYS` days from the reopen day, inclusive. The original
 * start may lie further back: the limit is measured from the reopen.
 */
export function reopenEndProblem(args: { endDate: string; startDate: string; memberTodays: readonly string[]; reopenDay: string }): ReopenEndProblem {
  if (args.memberTodays.some((today) => args.endDate < today)) return "needsEndDate"
  if (args.endDate < args.startDate) return "beforeStart"
  if (daysBetween(args.reopenDay, args.endDate) + 1 > MAX_REOPEN_SPAN_DAYS) return "tooLong"
  return null
}

/** The first `from` among the closed spans, or null: the start may not move past it. */
export function firstClosedDate(spans: readonly ClosedSpan[] | undefined): string | null {
  let first: string | null = null
  for (const s of spans ?? []) if (first === null || s.from < first) first = s.from
  return first
}

/**
 * Nudge times toward one member, from the nudger's day row. Per target from
 * `nudgesByMember`; a row written before per-target bookkeeping (no
 * `nudgesByMember` at all) had one possible target, the first other member,
 * so its legacy list counts for that one only.
 */
export function nudgeTimesFor(
  row: { nudgesSentAt?: number[]; nudgeSentAt?: number; nudgesByMember?: Record<string, number[]> } | null | undefined,
  key: string,
  isFirstOther: boolean,
): number[] {
  if (!row) return []
  if (row.nudgesByMember) return [...(row.nudgesByMember[key] ?? [])].sort((a, b) => a - b)
  if (!isFirstOther) return []
  const times = row.nudgesSentAt ? [...row.nudgesSentAt] : row.nudgeSentAt != null ? [row.nudgeSentAt] : []
  return times.sort((a, b) => a - b)
}

/**
 * How a check-in reminder names the deadline: "midnight" for 23:59 (the
 * latest a deadline can be, and what a person means by it), else the time
 * itself, "22:00".
 */
export function checkinDeadlinePhrase(hhmm: string): string {
  return hhmm >= "23:59" ? "midnight" : hhmm
}
