import { describe, it, expect } from 'vitest'
import { addDays, weekForDay, computeStreak, computeBestStreak, dayCountsForStreak } from './dateUtils'
import type { DayState } from './types'

// ── addDays ──────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('+1 normal day', () => {
    expect(addDays('2026-05-12', 1)).toBe('2026-05-13')
  })

  it('-1 normal day', () => {
    expect(addDays('2026-05-12', -1)).toBe('2026-05-11')
  })

  it('+1 crosses month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('+1 crosses year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('-1 crosses month boundary', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('+0 returns same date', () => {
    expect(addDays('2026-05-12', 0)).toBe('2026-05-12')
  })

  it('+7 is same weekday next week', () => {
    expect(addDays('2026-05-12', 7)).toBe('2026-05-19')
  })
})

// ── weekForDay ───────────────────────────────────────────────────────────────

describe('weekForDay', () => {
  it('always returns exactly 7 days', () => {
    expect(weekForDay('2026-05-12').days).toHaveLength(7)
  })

  it('week starts on Monday', () => {
    const { days } = weekForDay('2026-05-12') // Tuesday
    expect(days[0]).toBe('2026-05-11') // Monday
  })

  it('week ends on Sunday', () => {
    const { days } = weekForDay('2026-05-12')
    expect(days[6]).toBe('2026-05-17') // Sunday
  })

  it('Monday input returns its own week correctly', () => {
    const { days } = weekForDay('2026-05-11') // Monday
    expect(days[0]).toBe('2026-05-11')
    expect(days[6]).toBe('2026-05-17')
  })

  it('Sunday input falls in its ending week', () => {
    const { days } = weekForDay('2026-05-17') // Sunday
    expect(days[0]).toBe('2026-05-11')
    expect(days[6]).toBe('2026-05-17')
  })

  it('days are consecutive', () => {
    const { days } = weekForDay('2026-05-12')
    for (let i = 1; i < days.length; i++) {
      expect(addDays(days[i - 1]!, 1)).toBe(days[i])
    }
  })
})

// ── normalizeHhmm ─────────────────────────────────────────────────────────────

// ── computeStreak ─────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  it('returns 0 for empty array', () => {
    expect(computeStreak([])).toBe(0)
  })

  it('returns 1 for single day', () => {
    expect(computeStreak(['2026-05-12'])).toBe(1)
  })

  it('counts consecutive days from the end', () => {
    expect(computeStreak(['2026-05-10', '2026-05-11', '2026-05-12'])).toBe(3)
  })

  it('stops at first gap', () => {
    // Gap between 10 and 12 — streak from end is only 1 (just the 12th)
    expect(computeStreak(['2026-05-10', '2026-05-12'])).toBe(1)
  })

  it('streak resets after gap even with long prior run', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-10', '2026-05-11']
    expect(computeStreak(days)).toBe(2)
  })

  it('deduplicates duplicate days', () => {
    expect(computeStreak(['2026-05-12', '2026-05-12', '2026-05-11'])).toBe(2)
  })
})

// ── computeBestStreak ─────────────────────────────────────────────────────────

describe('computeBestStreak', () => {
  it('returns 0 for empty array', () => {
    expect(computeBestStreak([])).toBe(0)
  })

  it('returns length of only run', () => {
    expect(computeBestStreak(['2026-05-10', '2026-05-11', '2026-05-12'])).toBe(3)
  })

  it('returns the longest run when there are multiple runs', () => {
    const days = [
      '2026-05-01', '2026-05-02',           // run of 2
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13', // run of 4
      '2026-05-20',                          // run of 1
    ]
    expect(computeBestStreak(days)).toBe(4)
  })

  it('handles single day', () => {
    expect(computeBestStreak(['2026-05-12'])).toBe(1)
  })
})

// ── dayCountsForStreak ────────────────────────────────────────────────────────

describe('dayCountsForStreak', () => {
  it('returns false for undefined day', () => {
    expect(dayCountsForStreak(undefined)).toBe(false)
  })

  it('returns false when no tasks', () => {
    const day = { tasks: [], deepWorkSessions: [] } as unknown as DayState
    expect(dayCountsForStreak(day)).toBe(false)
  })

  it('returns false when tasks exist but none are done', () => {
    const day = {
      tasks: [{ id: '1', isDone: false, title: 'x', sectionId: 'highPriority', date: '2026-05-12' }],
      deepWorkSessions: [],
    } as unknown as DayState
    expect(dayCountsForStreak(day)).toBe(false)
  })

  it('returns true when at least one task is done', () => {
    const day = {
      tasks: [
        { id: '1', isDone: false, title: 'x', sectionId: 'highPriority', date: '2026-05-12' },
        { id: '2', isDone: true,  title: 'y', sectionId: 'highPriority', date: '2026-05-12' },
      ],
      deepWorkSessions: [],
    } as unknown as DayState
    expect(dayCountsForStreak(day)).toBe(true)
  })
})

// ── toMonthId / previousMonthId / nextMonthId ─────────────────────────────────
