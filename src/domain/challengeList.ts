/**
 * domain/challengeList.ts
 *
 * Pure helpers for showing many challenges at once: the order of the list,
 * the two state marks on a row, what you still owe today, the sentence for a
 * season that has ended or been warned, and the Today pill. No React, no
 * Convex. Every string the challenge screens say about state is built here,
 * so the list, the dashboard and Today cannot drift apart.
 */

import type { ChallengeProgress, DayCellState } from './challenge'
import type { DaysLeftHeadline } from './challengeCountdown'

export type EndedReason = 'creatorLeft' | 'allLeft' | 'inactive' | 'seasonOver' | 'manual'

/** The fields of a challenge these helpers read; the server's `ChallengeView` satisfies it. */
export interface ChallengeListItem {
  status: 'active' | 'ended'
  createdAt: number
  endDate: string
  endedReason: EndedReason | null
  endedAt: number | null
  isCreator: boolean
  warning: { forMe: boolean; missedSince: string; issuedAt: number } | null
}

/** A day's two acts, as either member's row carries them. */
export interface DayActs {
  planSetAt?: number | null
  checkinAt?: number | null
}

const DAY_MS = 86_400_000

function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

/** Active first, then ended; newest first within each. Returns a new array. */
export function sortChallenges<T extends { challenge: Pick<ChallengeListItem, 'status' | 'createdAt'> }>(entries: T[]): T[] {
  const rank = (e: T) => (e.challenge.status === 'active' ? 0 : 1)
  return [...entries].sort((a, b) => rank(a) - rank(b) || b.challenge.createdAt - a.challenge.createdAt)
}

export type DayStage = 'none' | 'locked' | 'checkedIn'

/** How far a member's day has got: nothing yet, plan locked, or checked in. */
export function dayStage(day: DayActs | null | undefined): DayStage {
  if (day?.checkinAt) return 'checkedIn'
  if (day?.planSetAt) return 'locked'
  return 'none'
}

/**
 * One member's mark on a list row: ✓ once they have done something today,
 * – while they have not, and a label that says which, so the glyph never
 * carries the meaning alone.
 */
export function stateMark(day: DayActs | null | undefined): { glyph: '✓' | '–'; label: string; done: boolean } {
  const stage = dayStage(day)
  if (stage === 'checkedIn') return { glyph: '✓', label: 'checked in', done: true }
  if (stage === 'locked') return { glyph: '✓', label: 'plan locked', done: true }
  return { glyph: '–', label: 'nothing yet', done: false }
}

export type OwedAct = 'lock' | 'checkin' | 'none'

/**
 * What you owe a challenge today. Lock in comes first; once it is in, the
 * check-in; once both are in, nothing (you can still edit the check-in).
 */
export function owedAct(mine: DayActs | null | undefined): OwedAct {
  if (!mine?.planSetAt) return 'lock'
  if (!mine.checkinAt) return 'checkin'
  return 'none'
}

/** The words for what you owe, as a row on Today says it. */
export function owedLabel(act: OwedAct): string {
  if (act === 'lock') return 'you owe a plan'
  if (act === 'checkin') return 'you owe a check-in'
  return 'you are done for today'
}

/**
 * Who stands beside you on a Today row: the partner and their mark once
 * someone has joined, "Just you" on a challenge started alone, and
 * "Waiting for a partner" on a two-person challenge nobody has joined yet.
 */
export function partnerWho(args: { solo: boolean; partnerName: string | null; partnerDay: DayActs | null | undefined }): string {
  if (args.partnerName) {
    const mark = stateMark(args.partnerDay)
    return `${args.partnerName} ${mark.glyph} ${mark.label}`
  }
  return args.solo ? 'Just you' : 'Waiting for a partner'
}

/** The days-left headline as one phrase: "70 days left", "1 day left", "Last day". */
export function headlinePhrase(headline: DaysLeftHeadline): string {
  return headline.number === null ? headline.label : `${headline.number} ${headline.label}`
}

/** The server's limits on a new challenge (convex/challenges.ts `createChallenge`). */
export const MAX_SPAN_DAYS = 366
export const CHECKIN_REMINDERS_FROM = '21:30'

export type SeasonField = 'end' | 'plan' | 'checkin'

/**
 * Step 1 of the create form, checked the way the server checks it, so a
 * refusal is shown next to its field before step 2 instead of after it.
 * Times are "HH:MM", which compare correctly as strings.
 */
export function seasonStepError(args: { startDate: string; endDate: string; planDeadline: string; checkinDeadline: string }): { field: SeasonField; message: string } | null {
  const { startDate, endDate, planDeadline, checkinDeadline } = args
  if (endDate < startDate) return { field: 'end', message: 'The end date has to be on or after the start date.' }
  if (daysFrom(startDate, endDate) + 1 > MAX_SPAN_DAYS) return { field: 'end', message: 'A challenge can run for at most a year (366 days).' }
  if (!/^\d{2}:\d{2}$/.test(planDeadline) || planDeadline >= CHECKIN_REMINDERS_FROM) {
    return { field: 'plan', message: `The plan deadline has to be before ${CHECKIN_REMINDERS_FROM}.` }
  }
  if (!/^\d{2}:\d{2}$/.test(checkinDeadline) || checkinDeadline <= CHECKIN_REMINDERS_FROM) {
    return { field: 'checkin', message: `The check-in deadline has to be after ${CHECKIN_REMINDERS_FROM}, when its reminders start.` }
  }
  return null
}

/** A season-grid state in words, for screen readers and the key. */
export const DAY_STATE_LABEL: Record<DayCellState, string> = {
  both: 'plan and check-in',
  plan: 'plan only',
  checkin: 'check-in only',
  none: 'missed',
  future: 'not yet',
}

/** "3 Nov", in the viewer's locale, from an instant. */
export function formatDayOfInstant(ms: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(ms))
}

/**
 * One sentence for a season that has ended, from why and when. `partnerName`
 * is the other member, for "Kin left"; the creator is the one who left when
 * the reason is `creatorLeft`, so it is "you" when the viewer created it.
 */
export function endedSentence(challenge: Pick<ChallengeListItem, 'endedReason' | 'endedAt' | 'endDate' | 'isCreator'>, partnerName: string | null, locale?: string): string {
  const when = challenge.endedAt != null ? formatDayOfInstant(challenge.endedAt, locale) : null
  const on = when ? ` ${when}` : ''
  switch (challenge.endedReason) {
    case 'creatorLeft':
      return `Ended${on} · ${challenge.isCreator ? 'you left' : `${partnerName ?? 'your partner'} left`}`
    case 'allLeft':
      return `Ended${on} · everyone left`
    case 'inactive':
      return `Closed${on} after 4 days without a lock-in or check-in`
    case 'manual':
      return 'Ended by hand'
    case 'seasonOver':
    default:
      return 'Season over'
  }
}

/** Whole days from `fromIso` to `toIso`. */
export function daysFrom(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY_MS)
}

/**
 * The warning banner, when the server has warned a season. `todayIso` is the
 * viewer's date: the run is counted from `missedSince` up to yesterday, and
 * never reads as fewer than the three days that raised it.
 */
export function warningSentence(
  warning: NonNullable<ChallengeListItem['warning']>,
  partnerName: string | null,
  todayIso: string,
): string {
  const days = Math.max(3, daysFrom(warning.missedSince, todayIso))
  if (warning.forMe) {
    return `No lock-in or check-in from you for ${days} days. It closes tomorrow unless you lock in or check in today.`
  }
  const name = partnerName ?? 'your partner'
  return `No lock-in or check-in from ${name} for ${days} days. It closes tomorrow unless ${name} locks in or checks in.`
}

/**
 * The pill in the day header: the day count with one running challenge,
 * the number of challenges with more, nothing with none. Only challenges
 * whose span holds today count as running.
 */
export function challengePillLabel(running: Pick<ChallengeProgress, 'dayNumber' | 'totalDays' | 'daysLeft' | 'phase'>[]): string | undefined {
  const inSpan = running.filter((p) => p.phase === 'active')
  if (inSpan.length === 0) return undefined
  if (inSpan.length === 1) {
    const p = inSpan[0]!
    return `Day ${p.dayNumber}/${p.totalDays} · ${p.daysLeft} left`
  }
  return `${inSpan.length} challenges`
}
