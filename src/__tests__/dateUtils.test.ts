import { describe, it, expect } from 'vitest'
import { dayCountsForStreak, deriveActiveDaysFromDays } from '../domain/dateUtils'
import type { DayState } from '../domain/types'

function makeDay(date: string, tasks: Array<{ isDone: boolean }> = []): DayState {
  return {
    date,
    tasks: tasks.map((t, i) => ({
      id: `t${i}`,
      title: 'Task',
      isDone: t.isDone,
      sectionId: 'mustDo' as const,
      date,
    })),
    deepWorkSessions: [],
  }
}

// ─── dayCountsForStreak ───────────────────────────────────────────────────────

describe('dayCountsForStreak', () => {
  it('returns false for undefined', () => {
    expect(dayCountsForStreak(undefined)).toBe(false)
  })

  it('returns false for a day with no tasks', () => {
    expect(dayCountsForStreak(makeDay('2026-05-19'))).toBe(false)
  })

  it('returns false when tasks exist but none are done', () => {
    expect(dayCountsForStreak(makeDay('2026-05-19', [{ isDone: false }]))).toBe(false)
  })

  it('returns true when at least one task is done', () => {
    expect(dayCountsForStreak(makeDay('2026-05-19', [{ isDone: true }, { isDone: false }]))).toBe(true)
  })

  it('returns true when all tasks are done', () => {
    expect(dayCountsForStreak(makeDay('2026-05-19', [{ isDone: true }, { isDone: true }]))).toBe(true)
  })
})

// ─── deriveActiveDaysFromDays ────────────────────────────────────────────────

describe('deriveActiveDaysFromDays', () => {
  it('returns empty array for empty days', () => {
    expect(deriveActiveDaysFromDays({})).toEqual([])
  })

  it('excludes days with no tasks or no completions', () => {
    const days = {
      '2026-05-19': makeDay('2026-05-19', [{ isDone: false }]),
      '2026-05-20': makeDay('2026-05-20'),
    }
    expect(deriveActiveDaysFromDays(days)).toEqual([])
  })

  it('includes only days with at least one completed task', () => {
    const days = {
      '2026-05-18': makeDay('2026-05-18', [{ isDone: false }]),
      '2026-05-19': makeDay('2026-05-19', [{ isDone: true }]),
      '2026-05-20': makeDay('2026-05-20', [{ isDone: true }, { isDone: false }]),
    }
    expect(deriveActiveDaysFromDays(days)).toEqual(['2026-05-19', '2026-05-20'])
  })

  it('returns dates in sorted order', () => {
    const days = {
      '2026-05-21': makeDay('2026-05-21', [{ isDone: true }]),
      '2026-05-19': makeDay('2026-05-19', [{ isDone: true }]),
      '2026-05-20': makeDay('2026-05-20', [{ isDone: true }]),
    }
    expect(deriveActiveDaysFromDays(days)).toEqual(['2026-05-19', '2026-05-20', '2026-05-21'])
  })

  it('handles undefined day values gracefully', () => {
    const days: Record<string, DayState | undefined> = {
      '2026-05-19': undefined,
      '2026-05-20': makeDay('2026-05-20', [{ isDone: true }]),
    }
    expect(deriveActiveDaysFromDays(days)).toEqual(['2026-05-20'])
  })
})
