/**
 * convex/_shared/challengeGroup.test.ts
 *
 * The pure rules of group challenges and reopening. Run with: npm run test:convex
 */
import { describe, expect, test } from 'vitest'
import {
  MAX_CLOSED_SPANS,
  MAX_MEMBERS,
  activeInJoinOrder,
  appendClosedSpan,
  checkinDeadlinePhrase,
  closedSpanFor,
  firstClosedDate,
  nudgeTimesFor,
  reopenEndProblem,
  successorOf,
} from './challengeGroup'
import { countableDates, inactivityFrom } from './challengeInactivity'

const m = (userId: string, joinedAt: number, leftAt?: number) => ({ userId, joinedAt, ...(leftAt !== undefined ? { leftAt } : {}) })

describe('members', () => {
  test('eight seats', () => {
    expect(MAX_MEMBERS).toBe(8)
  })

  test('active members in join order; former members are left out', () => {
    const rows = [m('c', 30), m('a', 10), m('gone', 5, 99), m('b', 20)]
    expect(activeInJoinOrder(rows).map((r) => r.userId)).toEqual(['a', 'b', 'c'])
  })

  test('the successor is the longest-standing other active member', () => {
    const rows = [m('creator', 1), m('late', 30), m('former', 2, 50), m('early', 10)]
    expect(successorOf(rows, 'creator')?.userId).toBe('early')
    expect(successorOf([m('creator', 1)], 'creator')).toBeNull()
  })
})

describe('closed spans', () => {
  test('from the end date to the day before the reopen', () => {
    expect(closedSpanFor({ endedDate: '2026-11-03', actedOnEndedDate: false, reopenedDate: '2026-11-10' })).toEqual({
      from: '2026-11-03',
      to: '2026-11-09',
    })
  })

  test('an end day someone acted on was lived: the span starts the day after', () => {
    expect(closedSpanFor({ endedDate: '2026-11-03', actedOnEndedDate: true, reopenedDate: '2026-11-10' })).toEqual({
      from: '2026-11-04',
      to: '2026-11-09',
    })
  })

  test('a reopen on the day it ended records none; nor the next day after a lived end day', () => {
    expect(closedSpanFor({ endedDate: '2026-11-03', actedOnEndedDate: false, reopenedDate: '2026-11-03' })).toBeNull()
    expect(closedSpanFor({ endedDate: '2026-11-03', actedOnEndedDate: true, reopenedDate: '2026-11-04' })).toBeNull()
  })

  test('only the newest twenty are kept', () => {
    const many = Array.from({ length: MAX_CLOSED_SPANS }, (_, i) => ({ from: `2026-01-${String(i + 1).padStart(2, '0')}`, to: '2026-01-31' }))
    const next = appendClosedSpan(many, { from: '2026-02-01', to: '2026-02-02' })
    expect(next).toHaveLength(MAX_CLOSED_SPANS)
    expect(next[0]!.from).toBe('2026-01-02')
    expect(next[next.length - 1]).toEqual({ from: '2026-02-01', to: '2026-02-02' })
    expect(appendClosedSpan(undefined, null)).toEqual([])
  })

  test('the first closed date is the earliest from', () => {
    expect(firstClosedDate([{ from: '2026-11-05', to: '2026-11-06' }, { from: '2026-11-01', to: '2026-11-02' }])).toBe('2026-11-01')
    expect(firstClosedDate(undefined)).toBeNull()
  })
})

describe('reopen end date', () => {
  const base = { startDate: '2026-01-01', reopenDay: '2026-11-11', memberTodays: ['2026-11-11', '2026-11-10'] }

  test('a past end date needs a new one', () => {
    expect(reopenEndProblem({ ...base, endDate: '2026-11-10' })).toBe('needsEndDate')
    // Judged on every member's clock: one member is already on the 12th.
    expect(reopenEndProblem({ ...base, memberTodays: ['2026-11-12'], endDate: '2026-11-11' })).toBe('needsEndDate')
  })

  test('at most 366 days from the reopen day, whatever the original start', () => {
    expect(reopenEndProblem({ ...base, endDate: '2027-11-11' })).toBe(null)
    expect(reopenEndProblem({ ...base, endDate: '2027-11-12' })).toBe('tooLong')
  })

  test('not before the start', () => {
    expect(reopenEndProblem({ ...base, startDate: '2026-12-01', endDate: '2026-11-20' })).toBe('beforeStart')
  })
})

describe('nudges per target', () => {
  test('per-target lists are judged per key', () => {
    const row = { nudgesSentAt: [1, 2, 3], nudgesByMember: { a: [1, 2], b: [3] } }
    expect(nudgeTimesFor(row, 'a', true)).toEqual([1, 2])
    expect(nudgeTimesFor(row, 'b', false)).toEqual([3])
    expect(nudgeTimesFor(row, 'c', false)).toEqual([])
  })

  test('a row from before per-target bookkeeping counts for the first other member only', () => {
    expect(nudgeTimesFor({ nudgesSentAt: [5, 4] }, 'a', true)).toEqual([4, 5])
    expect(nudgeTimesFor({ nudgeSentAt: 7 }, 'a', true)).toEqual([7])
    expect(nudgeTimesFor({ nudgesSentAt: [5] }, 'b', false)).toEqual([])
    expect(nudgeTimesFor(null, 'a', true)).toEqual([])
  })
})

describe('check-in deadline in words', () => {
  test('midnight only for 23:59', () => {
    expect(checkinDeadlinePhrase('23:59')).toBe('midnight')
    expect(checkinDeadlinePhrase('22:00')).toBe('22:00')
    expect(checkinDeadlinePhrase('23:30')).toBe('23:30')
  })
})

describe('inactivity after a reopen', () => {
  test('no day up to and including the reopen day counts', () => {
    expect(inactivityFrom('2026-10-01', '2026-11-10')).toBe('2026-11-11')
    expect(inactivityFrom('2026-11-12', '2026-11-10')).toBe('2026-11-12')
    expect(inactivityFrom('2026-10-01', undefined)).toBe('2026-10-01')
    // Reopened on the 10th: on the 11th nothing counts; on the 14th, three days; on the 15th, four.
    expect(countableDates(inactivityFrom('2026-10-01', '2026-11-10'), '2026-10-01', '2026-11-11', 4)).toEqual([])
    expect(countableDates(inactivityFrom('2026-10-01', '2026-11-10'), '2026-10-01', '2026-11-14', 4)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ])
    expect(countableDates(inactivityFrom('2026-10-01', '2026-11-10'), '2026-10-01', '2026-11-15', 4)).toHaveLength(4)
  })
})
