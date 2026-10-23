/**
 * convex/_shared/challengeNudges.ts
 *
 * When may a member nudge their partner? Pure rules, no Convex and no DOM,
 * so the mutation that enforces them and the card that draws the button
 * agree on one definition.
 *
 * Up to three nudges on the nudger's own local day, at least an hour apart,
 * and only while the partner still owes the day something: the plan before
 * 21:30 on their clock, the check-in after it.
 */

export const NUDGE_DAILY_CAP = 3
export const NUDGE_MIN_GAP_MS = 60 * 60 * 1000

export type NudgeAvailability =
  | { state: "ready"; left: number }
  | { state: "cooling"; left: number; nextAt: number }
  | { state: "spent" }
  | { state: "notOwed" }

export interface NudgeRow {
  nudgesSentAt?: number[]
  /** Legacy single stamp from the once-a-day rule; read as one entry, never written. */
  nudgeSentAt?: number
}

/** Every nudge recorded on a day row, oldest first. The legacy stamp counts as one. */
export function nudgeTimes(row: NudgeRow | null | undefined): number[] {
  if (!row) return []
  const times = row.nudgesSentAt ? [...row.nudgesSentAt] : row.nudgeSentAt != null ? [row.nudgeSentAt] : []
  return times.sort((a, b) => a - b)
}

/** Does the partner still owe the day something, judged on their own clock? */
export function partnerOwesToday(args: { evening: boolean; planSetAt?: number | null; checkinAt?: number | null }): boolean {
  return args.evening ? !args.checkinAt : !args.planSetAt
}

/** Precedence: not owed, then spent, then cooling, then ready. */
export function nudgeAvailability(args: { nowMs: number; times: number[]; partnerOwes: boolean }): NudgeAvailability {
  const { nowMs, times, partnerOwes } = args
  if (!partnerOwes) return { state: "notOwed" }
  if (times.length >= NUDGE_DAILY_CAP) return { state: "spent" }
  const left = NUDGE_DAILY_CAP - times.length
  const last = times.length > 0 ? Math.max(...times) : null
  if (last != null && nowMs - last < NUDGE_MIN_GAP_MS) {
    return { state: "cooling", left, nextAt: last + NUDGE_MIN_GAP_MS }
  }
  return { state: "ready", left }
}

/** Whole minutes until `atMs`, rounded up, never below 1. */
export function minutesUntil(atMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((atMs - nowMs) / 60_000))
}

/** The button's text. Empty when there is nothing to nudge about (the button is hidden). */
export function nudgeLabel(a: NudgeAvailability, nowMs: number): string {
  switch (a.state) {
    case "ready":
      return "Nudge"
    case "cooling":
      return `Nudge again in ${minutesUntil(a.nextAt, nowMs)} min`
    case "spent":
      return `Nudged ${NUDGE_DAILY_CAP}/${NUDGE_DAILY_CAP} today`
    case "notOwed":
      return ""
  }
}

/** The caption beside a usable button: how many are left, once one has been spent. */
export function nudgeLeftCaption(left: number): string {
  return left < NUDGE_DAILY_CAP && left > 0 ? `${left} left today` : ""
}

/**
 * The server's refusal for a spent or cooling allowance; null when the cap
 * and gap allow a nudge. "Not owed" keeps its own two messages in the mutation.
 */
export function nudgeRefusal(a: NudgeAvailability, nowMs: number): string | null {
  if (a.state === "spent") return `You have nudged them ${NUDGE_DAILY_CAP} times today`
  if (a.state === "cooling") return `You can nudge again in ${minutesUntil(a.nextAt, nowMs)} min`
  return null
}

/** The `ConvexError` code on a nudge refused by the rules above (or "not owed"). */
export const NUDGE_RULE_CODE = "nudgeRule"

/**
 * Rule refusals the client shows as a quiet status line rather than an error.
 * The client keys on `NUDGE_RULE_CODE`; this matches the same sentences from a
 * backend deployed before the code existed.
 */
export const NUDGE_RULE_REFUSAL = /nudged them \d+ times today|nudge again in|already checked in|already locked in|not running today/i
