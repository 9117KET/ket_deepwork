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
 * `now` is a minute tick from the caller, so a partner's date rolls over
 * without a reload; each partner lives on their own clock.
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

export type ChallengeEntry = FunctionReturnType<typeof api.challenges.myChallenges>[number]
export type ChallengeDayCards = NonNullable<FunctionReturnType<typeof api.challenges.dayCards>>
export type ChallengeHistory = NonNullable<FunctionReturnType<typeof api.challenges.history>>
export type TodayCard = FunctionReturnType<typeof api.challenges.todayCards>[number]

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

export interface ChallengeDetail {
  status: ChallengeDetailStatus
  info: ChallengeEntry | null
  progress: ChallengeProgress | null
  /** My local date and the partner's, which can differ by a day. */
  myDate: string
  partnerDate: string
  mine: ChallengeDayCards["mine"] | null
  partnerCard: ChallengeDayCards["partner"] | null
}

export function useChallengeDetail(id: string | undefined, now: number): ChallengeDetail {
  const list = useChallenges()
  const info = list.entries.find((e) => e.challenge.id === id) ?? null
  const myDate = todayIso()
  const partnerDate = info ? partnerDateOf(info, now, myDate) : myDate
  const cards = useQuery(api.challenges.dayCards, info ? { challengeId: info.challenge.id, myDate, partnerDate } : "skip")
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
  }
}

export interface TodayRow {
  entry: ChallengeEntry
  progress: ChallengeProgress
  partnerDate: string
  /** Undefined while loading; null when there is no row yet. */
  mine: TodayCard["mine"] | null | undefined
  partner: TodayCard["partner"] | null | undefined
}

/** Today in every active challenge, one subscription. Rows keep the order of `active`. */
export function useTodayCards(active: ChallengeEntry[], now: number): { myDate: string; rows: TodayRow[]; loading: boolean } {
  const myDate = todayIso()
  const request = active.map((e) => ({ challengeId: e.challenge.id, partnerDate: partnerDateOf(e, now, myDate) }))
  const cards = useQuery(api.challenges.todayCards, request.length > 0 ? { myDate, cards: request } : "skip")
  const byId = new Map((cards ?? []).map((c) => [c.challengeId as string, c]))
  const rows = active.map((entry, i) => {
    const card = byId.get(entry.challenge.id)
    return {
      entry,
      progress: challengeProgress(entry.challenge, myDate),
      partnerDate: request[i]!.partnerDate,
      mine: cards === undefined ? undefined : (card?.mine ?? null),
      partner: cards === undefined ? undefined : (card?.partner ?? null),
    }
  })
  return { myDate, rows, loading: request.length > 0 && cards === undefined }
}

/**
 * Every recorded day up to yesterday. Today is deliberately left out: it is
 * rewritten on every edit, and this read set should not be. The partner's
 * rows run to `partnerUntilIso` (their own yesterday) when given, so a
 * partner a day ahead leaves no hole between history and their card.
 * Skipped while `challengeId` is null. A plain string is accepted (a route
 * param): an id that is not a challenge of the viewer's reads as null.
 */
export function useChallengeHistory(
  challengeId: Id<"challenges"> | string | null | undefined,
  untilIso: string = addDays(todayIso(), -1),
  partnerUntilIso?: string,
): ChallengeHistory | null | undefined {
  const dates = partnerUntilIso && partnerUntilIso !== untilIso ? { toDate: untilIso, partnerToDate: partnerUntilIso } : { toDate: untilIso }
  return useQuery(api.challenges.history, challengeId ? { challengeId, ...dates } : "skip")
}
