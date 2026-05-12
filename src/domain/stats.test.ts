import { describe, it, expect } from 'vitest'
import {
  computePerHabitStreaks,
  getAtRiskHabitIds,
  computeDailyDeepWorkMinutes,
  computeSectionCompletion,
  computeWeeklyDeepWorkHours,
} from './stats'
import type { DayState, DeepWorkSession, Task } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DayState> = {}): DayState {
  return {
    date: '2026-05-12',
    tasks: [],
    deepWorkSessions: [],
    ...overrides,
  }
}

function session(id: string, minutes: number, opts: { cancelled?: boolean; finished?: boolean } = {}): DeepWorkSession {
  const finished = opts.finished !== false && !opts.cancelled
  return {
    id,
    label: 'Test',
    durationMinutes: minutes,
    startedAt: '2026-05-12T09:00:00Z',
    finishedAt: finished ? '2026-05-12T10:00:00Z' : undefined,
    cancelledAt: opts.cancelled ? '2026-05-12T09:30:00Z' : undefined,
  }
}

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    sectionId: 'highPriority',
    date: '2026-05-12',
    isDone: false,
    ...overrides,
  }
}

// ── computeDailyDeepWorkMinutes ───────────────────────────────────────────────

describe('computeDailyDeepWorkMinutes', () => {
  it('returns 0 for undefined day', () => {
    expect(computeDailyDeepWorkMinutes(undefined)).toBe(0)
  })

  it('returns 0 when no sessions', () => {
    expect(computeDailyDeepWorkMinutes(makeDay())).toBe(0)
  })

  it('sums finished sessions', () => {
    const day = makeDay({
      deepWorkSessions: [session('s1', 60), session('s2', 30)],
    })
    expect(computeDailyDeepWorkMinutes(day)).toBe(90)
  })

  it('excludes cancelled sessions', () => {
    const day = makeDay({
      deepWorkSessions: [session('s1', 60), session('s2', 45, { cancelled: true })],
    })
    expect(computeDailyDeepWorkMinutes(day)).toBe(60)
  })

  it('excludes unfinished (in-progress) sessions', () => {
    const day = makeDay({
      deepWorkSessions: [session('s1', 60), session('s2', 30, { finished: false })],
    })
    expect(computeDailyDeepWorkMinutes(day)).toBe(60)
  })
})

// ── computeWeeklyDeepWorkHours ────────────────────────────────────────────────

describe('computeWeeklyDeepWorkHours', () => {
  it('returns 0 when no sessions across week', () => {
    const days = { '2026-05-12': makeDay() }
    expect(computeWeeklyDeepWorkHours(days, ['2026-05-12'])).toBe(0)
  })

  it('converts minutes to hours correctly', () => {
    const days = {
      '2026-05-12': makeDay({ deepWorkSessions: [session('s1', 90)] }),
      '2026-05-13': makeDay({ deepWorkSessions: [session('s2', 30)] }),
    }
    expect(computeWeeklyDeepWorkHours(days, ['2026-05-12', '2026-05-13'])).toBe(2)
  })

  it('handles missing days gracefully', () => {
    expect(computeWeeklyDeepWorkHours({}, ['2026-05-12', '2026-05-13'])).toBe(0)
  })
})

// ── computePerHabitStreaks ────────────────────────────────────────────────────

describe('computePerHabitStreaks', () => {
  it('returns 0 for all habits when no completions', () => {
    const streaks = computePerHabitStreaks({}, ['h1', 'h2'], '2026-05-12')
    expect(streaks['h1']).toBe(0)
    expect(streaks['h2']).toBe(0)
  })

  it('counts consecutive days ending on untilDate', () => {
    const days = {
      '2026-05-10': makeDay({ habitCompletions: { h1: true } }),
      '2026-05-11': makeDay({ habitCompletions: { h1: true } }),
      '2026-05-12': makeDay({ habitCompletions: { h1: true } }),
    }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-12')['h1']).toBe(3)
  })

  it('stops streak at first missed day', () => {
    const days = {
      '2026-05-09': makeDay({ habitCompletions: { h1: true } }),
      '2026-05-10': makeDay({ habitCompletions: { h1: false } }), // missed
      '2026-05-11': makeDay({ habitCompletions: { h1: true } }),
      '2026-05-12': makeDay({ habitCompletions: { h1: true } }),
    }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-12')['h1']).toBe(2)
  })

  it('returns 0 when untilDate itself is not completed', () => {
    const days = {
      '2026-05-11': makeDay({ habitCompletions: { h1: true } }),
      '2026-05-12': makeDay({ habitCompletions: { h1: false } }),
    }
    expect(computePerHabitStreaks(days, ['h1'], '2026-05-12')['h1']).toBe(0)
  })

  it('tracks independent streaks per habit', () => {
    const days = {
      '2026-05-11': makeDay({ habitCompletions: { h1: true, h2: false } }),
      '2026-05-12': makeDay({ habitCompletions: { h1: true, h2: true } }),
    }
    const streaks = computePerHabitStreaks(days, ['h1', 'h2'], '2026-05-12')
    expect(streaks['h1']).toBe(2)
    expect(streaks['h2']).toBe(1)
  })
})

// ── getAtRiskHabitIds ─────────────────────────────────────────────────────────

describe('getAtRiskHabitIds', () => {
  const today = '2026-05-12'
  const yesterday = '2026-05-11'
  const dayBefore = '2026-05-10'

  it('returns empty set when all habits done yesterday', () => {
    const days = {
      [yesterday]: makeDay({ habitCompletions: { h1: true } }),
    }
    expect(getAtRiskHabitIds(days, ['h1'], today).size).toBe(0)
  })

  it('marks habit at-risk when missed yesterday but done day before', () => {
    const days = {
      [dayBefore]: makeDay({ habitCompletions: { h1: true } }),
      [yesterday]: makeDay({ habitCompletions: { h1: false } }),
    }
    expect(getAtRiskHabitIds(days, ['h1'], today).has('h1')).toBe(true)
  })

  it('does NOT mark at-risk when missed both days (not just yesterday)', () => {
    const days = {
      [dayBefore]: makeDay({ habitCompletions: { h1: false } }),
      [yesterday]: makeDay({ habitCompletions: { h1: false } }),
    }
    expect(getAtRiskHabitIds(days, ['h1'], today).has('h1')).toBe(false)
  })

  it('does NOT mark at-risk when no data at all for those days', () => {
    expect(getAtRiskHabitIds({}, ['h1'], today).has('h1')).toBe(false)
  })

  it('handles multiple habits independently', () => {
    const days = {
      [dayBefore]: makeDay({ habitCompletions: { h1: true,  h2: false } }),
      [yesterday]: makeDay({ habitCompletions: { h1: false, h2: false } }),
    }
    const atRisk = getAtRiskHabitIds(days, ['h1', 'h2'], today)
    expect(atRisk.has('h1')).toBe(true)
    expect(atRisk.has('h2')).toBe(false)
  })
})

// ── computeSectionCompletion ──────────────────────────────────────────────────

describe('computeSectionCompletion', () => {
  it('returns empty object for no tasks', () => {
    expect(computeSectionCompletion([])).toEqual({})
  })

  it('counts root tasks per section', () => {
    const tasks = [
      task('a', { sectionId: 'highPriority', isDone: true }),
      task('b', { sectionId: 'highPriority', isDone: false }),
      task('c', { sectionId: 'mediumPriority', isDone: true }),
    ]
    const result = computeSectionCompletion(tasks)
    expect(result['highPriority']).toEqual({ total: 2, completed: 1 })
    expect(result['mediumPriority']).toEqual({ total: 1, completed: 1 })
  })

  it('ignores subtasks (parentId set)', () => {
    const tasks = [
      task('p', { sectionId: 'highPriority' }),
      task('c', { sectionId: 'highPriority', parentId: 'p', isDone: true }),
    ]
    const result = computeSectionCompletion(tasks)
    expect(result['highPriority']).toEqual({ total: 1, completed: 0 })
  })
})
