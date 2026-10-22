/**
 * convex/_shared/challengeReminders.test.ts
 *
 * The reminder rules, pinned instant by instant in two timezones. Run with
 * `npm run test:convex` (this directory's tests share that config).
 */
import { describe, expect, test } from 'vitest'
import { zonedWallTimeToUtc } from './calendarTime'
import {
  CHECKIN_MAX_PER_DAY,
  PLAN_MAX_PER_DAY,
  hhmmToMinutes,
  isValidTimezone,
  localDateAndMinutes,
  reminderDecision,
  type ReminderDayRow,
} from './challengeReminders'

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'
const span = { startDate: '2026-10-01', endDate: '2026-12-31', planDeadline: '10:00', checkinDeadline: '23:59' }

const at = (date: string, hhmm: string, tz: string) => zonedWallTimeToUtc(date, `${hhmm}:00`, tz).getTime()
const decide = (nowMs: number, tz: string, dayRow: ReminderDayRow | null = null) =>
  reminderDecision({ nowMs, timezone: tz, dayRow, ...span })

describe('localDateAndMinutes', () => {
  test('reads the wall clock in the given zone, across the DST change', () => {
    expect(localDateAndMinutes(at('2026-10-22', '10:05', BERLIN), BERLIN)).toEqual({ date: '2026-10-22', minutes: 605 })
    // 10:05 in Berlin is 04:05 in New York, the same morning.
    expect(localDateAndMinutes(at('2026-10-22', '10:05', BERLIN), NY)).toEqual({ date: '2026-10-22', minutes: 245 })
    // 00:30 in New York is still the previous date in UTC terms for Berlin? No: 06:30 next morning.
    expect(localDateAndMinutes(at('2026-10-22', '00:30', NY), BERLIN)).toEqual({ date: '2026-10-22', minutes: 390 })
    // Europe leaves DST on 2026-10-25; the wall clock is still read correctly on both sides.
    expect(localDateAndMinutes(at('2026-10-25', '01:30', BERLIN), BERLIN).minutes).toBe(90)
    expect(localDateAndMinutes(at('2026-10-25', '09:00', BERLIN), BERLIN).minutes).toBe(540)
  })

  test('hhmmToMinutes and isValidTimezone', () => {
    expect(hhmmToMinutes('10:00')).toBe(600)
    expect(hhmmToMinutes('23:59')).toBe(1439)
    expect(isValidTimezone(BERLIN)).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
  })
})

describe('reminderDecision', () => {
  test('nothing before the plan deadline, a plan reminder after it', () => {
    expect(decide(at('2026-10-22', '09:45', BERLIN), BERLIN)).toBeNull()
    expect(decide(at('2026-10-22', '10:05', BERLIN), BERLIN)).toEqual({ kind: 'plan', localDate: '2026-10-22' })
  })

  test('each member is judged on their own clock', () => {
    const now = at('2026-10-22', '10:05', BERLIN)
    expect(decide(now, BERLIN)).toEqual({ kind: 'plan', localDate: '2026-10-22' })
    expect(decide(now, NY)).toBeNull()
  })

  test('a locked-in plan silences the plan reminder', () => {
    expect(decide(at('2026-10-22', '12:00', BERLIN), BERLIN, { planSetAt: 1 })).toBeNull()
  })

  test('repeats every two hours, four at most', () => {
    const first = at('2026-10-22', '10:05', BERLIN)
    const sent = (plan: number, lastAt: number): ReminderDayRow => ({ remindersSent: { plan, checkin: 0, lastAt } })
    expect(decide(first + 119 * 60_000, BERLIN, sent(1, first))).toBeNull()
    expect(decide(first + 120 * 60_000, BERLIN, sent(1, first))).toEqual({ kind: 'plan', localDate: '2026-10-22' })
    expect(decide(first + 120 * 60_000, BERLIN, sent(PLAN_MAX_PER_DAY, first))).toBeNull()
  })

  test('from 21:30 only the check-in is chased, until the deadline', () => {
    const evening = at('2026-10-22', '21:35', BERLIN)
    expect(decide(evening, BERLIN)).toEqual({ kind: 'checkin', localDate: '2026-10-22' })
    // No plan reminder in the evening even if the plan was never locked in.
    expect(decide(evening, BERLIN, { remindersSent: { plan: 1, checkin: 0, lastAt: evening - 3 * 60 * 60_000 } })).toEqual({
      kind: 'checkin',
      localDate: '2026-10-22',
    })
    expect(decide(evening, BERLIN, { checkinAt: 1 })).toBeNull()
    const sentOnce: ReminderDayRow = { remindersSent: { plan: 0, checkin: 1, lastAt: evening } }
    expect(decide(evening + 89 * 60_000, BERLIN, sentOnce)).toBeNull()
    expect(decide(evening + 90 * 60_000, BERLIN, sentOnce)).toEqual({ kind: 'checkin', localDate: '2026-10-22' })
    expect(decide(evening + 90 * 60_000, BERLIN, { remindersSent: { plan: 0, checkin: CHECKIN_MAX_PER_DAY, lastAt: evening } })).toBeNull()
    // The deadline itself is exclusive: 23:59 is past it.
    expect(decide(at('2026-10-22', '23:59', BERLIN), BERLIN)).toBeNull()
  })

  test('nothing outside the challenge span', () => {
    expect(decide(at('2026-09-30', '12:00', BERLIN), BERLIN)).toBeNull()
    expect(decide(at('2027-01-01', '12:00', BERLIN), BERLIN)).toBeNull()
    expect(decide(at('2026-12-31', '12:00', BERLIN), BERLIN)).toEqual({ kind: 'plan', localDate: '2026-12-31' })
  })
})
