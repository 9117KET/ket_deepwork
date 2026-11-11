/**
 * services/challengeService.ts
 *
 * Client wrappers for the Convex challenge functions, plus the two
 * device-side things the backend cannot know: which timezone this device
 * is in, and how to hand a line of text to WhatsApp (the Web Share sheet on
 * a phone, the clipboard everywhere else).
 */

import { ConvexError } from "convex/values"
import { convex } from "../lib/convex"
import type { FunctionReturnType } from "convex/server"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { CHECKIN_START, hhmmToMinutes, localDateAndMinutes } from "../../convex/_shared/challengeReminders"
import type { ChallengeSummary } from "../domain/challenge"
import { todayIso } from "../domain/dateUtils"

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** The ISO date it is right now in `timezone`; the partner's "today". */
export function localDateIn(timezone: string, nowMs: number = Date.now()): string {
  try {
    return localDateAndMinutes(nowMs, timezone).date
  } catch {
    return todayIso()
  }
}

/**
 * Is it past the check-in hour on `timezone`'s clock? The server judges a
 * nudge on the partner's clock, so the card has to as well.
 */
export function isEveningIn(timezone: string, nowMs: number = Date.now()): boolean {
  try {
    return localDateAndMinutes(nowMs, timezone).minutes >= hhmmToMinutes(CHECKIN_START)
  } catch {
    const d = new Date(nowMs)
    return d.getHours() * 60 + d.getMinutes() >= hhmmToMinutes(CHECKIN_START)
  }
}

export interface CreateChallengeInput {
  name: string
  startDate: string
  endDate: string
  goals: string[]
  donts: string[]
  planDeadline: string
  checkinDeadline: string
  displayName: string
  /** "Just me": a challenge with no partner talk. Sent only when true. */
  solo?: boolean
}

/** Starts a challenge; you are its first member. Returns its id. */
export async function createChallenge(input: CreateChallengeInput): Promise<Id<"challenges">> {
  const { challengeId } = await convex.mutation(api.challenges.createChallenge, { ...input, timezone: deviceTimezone() })
  return challengeId
}

export async function createInvite(challengeId: Id<"challenges">): Promise<{ token: string; expiresAt: number }> {
  return await convex.mutation(api.challenges.createInvite, { challengeId })
}

/** Joins the challenge an invite names. Returns its id. */
export async function acceptInvite(token: string, displayName: string, goals: string[] = [], donts: string[] = []): Promise<Id<"challenges">> {
  const { challengeId } = await convex.mutation(api.challenges.acceptInvite, { token, timezone: deviceTimezone(), displayName, goals, donts })
  return challengeId
}

export type ChallengeView = FunctionReturnType<typeof api.challenges.myChallenges>[number]["challenge"]

interface CommitmentInput {
  id?: string
  text: string
}

/**
 * Replace your own lists in one challenge. A goal or a don't sent with its id
 * stays that one (its marks keep pointing at it); one left out is archived.
 */
export async function updateMyCommitments(
  challengeId: Id<"challenges">,
  input: {
    goals: CommitmentInput[]
    donts: CommitmentInput[]
  },
): Promise<void> {
  await convex.mutation(api.challenges.updateMyCommitments, { challengeId, ...input })
}

export async function renameChallenge(challengeId: Id<"challenges">, name: string): Promise<void> {
  await convex.mutation(api.challenges.renameChallenge, { challengeId, name })
}

/**
 * Correct the season's dates and deadlines (creator only, while it runs).
 * The server refuses an end before today and a start past the first
 * recorded day, each with a sentence; recorded days are never touched.
 */
export async function updateSpan(
  challengeId: Id<"challenges">,
  span: { startDate: string; endDate: string; planDeadline: string; checkinDeadline: string },
): Promise<ChallengeView> {
  return await convex.mutation(api.challenges.updateSpan, { challengeId, ...span })
}

/**
 * Today's marks: the goals you kept, the don'ts you broke. Send the full set
 * of one kind; a kind left out is left as it was. Not one of the two daily
 * acts, so it never counts against inactivity.
 */
export async function markDay(
  challengeId: Id<"challenges">,
  args: { date: string; goalsKept: string[] } | { date: string; dontsBroken: string[] },
): Promise<{ goalsKept: string[]; dontsBroken: string[] }> {
  return await convex.mutation(api.challenges.markDay, { challengeId, ...args })
}

/**
 * Leaving. Alone, it ends the challenge. The creator with others hands it
 * to the earliest joined member and it goes on; anyone else just leaves it.
 * Nothing recorded is deleted, and a new invite link brings a leaver back.
 */
export async function leaveChallenge(challengeId: Id<"challenges">): Promise<void> {
  await convex.mutation(api.challenges.leaveChallenge, { challengeId })
}

/** Deletes an ended challenge for good (creator or admin). Every member loses the season. */
export async function deleteChallenge(challengeId: Id<"challenges">): Promise<void> {
  await convex.mutation(api.challenges.deleteChallenge, { challengeId })
}

/** Publishes the day's summary once; the server fans it out to every active challenge. */
export async function syncChallengeSummary(date: string, summary: ChallengeSummary): Promise<void> {
  await convex.mutation(api.challenges.syncDaySummary, { date, summary, timezone: deviceTimezone() })
}

export type LockInResult = FunctionReturnType<typeof api.challenges.lockInPlan>

/**
 * The morning act. Without `challengeId` it locks in today in every active
 * challenge (one lock-in for the whole day); with one, only that challenge.
 */
export async function lockInPlan(date: string, summary: ChallengeSummary, challengeId?: Id<"challenges">): Promise<LockInResult> {
  return await convex.mutation(api.challenges.lockInPlan, challengeId ? { date, summary, challengeId } : { date, summary })
}

/** The evening act, per challenge. */
export async function checkIn(
  challengeId: Id<"challenges">,
  args: {
    date: string
    summary: ChallengeSummary
    note?: string
    dontsBroken: string[]
    /** Left out, the day's goal marks stay as they were. */
    goalsKept?: string[]
  },
): Promise<{ checkinAt: number }> {
  return await convex.mutation(api.challenges.checkIn, { challengeId, ...args })
}

/**
 * Nudge one other member. `memberKey` names them (`memberView.key`); left
 * out, the server nudges the first other member, which is what a
 * two-person challenge has always sent. `left` nudges toward that member
 * remain today; `nextAt` is when the next one opens (null once spent).
 */
export async function nudgePartner(challengeId: Id<"challenges">, memberKey?: string): Promise<{ left: number; nextAt: number | null }> {
  return await convex.mutation(api.challenges.nudgePartner, memberKey ? { challengeId, memberKey } : { challengeId })
}

/**
 * Reopen an ended challenge (creator only) with everything it recorded.
 * `endDate` is needed once the old end date is before any member's today;
 * the server refuses without one (code `needsEndDate`, "Pick an end date
 * from today on").
 */
export async function reopenChallenge(challengeId: Id<"challenges">, endDate?: string): Promise<void> {
  await convex.mutation(api.challenges.reopenChallenge, endDate ? { challengeId, endDate } : { challengeId })
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/challenge/join?invite=${encodeURIComponent(token)}`
}

export type ShareOutcome = "shared" | "copied" | "unsupported"

/** The Web Share sheet when there is one (WhatsApp shows up on phones), the clipboard otherwise. */
export async function shareText(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text })
      return "shared"
    } catch (e) {
      // The user closed the sheet: nothing to do. Anything else falls through to copying.
      if ((e as { name?: string }).name === "AbortError") return "shared"
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return "copied"
  } catch {
    return "unsupported"
  }
}

interface RefusalData {
  code?: unknown
  message?: unknown
}

/** The object a `ConvexError` carries, when it is one. */
function refusalData(e: unknown): RefusalData | null {
  if (!(e instanceof ConvexError)) return null
  const data: unknown = e.data
  return data && typeof data === "object" ? (data as RefusalData) : null
}

/**
 * The sentence to show for a failed call. Expected states arrive as a
 * `ConvexError` whose data carries the sentence, and that survives
 * production redaction. Anything else is cleaned of Convex's wrapping: in
 * dev the message is "[CONVEX M(…)] [Request ID: …] Server Error", a
 * newline, then "Uncaught Error: <sentence>" and a stack; in production only
 * the redacted first part arrives, and there is no sentence to show.
 */
export function challengeErrorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const message = refusalData(e)?.message
    return typeof message === "string" ? message : String(e.data)
  }
  const raw = e instanceof Error ? e.message : String(e)
  if (/Uncaught Error: /.test(raw)) {
    return raw.replace(/^.*Uncaught Error: /s, "").replace(/\s+at .*$/s, "").trim() || "Something went wrong"
  }
  if (/Server Error/.test(raw)) return "Something went wrong"
  return raw.trim() || "Something went wrong"
}

/** The `code` of a server refusal ("challenge", or `NUDGE_RULE_CODE` for a nudge the rules refused), else null. */
export function challengeErrorCode(e: unknown): string | null {
  const code = refusalData(e)?.code
  return typeof code === "string" ? code : null
}
