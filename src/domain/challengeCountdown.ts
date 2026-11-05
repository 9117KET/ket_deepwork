/**
 * domain/challengeCountdown.ts
 *
 * What one member owes a challenge next today and how long until its
 * deadline, judged on the member's own clock, plus the days-left headline.
 * Pure: time always comes in as an argument, never from Date.now().
 */

import type { ChallengeProgress, ChallengeSpan } from './challenge'

export type CountdownState =
  | { kind: 'lock'; deadlineMs: number; msLeft: number }
  | { kind: 'checkin'; deadlineMs: number; msLeft: number; planMissed: boolean }
  | { kind: 'closed'; planMissed: boolean }
  | { kind: 'done' }
  | { kind: 'idle' }

/**
 * The instant `hhmm` on `dateIso` in the device's local time. Never UTC: the
 * deadlines are wall-clock times in the member's zone, and the server judges
 * them in that same zone, so on a DST day 23:59 still means 23:59.
 */
export function localDeadlineMs(dateIso: string, hhmm: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return new Date(y!, m! - 1, d!, hh!, mm!, 0, 0).getTime()
}

export function countdownState(args: {
  nowMs: number
  todayIso: string
  planDeadline: string
  checkinDeadline: string
  planSetAt: number | null | undefined
  checkinAt: number | null | undefined
  running: boolean
}): CountdownState {
  const { nowMs, todayIso, planDeadline, checkinDeadline, planSetAt, checkinAt, running } = args
  if (!running) return { kind: 'idle' }
  if (checkinAt != null) return { kind: 'done' }
  const planAt = localDeadlineMs(todayIso, planDeadline)
  const checkAt = localDeadlineMs(todayIso, checkinDeadline)
  const planMissed = planSetAt == null
  // A check-in without a plan is allowed, so once the plan deadline passes
  // the countdown moves on; it never counts down to a deadline already gone.
  if (planMissed && nowMs < planAt) return { kind: 'lock', deadlineMs: planAt, msLeft: planAt - nowMs }
  if (nowMs < checkAt) return { kind: 'checkin', deadlineMs: checkAt, msLeft: checkAt - nowMs, planMissed }
  return { kind: 'closed', planMissed }
}

/** "2:14:33": hours unpadded, minutes and seconds two digits, floored to the second. */
export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return '0:00:00'
  const total = Math.floor(msLeft / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** "2h 14m left", to the minute, for the Today block. */
export function formatCountdownCoarse(msLeft: number): string {
  if (msLeft <= 0) return '0m left'
  if (msLeft < 60_000) return 'under a minute left'
  const minutes = Math.floor(msLeft / 60_000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m left`
  if (m === 0) return `${h}h left`
  return `${h}h ${m}m left`
}

export function countdownLine(
  state: CountdownState,
  deadlines: { planDeadline: string; checkinDeadline: string },
  precise: boolean,
): string | null {
  const time = (ms: number) => (precise ? `${formatCountdown(ms)} left` : formatCountdownCoarse(ms))
  const missed = (planMissed: boolean) => (planMissed ? ' · plan not locked' : '')
  switch (state.kind) {
    case 'lock':
      return `Lock in by ${deadlines.planDeadline} · ${time(state.msLeft)}`
    case 'checkin':
      return `Check in by ${deadlines.checkinDeadline} · ${time(state.msLeft)}${missed(state.planMissed)}`
    case 'closed':
      return `Check-in deadline passed${missed(state.planMissed)}`
    case 'done':
      return 'Done for today'
    case 'idle':
      return null
  }
}

export interface DaysLeftHeadline {
  number: string | null
  label: string
}

const DAY_MS = 86_400_000

/** Same UTC day arithmetic as `challengeProgress`, so a DST change never shifts a count. */
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

export function daysLeftHeadline(progress: ChallengeProgress, span: ChallengeSpan, todayIso: string): DaysLeftHeadline {
  if (progress.phase === 'ended') return { number: null, label: 'Season over' }
  if (progress.phase === 'upcoming') {
    const n = Math.round((utcDay(span.startDate) - utcDay(todayIso)) / DAY_MS)
    return { number: null, label: n <= 1 ? 'Starts tomorrow' : `Starts in ${n} days` }
  }
  if (progress.daysLeft <= 0) return { number: null, label: 'Last day' }
  if (progress.daysLeft === 1) return { number: '1', label: 'day left' }
  return { number: String(progress.daysLeft), label: 'days left' }
}
