import { describe, it, expect } from 'vitest'
import {
  computePerHabitStreaks,
  getAtRiskHabitIds,
  computeDailyDeepWorkMinutes,
  computeWeeklyDeepWorkHours,
} from '../domain/stats'
import type { DayState } from '../domain/types'

function makeDay(date: string, completions: Record<string, boolean> = {}): DayState {
  return { date, tasks: [], deepWorkSessions: [], habitCompletions: completions }
}

// ─── computePerHabitStreaks ───────────────────────────────────────────────────

describe('computePerHabitStreaks', () => {
  it('returns 0 for a habit with no completions', () => {
    const days = { '2026-05-19': makeDay('2026-05-19') }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-19')).toEqual({ h1: 0 })
  })

  it('counts a single-day streak', () => {
    const days = { '2026-05-19': makeDay('2026-05-19', { h1: true }) }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-19')).toEqual({ h1: 1 })
  })

  it('counts consecutive days correctly', () => {
    const days = {
      '2026-05-17': makeDay('2026-05-17', { h1: true }),
      '2026-05-18': makeDay('2026-05-18', { h1: true }),
      '2026-05-19': makeDay('2026-05-19', { h1: true }),
    }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-19')).toEqual({ h1: 3 })
  })

  it('stops streak at a missed day', () => {
    const days = {
      '2026-05-17': makeDay('2026-05-17', { h1: true }),
      '2026-05-18': makeDay('2026-05-18', { h1: false }),
      '2026-05-19': makeDay('2026-05-19', { h1: true }),
    }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-19')).toEqual({ h1: 1 })
  })

  it('handles multiple habits independently', () => {
    const days = {
      '2026-05-18': makeDay('2026-05-18', { h1: true, h2: false }),
      '2026-05-19': makeDay('2026-05-19', { h1: true, h2: true }),
    }
    const result = computePerHabitStreaks(days, ['h1', 'h2'], '2026-05-19')
    expect(result.h1).toBe(2)
    expect(result.h2).toBe(1)
  })

  it('returns 0 for habit not present in completions', () => {
    const days = { '2026-05-19': makeDay('2026-05-19', { other: true }) }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-19')).toEqual({ h1: 0 })
  })

  it('returns empty object for empty habit list', () => {
    const days = { '2026-05-19': makeDay('2026-05-19', { h1: true }) }
    expect(computePerHabitStreaks(days, [], '2026-05-19')).toEqual({})
  })
})

// ─── getAtRiskHabitIds ───────────────────────────────────────────────────────

describe('getAtRiskHabitIds', () => {
  it('flags habit missed yesterday but done day before', () => {
    const days = {
      '2026-05-17': makeDay('2026-05-17', { h1: true }),
      '2026-05-18': makeDay('2026-05-18', { h1: false }),
    }
    const result = getAtRiskHabitIds(days, ['h1'], '2026-05-19')
    expect(result.has('h1')).toBe(true)
  })

  it('does not flag habit completed yesterday', () => {
    const days = {
      '2026-05-17': makeDay('2026-05-17', { h1: true }),
      '2026-05-18': makeDay('2026-05-18', { h1: true }),
    }
    const result = getAtRiskHabitIds(days, ['h1'], '2026-05-19')
    expect(result.has('h1')).toBe(false)
  })

  it('does not flag habit missed both days (already broken streak)', () => {
    const days = {
      '2026-05-17': makeDay('2026-05-17', { h1: false }),
      '2026-05-18': makeDay('2026-05-18', { h1: false }),
    }
    const result = getAtRiskHabitIds(days, ['h1'], '2026-05-19')
    expect(result.has('h1')).toBe(false)
  })

  it('returns empty set for no habits', () => {
    const days = { '2026-05-18': makeDay('2026-05-18', { h1: false }) }
    expect(getAtRiskHabitIds(days, [], '2026-05-19').size).toBe(0)
  })

  it('handles missing day entries gracefully', () => {
    const result = getAtRiskHabitIds({}, ['h1'], '2026-05-19')
    expect(result.has('h1')).toBe(false)
  })
})

// ─── computeDailyDeepWorkMinutes ─────────────────────────────────────────────

describe('computeDailyDeepWorkMinutes', () => {
  it('returns 0 for undefined day', () => {
    expect(computeDailyDeepWorkMinutes(undefined)).toBe(0)
  })

  it('sums finished sessions', () => {
    const day: DayState = {
      date: '2026-05-19',
      tasks: [],
      deepWorkSessions: [
        { id: 's1', label: 'Code', durationMinutes: 45, startedAt: '', finishedAt: '2026-05-19T10:00:00Z' },
        { id: 's2', label: 'Read', durationMinutes: 30, startedAt: '', finishedAt: '2026-05-19T12:00:00Z' },
      ],
    }
    expect(computeDailyDeepWorkMinutes(day)).toBe(75)
  })

  it('excludes cancelled sessions', () => {
    const day: DayState = {
      date: '2026-05-19',
      tasks: [],
      deepWorkSessions: [
        { id: 's1', label: 'Code', durationMinutes: 45, startedAt: '', finishedAt: '2026-05-19T10:00:00Z' },
        { id: 's2', label: 'Cancelled', durationMinutes: 60, startedAt: '', finishedAt: '2026-05-19T11:00:00Z', cancelledAt: '2026-05-19T10:30:00Z' },
      ],
    }
    expect(computeDailyDeepWorkMinutes(day)).toBe(45)
  })

  it('excludes sessions with no finishedAt', () => {
    const day: DayState = {
      date: '2026-05-19',
      tasks: [],
      deepWorkSessions: [
        { id: 's1', label: 'In progress', durationMinutes: 45, startedAt: '' },
      ],
    }
    expect(computeDailyDeepWorkMinutes(day)).toBe(0)
  })

  it('returns 0 for a day with no sessions', () => {
    const day: DayState = { date: '2026-05-19', tasks: [], deepWorkSessions: [] }
    expect(computeDailyDeepWorkMinutes(day)).toBe(0)
  })
})

// ─── computeWeeklyDeepWorkHours ──────────────────────────────────────────────

describe('computeWeeklyDeepWorkHours', () => {
  it('returns 0 for a week with no sessions', () => {
    expect(computeWeeklyDeepWorkHours({}, ['2026-05-19', '2026-05-20'])).toBe(0)
  })

  it('converts minutes to hours correctly', () => {
    const days: Record<string, DayState> = {
      '2026-05-19': {
        date: '2026-05-19',
        tasks: [],
        deepWorkSessions: [
          { id: 's1', label: 'Code', durationMinutes: 90, startedAt: '', finishedAt: '2026-05-19T10:00:00Z' },
        ],
      },
      '2026-05-20': {
        date: '2026-05-20',
        tasks: [],
        deepWorkSessions: [
          { id: 's2', label: 'Read', durationMinutes: 30, startedAt: '', finishedAt: '2026-05-20T10:00:00Z' },
        ],
      },
    }
    expect(computeWeeklyDeepWorkHours(days, ['2026-05-19', '2026-05-20'])).toBe(2)
  })

  it('ignores days not in the weekDays list', () => {
    const days: Record<string, DayState> = {
      '2026-05-15': {
        date: '2026-05-15',
        tasks: [],
        deepWorkSessions: [
          { id: 's1', label: 'Excluded', durationMinutes: 120, startedAt: '', finishedAt: '2026-05-15T10:00:00Z' },
        ],
      },
    }
    expect(computeWeeklyDeepWorkHours(days, ['2026-05-19', '2026-05-20'])).toBe(0)
  })
})
