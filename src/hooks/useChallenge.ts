/**
 * hooks/useChallenge.ts
 *
 * The signed-in user's active challenge and both members' today, live.
 *
 * Two subscriptions: the challenge itself (rarely changes) and the two day
 * cards (change on every planner edit, but they are two small rows). The
 * season's history is a separate, heavier query that only the challenge
 * page and Review mount — see `useChallengeHistory`.
 */

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "../../convex/_generated/api"
import { useAuth } from "../contexts/AuthContext"
import { addDays, todayIso } from "../domain/dateUtils"
import { challengeProgress, type ChallengeProgress } from "../domain/challenge"
import { localDateIn } from "../services/challengeService"

export type ChallengeInfo = NonNullable<FunctionReturnType<typeof api.challenges.myChallenge>>
export type ChallengeDayCards = NonNullable<FunctionReturnType<typeof api.challenges.dayCards>>
export type ChallengeHistory = NonNullable<FunctionReturnType<typeof api.challenges.history>>

/** "ended": the last challenge has finished and no new one has started; it is shown read-only. */
export type ChallengeStatus = "signedOut" | "loading" | "none" | "active" | "ended"

export interface ChallengeState {
  status: ChallengeStatus
  info: ChallengeInfo | null
  progress: ChallengeProgress | null
  /** My local date and the partner's, which can differ by a day. */
  myDate: string
  partnerDate: string
  mine: ChallengeDayCards["mine"] | null
  partnerCard: ChallengeDayCards["partner"] | null
}

/**
 * `now` is a minute tick from the caller, so the partner's date rolls over
 * without a reload. Without it the partner is assumed to share the viewer's
 * date, which is fine for callers that never show the partner's card.
 */
export function useChallenge(now?: number): ChallengeState {
  const { user } = useAuth()
  const info = useQuery(api.challenges.myChallenge, user ? {} : "skip")
  const myDate = todayIso()
  const partnerDate = info?.partner && now != null ? localDateIn(info.partner.timezone, now) : myDate
  const cards = useQuery(api.challenges.dayCards, info ? { myDate, partnerDate } : "skip")

  const status: ChallengeStatus =
    !user ? "signedOut" : info === undefined ? "loading" : info === null ? "none" : info.challenge.status === "ended" ? "ended" : "active"
  return {
    status,
    info: info ?? null,
    progress: info ? challengeProgress(info.challenge, myDate) : null,
    myDate,
    partnerDate,
    mine: cards?.mine ?? null,
    partnerCard: cards?.partner ?? null,
  }
}

/**
 * Every recorded day up to yesterday. Today is deliberately left out: it is
 * rewritten on every edit, and this read set should not be. The partner's
 * rows run to `partnerUntilIso` (their own yesterday) when given, so a
 * partner a day ahead leaves no hole between history and their card.
 */
export function useChallengeHistory(
  enabled: boolean,
  untilIso: string = addDays(todayIso(), -1),
  partnerUntilIso?: string,
): ChallengeHistory | null | undefined {
  const args = partnerUntilIso && partnerUntilIso !== untilIso ? { toDate: untilIso, partnerToDate: partnerUntilIso } : { toDate: untilIso }
  return useQuery(api.challenges.history, enabled ? args : "skip")
}
