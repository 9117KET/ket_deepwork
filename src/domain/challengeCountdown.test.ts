import { afterEach, describe, expect, it, vi } from 'vitest'
import { challengeProgress, type ChallengeSpan } from './challenge'
import {
  countdownLine,
  countdownState,
  daysLeftHeadline,
  formatCountdown,
  formatCountdownCoarse,
  localDeadlineMs,
  type CountdownState,
} from './challengeCountdown'

const TODAY = '2026-11-05'
const deadlines = { planDeadline: '10:00', checkinDeadline: '23:59' }
const at = (hh: number, mm: number, ss = 0) => new Date(2026, 10, 5, hh, mm, ss, 0).getTime()
const PLAN_AT = at(10, 0)
const CHECK_AT = at(23, 59)

function state(nowMs: number, over: Partial<Parameters<typeof countdownState>[0]> = {}): CountdownState {
  return countdownState({
    nowMs,
    todayIso: TODAY,
    ...deadlines,
    planSetAt: null,
    checkinAt: null,
    running: true,
    ...over,
  })
}

describe('localDeadlineMs', () => {
  it('is device local time, never UTC', () => {
    expect(localDeadlineMs('2026-11-05', '10:00')).toBe(new Date(2026, 10, 5, 10, 0).getTime())
    expect(localDeadlineMs('2026-03-29', '23:59')).toBe(new Date(2026, 2, 29, 23, 59).getTime())
  })

  it('flips lock to checkin at exactly the plan deadline', () => {
    const planAt = localDeadlineMs('2026-11-05', '10:00')
    expect(state(planAt - 1)).toEqual({ kind: 'lock', deadlineMs: planAt, msLeft: 1 })
    expect(state(planAt)).toEqual({ kind: 'checkin', deadlineMs: CHECK_AT, msLeft: CHECK_AT - planAt, planMissed: true })
  })
})

describe('countdownState', () => {
  it('is idle when the challenge is not running today, whatever else holds', () => {
    expect(state(at(9, 0), { running: false })).toEqual({ kind: 'idle' })
    expect(state(at(9, 0), { running: false, checkinAt: 1 })).toEqual({ kind: 'idle' })
  })

  it('is done once checked in, with or without a plan', () => {
    expect(state(at(9, 0), { checkinAt: at(8, 0) })).toEqual({ kind: 'done' })
    expect(state(at(23, 59, 30), { planSetAt: at(8, 0), checkinAt: at(23, 0) })).toEqual({ kind: 'done' })
  })

  it('counts down to the plan deadline while no plan is locked', () => {
    expect(state(at(9, 0))).toEqual({ kind: 'lock', deadlineMs: PLAN_AT, msLeft: 3_600_000 })
  })

  it('counts down to the check-in once the plan is locked, even before the plan deadline', () => {
    expect(state(at(9, 0), { planSetAt: at(8, 30) })).toEqual({
      kind: 'checkin',
      deadlineMs: CHECK_AT,
      msLeft: CHECK_AT - at(9, 0),
      planMissed: false,
    })
  })

  it('moves on to the check-in with planMissed when the plan deadline passed unlocked', () => {
    expect(state(at(12, 0))).toEqual({ kind: 'checkin', deadlineMs: CHECK_AT, msLeft: CHECK_AT - at(12, 0), planMissed: true })
  })

  it('is closed after the check-in deadline, saying whether the plan was missed', () => {
    expect(state(CHECK_AT)).toEqual({ kind: 'closed', planMissed: true })
    expect(state(CHECK_AT + 1, { planSetAt: at(9, 0) })).toEqual({ kind: 'closed', planMissed: false })
  })
})

describe('formatCountdown', () => {
  it('formats h:mm:ss with hours unpadded, floored to the second', () => {
    expect(formatCountdown(8_073_000)).toBe('2:14:33')
    expect(formatCountdown(873_000)).toBe('0:14:33')
    expect(formatCountdown(59_999)).toBe('0:00:59')
    expect(formatCountdown(36_000_000)).toBe('10:00:00')
    expect(formatCountdown(999)).toBe('0:00:00')
  })

  it('is 0:00:00 at or past zero', () => {
    expect(formatCountdown(0)).toBe('0:00:00')
    expect(formatCountdown(-5_000)).toBe('0:00:00')
  })
})

describe('formatCountdownCoarse', () => {
  it('formats hours and minutes, floored to the minute', () => {
    expect(formatCountdownCoarse(8_073_000)).toBe('2h 14m left')
    expect(formatCountdownCoarse(7_200_000)).toBe('2h left')
    expect(formatCountdownCoarse(7_259_999)).toBe('2h left')
    expect(formatCountdownCoarse(3_600_000)).toBe('1h left')
  })

  it('formats minutes under an hour', () => {
    expect(formatCountdownCoarse(3_599_999)).toBe('59m left')
    expect(formatCountdownCoarse(873_000)).toBe('14m left')
    expect(formatCountdownCoarse(60_000)).toBe('1m left')
  })

  it('says under a minute, then 0m', () => {
    expect(formatCountdownCoarse(59_999)).toBe('under a minute left')
    expect(formatCountdownCoarse(1)).toBe('under a minute left')
    expect(formatCountdownCoarse(0)).toBe('0m left')
    expect(formatCountdownCoarse(-1)).toBe('0m left')
  })
})

describe('countdownLine', () => {
  const lock: CountdownState = { kind: 'lock', deadlineMs: PLAN_AT, msLeft: 8_073_000 }
  const checkin: CountdownState = { kind: 'checkin', deadlineMs: CHECK_AT, msLeft: 18_131_000, planMissed: false }

  it('says the words exactly, to the second', () => {
    expect(countdownLine(lock, deadlines, true)).toBe('Lock in by 10:00 · 2:14:33 left')
    expect(countdownLine(checkin, deadlines, true)).toBe('Check in by 23:59 · 5:02:11 left')
    expect(countdownLine({ ...checkin, planMissed: true }, deadlines, true)).toBe(
      'Check in by 23:59 · 5:02:11 left · plan not locked',
    )
    expect(countdownLine({ kind: 'closed', planMissed: false }, deadlines, true)).toBe('Check-in deadline passed')
    expect(countdownLine({ kind: 'closed', planMissed: true }, deadlines, true)).toBe(
      'Check-in deadline passed · plan not locked',
    )
    expect(countdownLine({ kind: 'done' }, deadlines, true)).toBe('Done for today')
    expect(countdownLine({ kind: 'idle' }, deadlines, true)).toBeNull()
  })

  it('uses the same words to the minute for the Today block', () => {
    expect(countdownLine(lock, deadlines, false)).toBe('Lock in by 10:00 · 2h 14m left')
    expect(countdownLine(checkin, deadlines, false)).toBe('Check in by 23:59 · 5h 2m left')
    expect(countdownLine({ ...checkin, planMissed: true }, deadlines, false)).toBe(
      'Check in by 23:59 · 5h 2m left · plan not locked',
    )
    expect(countdownLine({ kind: 'closed', planMissed: true }, deadlines, false)).toBe(
      'Check-in deadline passed · plan not locked',
    )
    expect(countdownLine({ kind: 'done' }, deadlines, false)).toBe('Done for today')
    expect(countdownLine({ kind: 'idle' }, deadlines, false)).toBeNull()
  })
})

describe('daysLeftHeadline', () => {
  const span: ChallengeSpan = { startDate: '2026-10-01', endDate: '2026-12-31' }
  const headline = (today: string, s: ChallengeSpan = span) => daysLeftHeadline(challengeProgress(s, today), s, today)

  it('shows the number of days left while running', () => {
    expect(headline('2026-10-22')).toEqual({ number: '70', label: 'days left' })
    expect(headline('2026-12-29')).toEqual({ number: '2', label: 'days left' })
    expect(headline('2026-12-30')).toEqual({ number: '1', label: 'day left' })
    expect(headline('2026-12-31')).toEqual({ number: null, label: 'Last day' })
  })

  it('counts days to the start before it begins', () => {
    expect(headline('2026-09-30')).toEqual({ number: null, label: 'Starts tomorrow' })
    expect(headline('2026-09-26')).toEqual({ number: null, label: 'Starts in 5 days' })
    // Across the end of DST in Europe, UTC arithmetic still counts 3.
    const s = { startDate: '2026-10-27', endDate: '2026-11-30' }
    expect(headline('2026-10-24', s)).toEqual({ number: null, label: 'Starts in 3 days' })
  })

  it('says the season is over once it ended', () => {
    expect(headline('2027-01-01')).toEqual({ number: null, label: 'Season over' })
  })
})

describe('the whole day, on fake timers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('walks lock, checkin with and without a missed plan, done and closed', () => {
    vi.useFakeTimers()
    let planSetAt: number | null = null
    let checkinAt: number | null = null
    const now = () => state(Date.now(), { planSetAt, checkinAt })

    vi.setSystemTime(at(9, 0))
    const nine = now()
    expect(nine.kind).toBe('lock')
    expect(countdownLine(nine, deadlines, true)).toBe('Lock in by 10:00 · 1:00:00 left')

    vi.setSystemTime(at(10, 0, 0))
    expect(now()).toMatchObject({ kind: 'checkin', planMissed: true })

    vi.setSystemTime(at(10, 30))
    planSetAt = Date.now()
    expect(now()).toMatchObject({ kind: 'checkin', planMissed: false })

    vi.setSystemTime(at(21, 0))
    checkinAt = Date.now()
    expect(now()).toEqual({ kind: 'done' })

    // Another run of the same day where nobody checked in.
    checkinAt = null
    vi.setSystemTime(at(23, 59))
    expect(now()).toEqual({ kind: 'closed', planMissed: false })
  })
})
