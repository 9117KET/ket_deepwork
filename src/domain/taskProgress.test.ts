import { describe, it, expect } from 'vitest'
import {
  computeTaskProgress,
  computeTimerMinutesForTask,
  describeTaskProgress,
  formatMinutes,
  MIN_TRACKABLE_MINUTES,
  SLOT_MINUTES,
} from './taskProgress'
import type { DeepWorkSession, Task } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Write the chapter',
    sectionId: 'highPriority',
    date: '2026-08-26',
    isDone: false,
    ...overrides,
  }
}

let seq = 0
function session(overrides: Partial<DeepWorkSession> = {}): DeepWorkSession {
  seq += 1
  return {
    id: `dw${seq}`,
    label: 'Deep work block',
    durationMinutes: 30,
    startedAt: '2026-08-26T09:00:00.000Z',
    finishedAt: '2026-08-26T09:30:00.000Z',
    ...overrides,
  }
}

/** Compact view of a row: capacity, timer, manual, overflow. */
function shape(t: Task, sessions: DeepWorkSession[] = []) {
  const progress = computeTaskProgress(t, sessions)
  return progress?.slots.map((s) => [s.capacityMinutes, s.timerMinutes, s.manualMinutes, s.isOverflow])
}

// ── trackability ─────────────────────────────────────────────────────────────

describe('computeTaskProgress trackability', () => {
  it('returns null when the task has no duration', () => {
    expect(computeTaskProgress(task(), [])).toBeNull()
  })

  it('returns null below the minimum trackable duration', () => {
    expect(computeTaskProgress(task({ durationMinutes: MIN_TRACKABLE_MINUTES - 1 }), [])).toBeNull()
  })

  it('tracks a task at exactly one slot', () => {
    expect(shape(task({ durationMinutes: SLOT_MINUTES }))).toEqual([[30, 0, 0, false]])
  })

  it('ignores a nonsense duration', () => {
    expect(computeTaskProgress(task({ durationMinutes: Number.NaN }), [])).toBeNull()
    expect(computeTaskProgress(task({ durationMinutes: -120 }), [])).toBeNull()
  })
})

// ── slot layout ──────────────────────────────────────────────────────────────

describe('slot layout', () => {
  it('splits an exact multiple into full slots', () => {
    expect(shape(task({ durationMinutes: 120 }))).toEqual([
      [30, 0, 0, false],
      [30, 0, 0, false],
      [30, 0, 0, false],
      [30, 0, 0, false],
    ])
  })

  it('gives the trailing slot the remainder rather than a full 30', () => {
    expect(shape(task({ durationMinutes: 45 }))).toEqual([
      [30, 0, 0, false],
      [15, 0, 0, false],
    ])
  })

  it('handles a long task', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 480 }), [])
    expect(progress?.slots).toHaveLength(16)
    expect(progress?.slots.every((s) => s.capacityMinutes === 30)).toBe(true)
  })
})

// ── timer attribution ────────────────────────────────────────────────────────

describe('computeTimerMinutesForTask', () => {
  it('sums only sessions attributed to the task', () => {
    const sessions = [
      session({ taskId: 't1', durationMinutes: 30 }),
      session({ taskId: 't2', durationMinutes: 60 }),
      session({ durationMinutes: 90 }), // unattributed legacy session
    ]
    expect(computeTimerMinutesForTask('t1', sessions)).toBe(30)
  })

  it('ignores cancelled sessions', () => {
    const sessions = [
      session({ taskId: 't1', durationMinutes: 30 }),
      session({ taskId: 't1', durationMinutes: 30, cancelledAt: '2026-08-26T10:00:00.000Z' }),
    ]
    expect(computeTimerMinutesForTask('t1', sessions)).toBe(30)
  })

  it('ignores zero and negative durations', () => {
    const sessions = [
      session({ taskId: 't1', durationMinutes: 0 }),
      session({ taskId: 't1', durationMinutes: -30 }),
      session({ taskId: 't1', durationMinutes: 25 }),
    ]
    expect(computeTimerMinutesForTask('t1', sessions)).toBe(25)
  })
})

// ── filling ──────────────────────────────────────────────────────────────────

describe('filling slots', () => {
  it('fills a slot from a completed timer session', () => {
    expect(shape(task({ durationMinutes: 60 }), [session({ taskId: 't1', durationMinutes: 30 })])).toEqual([
      [30, 30, 0, false],
      [30, 0, 0, false],
    ])
  })

  it('part-fills a slot from a short session instead of rounding it away', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60 }), [
      session({ taskId: 't1', durationMinutes: 25 }),
    ])
    expect(progress?.slots[0].timerMinutes).toBe(25)
    expect(progress?.slots[0].filledRatio).toBeCloseTo(25 / 30)
    expect(progress?.slots[1].filledRatio).toBe(0)
  })

  it('spills a long session across slots', () => {
    expect(shape(task({ durationMinutes: 120 }), [session({ taskId: 't1', durationMinutes: 75 })])).toEqual([
      [30, 30, 0, false],
      [30, 30, 0, false],
      [30, 15, 0, false],
      [30, 0, 0, false],
    ])
  })

  it('fills timer minutes ahead of manual minutes so earned work leads the row', () => {
    expect(
      shape(task({ durationMinutes: 120, manualLoggedMinutes: 30 }), [
        session({ taskId: 't1', durationMinutes: 30 }),
      ]),
    ).toEqual([
      [30, 30, 0, false],
      [30, 0, 30, false],
      [30, 0, 0, false],
      [30, 0, 0, false],
    ])
  })

  it('lets timer and manual minutes share a slot, timer first', () => {
    expect(
      shape(task({ durationMinutes: 60, manualLoggedMinutes: 30 }), [
        session({ taskId: 't1', durationMinutes: 15 }),
      ]),
    ).toEqual([
      [30, 15, 15, false],
      [30, 0, 15, false],
    ])
  })

  it('fills the short trailing slot correctly', () => {
    expect(shape(task({ durationMinutes: 45 }), [session({ taskId: 't1', durationMinutes: 45 })])).toEqual([
      [30, 30, 0, false],
      [15, 15, 0, false],
    ])
  })
})

// ── overflow ─────────────────────────────────────────────────────────────────

describe('overflow', () => {
  it('adds overflow slots when more is logged than planned', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60 }), [
      session({ taskId: 't1', durationMinutes: 90 }),
    ])
    expect(progress?.isOverflowing).toBe(true)
    expect(progress?.slots).toEqual([
      { capacityMinutes: 30, timerMinutes: 30, manualMinutes: 0, filledRatio: 1, isOverflow: false },
      { capacityMinutes: 30, timerMinutes: 30, manualMinutes: 0, filledRatio: 1, isOverflow: false },
      { capacityMinutes: 30, timerMinutes: 30, manualMinutes: 0, filledRatio: 1, isOverflow: true },
    ])
  })

  it('part-fills a trailing overflow slot', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 30 }), [
      session({ taskId: 't1', durationMinutes: 40 }),
    ])
    expect(progress?.slots).toHaveLength(2)
    expect(progress?.slots[1].isOverflow).toBe(true)
    expect(progress?.slots[1].timerMinutes).toBe(10)
  })

  it('is not overflowing when logged exactly matches planned', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60 }), [
      session({ taskId: 't1', durationMinutes: 60 }),
    ])
    expect(progress?.isOverflowing).toBe(false)
    expect(progress?.isComplete).toBe(true)
    expect(progress?.slots).toHaveLength(2)
  })
})

// ── totals and legacy data ───────────────────────────────────────────────────

describe('totals', () => {
  it('reports timer, manual and total minutes', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 180, manualLoggedMinutes: 30 }), [
      session({ taskId: 't1', durationMinutes: 60 }),
    ])
    expect(progress?.timerMinutes).toBe(60)
    expect(progress?.manualMinutes).toBe(30)
    expect(progress?.totalMinutes).toBe(90)
    expect(progress?.isComplete).toBe(false)
  })

  it('treats a task with no logged work as an empty row', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 90 }), [])
    expect(progress?.totalMinutes).toBe(0)
    expect(progress?.slots.every((s) => s.filledRatio === 0)).toBe(true)
  })

  it('ignores a negative manual value', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60, manualLoggedMinutes: -30 }), [])
    expect(progress?.manualMinutes).toBe(0)
  })

  it('renders an empty row for legacy tasks whose sessions have no taskId', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60 }), [session({ durationMinutes: 60 })])
    expect(progress?.totalMinutes).toBe(0)
  })
})

// ── formatting ───────────────────────────────────────────────────────────────

describe('formatMinutes', () => {
  it('formats minutes, whole hours and mixed', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(90)).toBe('1h30')
    expect(formatMinutes(0)).toBe('0m')
  })
})

describe('describeTaskProgress', () => {
  it('breaks the total down by source', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 180, manualLoggedMinutes: 30 }), [
      session({ taskId: 't1', durationMinutes: 60 }),
    ])!
    expect(describeTaskProgress(progress)).toBe('1h30 of 3h logged - 1h by timer, 30m by hand')
  })

  it('omits the breakdown when nothing is logged', () => {
    const progress = computeTaskProgress(task({ durationMinutes: 60 }), [])!
    expect(describeTaskProgress(progress)).toBe('0m of 1h logged')
  })
})
