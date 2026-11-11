/**
 * hooks/useChallenges.ts
 *
 * Every challenge the signed-in user is in, live. Four hooks, each one
 * subscription:
 *
 * - `useChallenges(now)`: the list (`myChallenges`). Small, rarely changes.
 * - `useChallengeDetail(id, now)`: one challenge and both members' today
 *   (`dayCards`), for its dashboard. It reads the challenge out of the same
 *   `myChallenges` subscription, which Convex shares with the list.
 * - `useTodayCards(active, now)`: today across every active challenge in one
 *   `todayCards` subscription, for the Today block and the list rows.
 * - `useChallengeHistory(id, …)`: the season up to yesterday. Heavy, so only
 *   the dashboard and Review mount it, and today is kept out of its read set.
 *
 * `now` is a minute tick from the caller, so another member's date rolls
 * over without a reload; each member lives on their own clock. A challenge
 * holds up to eight people: `others` is every other member in join order,
 * keyed by `memberView.key`, and `partner` stays its first entry.
 */

import { useMemo } from "react"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { useAuth } from "../contexts/AuthContext"
import { addDays, todayIso } from "../domain/dateUtils"
import { challengeProgress, type ChallengeProgress } from "../domain/challenge"
import { localDateIn } from "../services/challengeService"
import { dayOf, isGroup, memberDates, memberToDates, othersOf, type KeyedMember } from "../domain/challengeGroup"

/**
 * contract: spec 03. Day views gain `goalsKept` (ids of the goals kept that
 * day) and a member's `goals` become `Commitment[]` (legacy rows: strings).
 * The generated types here predate both, so the day fields are added below
 * as optional and goals are read through `normalizeGoals`, which takes
 * either shape. Once the generated types know them this still compiles.
 */
export interface ContractDayFields {
  goalsKept?: string[]
}
type WithDayFields<T> = T extends null | undefined ? T : T & ContractDayFields

type RawDayCards = NonNullable<FunctionReturnType<typeof api.challenges.dayCards>>
type RawHistory = NonNullable<FunctionReturnType<typeof api.challenges.history>>
type RawTodayCard = FunctionReturnType<typeof api.challenges.todayCards>[number]

export type ChallengeEntry = FunctionReturnType<typeof api.challenges.myChallenges>[number]
/** A member as `memberView` returns it; `goals` is `(string | Commitment)[]` until normalized. */
export type ChallengeMember = ChallengeEntry["me"]
export type ChallengeDayCards = Omit<RawDayCards, "mine" | "partner"> & {
  mine: WithDayFields<RawDayCards["mine"]>
  partner: WithDayFields<RawDayCards["partner"]>
}
export type ChallengeHistory = Omit<RawHistory, "mine" | "partner"> & {
  mine: WithDayFields<RawHistory["mine"][number]>[]
  partner: WithDayFields<RawHistory["partner"][number]>[]
}
export type TodayCard = Omit<RawTodayCard, "mine" | "partner"> & { mine: WithDayFields<RawTodayCard["mine"]>; partner: WithDayFields<RawTodayCard["partner"]> }

export interface ChallengesState {
  status: "signedOut" | "loading" | "ready"
  /** Active first, then ended; newest first within each (the server's order). */
  entries: ChallengeEntry[]
  active: ChallengeEntry[]
}

const NONE: ChallengeEntry[] = []

export function useChallenges(): ChallengesState {
  const { user } = useAuth()
  const entries = useQuery(api.challenges.myChallenges, user ? {} : "skip")
  return useMemo(() => {
    if (!user) return { status: "signedOut", entries: NONE, active: NONE }
    if (entries === undefined) return { status: "loading", entries: NONE, active: NONE }
    return { status: "ready", entries, active: entries.filter((e) => e.challenge.status === "active") }
  }, [user, entries])
}

/** The partner's local date, or mine while there is no partner. */
export function partnerDateOf(entry: Pick<ChallengeEntry, "partner">, now: number, myDate: string): string {
  return entry.partner ? localDateIn(entry.partner.timezone, now) : myDate
}

/** "missing": signed in, loaded, and this id is not one of yours (a stale or foreign link). */
export type ChallengeDetailStatus = "signedOut" | "loading" | "missing" | "active" | "ended"

/** Another member of a challenge, keyed (`memberView.key`), in join order. */
export type OtherMember = KeyedMember<ChallengeMember>

/** Every other active member of one challenge, keyed; the single `partner` on an older server. */
export function otherMembersOf(entry: Pick<ChallengeEntry, "partner"> & { others?: ChallengeMember[] | null }): OtherMember[] {
  return othersOf<ChallengeMember>(entry)
}

/**
 * Each other member's own local date. Sent to the server only for a group:
 * with one other member `partnerDate` already says it, so a two-person
 * challenge sends exactly what it always has.
 */
function otherDatesArg(others: OtherMember[], now: number): { key: string; date: string }[] | undefined {
  if (!isGroup(others.length)) return undefined
  return memberDates(others, (tz) => localDateIn(tz, now))
}

/** One other member's today: who, their own date, and their day (undefined while loading, null with no row). */
export interface MemberToday<D> {
  member: OtherMember
  date: string
  day: D | null | undefined
}

type DayView = NonNullable<ChallengeDayCards["partner"]>

export interface ChallengeDetail {
  status: ChallengeDetailStatus
  info: ChallengeEntry | null
  progress: ChallengeProgress | null
  /** My local date and the partner's, which can differ by a day. */
  myDate: string
  partnerDate: string
  mine: ChallengeDayCards["mine"] | null
  partnerCard: ChallengeDayCards["partner"] | null
  /** Every other member in join order, with their own date and today; the first is `partner`. */
  others: MemberToday<DayView>[]
}

export function useChallengeDetail(id: string | undefined, now: number): ChallengeDetail {
  const list = useChallenges()
  const info = list.entries.find((e) => e.challenge.id === id) ?? null
  const myDate = todayIso()
  const partnerDate = info ? partnerDateOf(info, now, myDate) : myDate
  const others = info ? otherMembersOf(info) : []
  const otherDates = otherDatesArg(others, now)
  const cards = useQuery(
    api.challenges.dayCards,
    info ? { challengeId: info.challenge.id, myDate, partnerDate, ...(otherDates ? { otherDates } : {}) } : "skip",
  )
  const status: ChallengeDetailStatus =
    list.status === "signedOut"
      ? "signedOut"
      : list.status === "loading"
        ? "loading"
        : !info
          ? "missing"
          : info.challenge.status === "ended"
            ? "ended"
            : "active"
  return {
    status,
    info,
    progress: info ? challengeProgress(info.challenge, myDate) : null,
    myDate,
    partnerDate,
    mine: cards?.mine ?? null,
    partnerCard: cards?.partner ?? null,
    others: others.map((member, i) => ({
      member,
      date: otherDates?.[i]?.date ?? partnerDate,
      day: cards === undefined ? undefined : dayOf<DayView>(cards, member.key, i === 0),
    })),
  }
}

export interface TodayRow {
  entry: ChallengeEntry
  progress: ChallengeProgress
  partnerDate: string
  /** Undefined while loading; null when there is no row yet. */
  mine: TodayCard["mine"] | null | undefined
  partner: TodayCard["partner"] | null | undefined
  /** Every other member's today, join order; the first is `partner`. */
  others: MemberToday<NonNullable<TodayCard["partner"]>>[]
}

/** Today in every active challenge, one subscription. Rows keep the order of `active`. */
export function useTodayCards(active: ChallengeEntry[], now: number): { myDate: string; rows: TodayRow[]; loading: boolean } {
  const myDate = todayIso()
  const members = active.map((e) => otherMembersOf(e))
  const request = active.map((e, i) => {
    const otherDates = otherDatesArg(members[i]!, now)
    return { challengeId: e.challenge.id, partnerDate: partnerDateOf(e, now, myDate), ...(otherDates ? { otherDates } : {}) }
  })
  const cards = useQuery(api.challenges.todayCards, request.length > 0 ? { myDate, cards: request } : "skip")
  const byId = new Map((cards ?? []).map((c) => [c.challengeId as string, c]))
  const rows = active.map((entry, i) => {
    const card = byId.get(entry.challenge.id)
    const req = request[i]!
    return {
      entry,
      progress: challengeProgress(entry.challenge, myDate),
      partnerDate: req.partnerDate,
      mine: cards === undefined ? undefined : (card?.mine ?? null),
      partner: cards === undefined ? undefined : (card?.partner ?? null),
      others: members[i]!.map((member, j) => ({
        member,
        date: req.otherDates?.[j]?.date ?? req.partnerDate,
        day: cards === undefined ? undefined : dayOf<NonNullable<TodayCard["partner"]>>(card, member.key, j === 0),
      })),
    }
  })
  return { myDate, rows, loading: request.length > 0 && cards === undefined }
}

/**
 * Every recorded day up to yesterday. Today is deliberately left out: it is
 * rewritten on every edit, and this read set should not be. The partner's
 * rows run to `partnerUntilIso` (their own yesterday) when given, and in a
 * group each other member's to their own yesterday (`otherToDates`), so a
 * member a day ahead leaves no hole between history and their card.
 * Skipped while `challengeId` is null. A plain string is accepted (a route
 * param): an id that is not a challenge of the viewer's reads as null.
 */
export function useChallengeHistory(
  challengeId: Id<"challenges"> | string | null | undefined,
  untilIso: string = addDays(todayIso(), -1),
  partnerUntilIso?: string,
  otherToDates?: { key: string; toDate: string }[],
): ChallengeHistory | null | undefined {
  const dates = partnerUntilIso && partnerUntilIso !== untilIso ? { toDate: untilIso, partnerToDate: partnerUntilIso } : { toDate: untilIso }
  // Only a group sends per-member dates; two people need no more than `partnerToDate`.
  const group = otherToDates && isGroup(otherToDates.length) ? { otherToDates } : {}
  return useQuery(api.challenges.history, challengeId ? { challengeId, ...dates, ...group } : "skip")
}

/** Each other member's own yesterday, for `useChallengeHistory`, from their own today. */
export function otherToDatesOf(others: { member: { key: string }; date: string }[]): { key: string; toDate: string }[] {
  return memberToDates(others.map((o) => ({ key: o.member.key, date: o.date })))
}
