/**
 * services/challengeService.ts
 *
 * Client wrappers for the Convex challenge functions, plus the two
 * device-side things the backend cannot know: which timezone this device
 * is in, and how to hand a line of text to WhatsApp (the Web Share sheet on
 * a phone, the clipboard everywhere else).
 */

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

/** Convex wraps thrown errors; show the sentence, not the stack. */
export function challengeErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  return raw.replace(/^.*Uncaught Error: /, "").replace(/\s+at .*$/s, "").trim() || "Something went wrong"
}
