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
import { api } from "../../convex/_generated/api"
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
}

export async function createChallenge(input: CreateChallengeInput): Promise<void> {
  await convex.mutation(api.challenges.createChallenge, { ...input, timezone: deviceTimezone() })
}

export async function createInvite(): Promise<{ token: string; expiresAt: number }> {
  return await convex.mutation(api.challenges.createInvite, {})
}

export async function acceptInvite(token: string, displayName: string, goals: string[] = [], donts: string[] = []): Promise<void> {
  await convex.mutation(api.challenges.acceptInvite, { token, timezone: deviceTimezone(), displayName, goals, donts })
}

/** Replace your own lists. A don't sent with its id stays that don't; one left out is archived. */
export async function updateMyCommitments(input: {
  goals: string[]
  donts: { id?: string; text: string }[]
}): Promise<{ goals: string[]; donts: { id: string; text: string; archivedAt?: number }[] }> {
  return await convex.mutation(api.challenges.updateMyCommitments, input)
}

export async function renameChallenge(name: string): Promise<void> {
  await convex.mutation(api.challenges.renameChallenge, { name })
}

export async function leaveChallenge(): Promise<void> {
  await convex.mutation(api.challenges.leaveChallenge, {})
}

export async function syncChallengeSummary(date: string, summary: ChallengeSummary): Promise<void> {
  await convex.mutation(api.challenges.syncDaySummary, { date, summary, timezone: deviceTimezone() })
}

export async function lockInPlan(date: string, summary: ChallengeSummary): Promise<{ planSetAt: number }> {
  return await convex.mutation(api.challenges.lockInPlan, { date, summary })
}

export async function checkIn(args: {
  date: string
  summary: ChallengeSummary
  note?: string
  dontsBroken: string[]
}): Promise<{ checkinAt: number }> {
  return await convex.mutation(api.challenges.checkIn, args)
}

/** `left` nudges remain today; `nextAt` is when the next one opens (null once spent). */
export async function nudgePartner(): Promise<{ left: number; nextAt: number | null }> {
  return await convex.mutation(api.challenges.nudgePartner, {})
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
