import { describe, expect, test } from 'vitest'
import { countableDates, inactivityDecision, missedRun, warningMissedSince } from './challengeInactivity'

describe('countableDates', () => {
  test('the last n full days before today, oldest first; today never counts', () => {
    expect(countableDates('2026-10-01', '2026-10-01', '2026-10-25', 4)).toEqual([
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ])
    expect(countableDates('2026-10-01', '2026-10-01', '2026-10-25', 4)).not.toContain('2026-10-25')
  })

  test('days before the join date or the start do not count', () => {
    expect(countableDates('2026-10-23', '2026-10-01', '2026-10-25', 4)).toEqual(['2026-10-23', '2026-10-24'])
    expect(countableDates('2026-09-01', '2026-10-24', '2026-10-25', 4)).toEqual(['2026-10-24'])
    expect(countableDates('2026-10-25', '2026-10-01', '2026-10-25', 4)).toEqual([])
  })

  test('crosses a month end', () => {
    expect(countableDates('2026-01-01', '2026-01-01', '2026-11-02', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
})

describe('missedRun', () => {
  const dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']

  test('a missing row and an empty row are both missed', () => {
    expect(missedRun([], dates)).toBe(4)
    expect(missedRun([{ date: '2026-10-22' }, { date: '2026-10-24', planSetAt: null, checkinAt: null }], dates)).toBe(4)
  })

  test('the run ends at the newest date and stops at the first act', () => {
    expect(missedRun([{ date: '2026-10-21', planSetAt: 1 }], dates)).toBe(3)
    expect(missedRun([{ date: '2026-10-22', checkinAt: 1 }], dates)).toBe(2)
    expect(missedRun([{ date: '2026-10-24', planSetAt: 1 }], dates)).toBe(0)
  })

  test('days that do not count are not missed', () => {
    // Joined on the 23rd: only two countable days, so the run cannot reach three.
    expect(missedRun([], countableDates('2026-10-23', '2026-10-01', '2026-10-25', 4))).toBe(2)
  })
})

describe('inactivityDecision', () => {
  const me = 'user-a'
  const other = 'user-b'

  test('warn at three with no warning on file; nothing below three', () => {
    expect(inactivityDecision({ missed: 3, warning: null, userId: me })).toBe('warn')
    expect(inactivityDecision({ missed: 4, warning: undefined, userId: me })).toBe('warn')
    expect(inactivityDecision({ missed: 2, warning: null, userId: me })).toBeNull()
  })

  test('close at four with a warning for that member, once a day has passed since the warning', () => {
    const warning = { userId: me, missedSince: '2026-10-21' }
    expect(inactivityDecision({ missed: 4, warning, userId: me, lastDate: '2026-10-24' })).toBe('close')
    expect(inactivityDecision({ missed: 4, warning, userId: me })).toBe('close')
    // Warned on first sight of a four-day run (missedSince is two days back): wait a day.
    expect(inactivityDecision({ missed: 4, warning: { userId: me, missedSince: '2026-10-22' }, userId: me, lastDate: '2026-10-24' })).toBeNull()
  })

  test('three with the warning already on file holds', () => {
    expect(inactivityDecision({ missed: 3, warning: { userId: me, missedSince: '2026-10-21' }, userId: me })).toBeNull()
  })

  test('clear when the latest day has an act', () => {
    expect(inactivityDecision({ missed: 0, warning: { userId: me, missedSince: '2026-10-21' }, userId: me })).toBe('clear')
    expect(inactivityDecision({ missed: 1, warning: { userId: me, missedSince: '2026-10-21' }, userId: me })).toBe('clear')
  })

  test('a warning for the other member does not close on this member\'s run', () => {
    const warning = { userId: other, missedSince: '2026-10-21' }
    expect(inactivityDecision({ missed: 4, warning, userId: me, lastDate: '2026-10-24' })).toBeNull()
    expect(inactivityDecision({ missed: 0, warning, userId: me })).toBeNull()
  })
})

describe('warningMissedSince', () => {
  test('the first of the three days the warning counts', () => {
    expect(warningMissedSince(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'])).toBe('2026-10-22')
    expect(warningMissedSince(['2026-10-22', '2026-10-23', '2026-10-24'])).toBe('2026-10-22')
  })
})
