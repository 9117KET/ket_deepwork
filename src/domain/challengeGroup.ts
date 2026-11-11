/**
 * domain/challengeGroup.ts
 *
 * Pure helpers for a challenge of up to eight people, and for reopening one
 * that has ended. No React, no Convex client. The two-person words ("your
 * partner", one mark beside yours) stay where there is one other member; a
 * group gets counts and "the others". Every helper reads `others` when the
 * server sends it and falls back to the single `partner` when it does not,
 * so a two-person challenge reads the same against either backend.
 */

import { dayCellState, type ChallengeDayLike, type DayCellState } from './challenge'
import { addDays } from './dateUtils'
import { DAY_STATE_LABEL, dayStage, stateMark, type DayActs } from './challengeList'

/** The fields of a member these helpers read (`memberView` satisfies it). */
export interface MemberLike {
  displayName: string
  timezone: string
  joinedAt: number
  key?: string
}

/** A member with the key every per-member element is keyed by. */
export type KeyedMember<M extends MemberLike = MemberLike> = M & { key: string }

/** The key given to the one partner a server without `others` sends. */
export const LEGACY_PARTNER_KEY = 'partner'

/**
 * Every other active member, in join order, each with a key. A server that
 * predates groups sends only `partner`; it becomes the one entry, keyed
 * `LEGACY_PARTNER_KEY` when it carries no key of its own.
 */
export function othersOf<M extends MemberLike>(entry: { partner: M | null; others?: M[] | null }): KeyedMember<M>[] {
  const list = entry.others ?? (entry.partner ? [entry.partner] : [])
  return list.map((m, i) => ({ ...m, key: m.key ?? (i === 0 ? LEGACY_PARTNER_KEY : `${LEGACY_PARTNER_KEY}-${i}`) }))
}

/** Each other member's own local date, from their timezone. `dateIn` is `localDateIn` from the service. */
export function memberDates(others: { key: string; timezone: string }[], dateIn: (timezone: string) => string): { key: string; date: string }[] {
  return others.map((m) => ({ key: m.key, date: dateIn(m.timezone) }))
}

/** Each other member's own yesterday, for `history`'s `otherToDates`. */
export function memberToDates(dates: { key: string; date: string }[]): { key: string; toDate: string }[] {
  return dates.map((d) => ({ key: d.key, toDate: addDays(d.date, -1) }))
}

/**
 * One member's day out of a `dayCards`/`todayCards` result: from `others`
 * by key when the server sends it, else the single `partner` for the first
 * other member. Null when there is no row yet.
 */
export function dayOf<D>(card: { partner?: D | null; others?: { key: string; day: D | null }[] } | null | undefined, key: string, isFirst: boolean): D | null {
  if (!card) return null
  if (card.others) return card.others.find((o) => o.key === key)?.day ?? null
  return isFirst ? (card.partner ?? null) : null
}

/** One member's rows out of a `history` result, the same way. */
export function rowsOf<R>(history: { partner?: R[]; others?: { key: string; rows: R[] }[] } | null | undefined, key: string, isFirst: boolean): R[] {
  if (!history) return []
  if (history.others) return history.others.find((o) => o.key === key)?.rows ?? []
  return isFirst ? (history.partner ?? []) : []
}

/** Two or more other members: the screens count instead of naming one partner. */
export function isGroup(otherCount: number): boolean {
  return otherCount >= 2
}

/**
 * How the others stand today in a group: "3 of 5 others locked in", and how
 * many have checked in once anyone has ("3 of 5 others locked in, 1 checked
 * in"). A check-in without a lock-in counts as checked in, not locked in.
 */
export function groupCountLabel(days: (DayActs | null | undefined)[]): string {
  const total = days.length
  const locked = days.filter((d) => !!d?.planSetAt).length
  const checked = days.filter((d) => dayStage(d) === 'checkedIn').length
  const head = `${locked} of ${total} others locked in`
  return checked > 0 ? `${head}, ${checked} checked in` : head
}

/**
 * Who stands beside you on a Today or list row: the partner's mark with one
 * other member, the group's count with more, "Just you" on a challenge
 * started alone and "Waiting for someone to join" on one nobody has joined.
 */
export function othersWho(args: { solo: boolean; others: { name: string; day: DayActs | null | undefined }[] }): string {
  const { others } = args
  if (others.length === 1) {
    const mark = stateMark(others[0]!.day)
    return `${others[0]!.name} ${mark.glyph} ${mark.label}`
  }
  if (others.length > 1) return groupCountLabel(others.map((o) => o.day))
  return args.solo ? 'Just you' : 'Waiting for someone to join'
}

/** "your partner" with one other member, "the others" with more: for sentences about who can see. */
export function audienceNoun(otherCount: number): string {
  return isGroup(otherCount) ? 'the others' : 'your partner'
}

/** A phrase with its first letter upper case, to open a sentence. */
export function capitalize(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/** The member who becomes creator when the creator leaves: the earliest joined of the others. */
export function successorName(others: { displayName: string; joinedAt: number }[]): string | null {
  let first: { displayName: string; joinedAt: number } | null = null
  for (const m of others) if (!first || m.joinedAt < first.joinedAt) first = m
  return first?.displayName ?? null
}

/** What a member leaving can count on: their own row is kept, and an invite brings it back. */
export const COME_BACK_SENTENCE = 'You can come back with a new invite link, and everything you recorded comes back with you.'

/**
 * What leaving does, said before it is done. Alone, it ends the challenge.
 * The creator with others hands it to the earliest joined member and it
 * goes on. Anyone else leaves it running and can come back.
 */
export function leaveSentence(args: { isCreator: boolean; others: { displayName: string; joinedAt: number }[] }): string {
  if (args.others.length === 0) return 'Leaving ends this challenge. Your days stay recorded.'
  if (args.isCreator) {
    const next = successorName(args.others)
    return `${next} becomes the creator and the challenge goes on. ${COME_BACK_SENTENCE}`
  }
  return COME_BACK_SENTENCE
}

/** Who loses the season when an ended challenge is deleted, in the delete sheet's words. */
export function deleteAudience(others: { displayName: string }[]): string {
  if (others.length === 0) return 'you'
  if (others.length === 1) return `both you and ${others[0]!.displayName}`
  return `everyone in it (${others.length + 1} people)`
}

/** "3 seats left", "1 seat left"; null when the challenge is full. */
export function seatsLeftLabel(memberCount: number, capacity: number): string | null {
  const left = capacity - memberCount
  if (left <= 0) return null
  return left === 1 ? '1 seat left' : `${left} seats left`
}

// ─── Closed stretches ────────────────────────────────────────────────────────

export interface ClosedSpan {
  from: string
  to: string
}

/** Was the challenge closed on `date`? Spans are inclusive. */
export function isClosedDate(date: string, spans: readonly ClosedSpan[] | null | undefined): boolean {
  return (spans ?? []).some((s) => date >= s.from && date <= s.to)
}

/** The season's dates that count: every date but the closed ones, which count for nobody. */
export function countedDates(dates: string[], spans: readonly ClosedSpan[] | null | undefined): string[] {
  if (!spans || spans.length === 0) return dates
  return dates.filter((d) => !isClosedDate(d, spans))
}

/** A season-grid state, with "closed" for a day the challenge spent ended. */
export type SeasonCellState = DayCellState | 'closed'

/** A season-grid state in words, for screen readers and the key. */
export const SEASON_STATE_LABEL: Record<SeasonCellState, string> = { ...DAY_STATE_LABEL, closed: 'closed' }

/**
 * One member's state for one day of the grid. A closed day reads "closed"
 * for everybody, never "missed"; a day on which someone did act (the day it
 * ended, say) still shows what they did.
 */
export function seasonCellState(row: ChallengeDayLike | undefined, date: string, todayIso: string, spans: readonly ClosedSpan[] | null | undefined): SeasonCellState {
  const state = dayCellState(row, date, todayIso)
  if ((state === 'none' || state === 'future') && isClosedDate(date, spans)) return 'closed'
  return state
}

// ─── Reopening ───────────────────────────────────────────────────────────────

/** The server's limit: a reopened season runs at most this many days from the reopen day, inclusive. */
export const MAX_REOPEN_SPAN_DAYS = 366

/**
 * The end dates a reopen may take: from the latest of every member's today
 * (an end before anyone's today would end it again at once) to 365 days
 * after the reopener's today (366 days inclusive, the server's limit).
 */
export function reopenDateBounds(args: { myDate: string; memberTodays: string[] }): { min: string; max: string } {
  let min = args.myDate
  for (const d of args.memberTodays) if (d > min) min = d
  return { min, max: addDays(args.myDate, MAX_REOPEN_SPAN_DAYS - 1) }
}

/** Does reopening need a new end date? Yes once the end date is before any member's today. */
export function reopenNeedsEndDate(args: { endDate: string; myDate: string; memberTodays: string[] }): boolean {
  return args.endDate < reopenDateBounds(args).min
}

/** A new end date the reopen sheet may send, or the sentence that says why not. */
export function reopenEndDateError(args: { endDate: string; myDate: string; memberTodays: string[]; startDate: string }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.endDate)) return 'Pick an end date.'
  const { min, max } = reopenDateBounds(args)
  if (args.endDate < min) return 'Pick an end date from today on.'
  if (args.endDate < args.startDate) return 'The end date has to be on or after the start date.'
  if (args.endDate > max) return 'A season runs at most 366 days from today.'
  return null
}
