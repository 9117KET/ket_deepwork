import { describe, expect, it } from 'vitest'
import { computeBlockCompletion, computeHabitConsistency, weekDatesFor } from './reviewStats'
import type { DayState, Task, TaskSectionId } from './types'

function task(id: string, sectionId: TaskSectionId, isDone: boolean, parentId?: string): Task {
  return { id, title: id, sectionId, date: '2026-09-01', isDone, parentId }
}

function day(tasks: Task[], habitCompletions: Record<string, boolean> = {}): DayState {
  return { date: '2026-09-01', tasks, habitCompletions, deepWorkSessions: [] } as DayState
}

describe('computeBlockCompletion', () => {
  it('is null for a month with nothing planned', () => {
    expect(computeBlockCompletion({}, '2026-09').ratio).toBeNull()
  })

  it('scores a fully finished block as 1', () => {
    const days = { '2026-09-01': day([task('a', 'highPriority', true)]) }
    expect(computeBlockCompletion(days, '2026-09')).toMatchObject({
      ratio: 1, fullBlocks: 1, partialBlocks: 0, missedBlocks: 0,
    })
  })

  it('scores per block, not per task, so a long section cannot outweigh a short one', () => {
    // One block with 4 tasks all done, one block with 1 task not done.
    // Per block that is (1 + 0) / 2 = 0.5. Per task it would be 4/5 = 0.8.
    const days = {
      '2026-09-01': day([
        task('a', 'highPriority', true),
        task('b', 'highPriority', true),
        task('c', 'highPriority', true),
        task('d', 'highPriority', true),
        task('e', 'lowPriority', false),
      ]),
    }
    expect(computeBlockCompletion(days, '2026-09').ratio).toBe(0.5)
  })

  it('does not score a block with no tasks in it', () => {
    const days = { '2026-09-01': day([task('a', 'highPriority', true)]) }
    // Five other sections are empty and must not drag the ratio down.
    expect(computeBlockCompletion(days, '2026-09').ratio).toBe(1)
  })

  it('ignores subtasks, which belong to their parent', () => {
    const days = {
      '2026-09-01': day([task('p', 'highPriority', true), task('c', 'highPriority', false, 'p')]),
    }
    expect(computeBlockCompletion(days, '2026-09').ratio).toBe(1)
  })

  it('counts full, partial and missed blocks separately', () => {
    const days = {
      '2026-09-01': day([
        task('a', 'highPriority', true),
        task('b', 'mediumPriority', true),
        task('c', 'mediumPriority', false),
        task('d', 'lowPriority', false),
      ]),
    }
    expect(computeBlockCompletion(days, '2026-09')).toMatchObject({
      fullBlocks: 1, partialBlocks: 1, missedBlocks: 1,
    })
  })

  it('ignores days outside the month', () => {
    const days = {
      '2026-08-31': day([task('a', 'highPriority', false)]),
      '2026-09-01': day([task('b', 'highPriority', true)]),
    }
    expect(computeBlockCompletion(days, '2026-09').ratio).toBe(1)
  })
})

describe('computeHabitConsistency', () => {
  it('is null when no habits are configured', () => {
    expect(computeHabitConsistency({}, [], '2026-09', '2026-09-10')).toBeNull()
  })

  it('measures a past month over all of its days', () => {
    // August has 31 days. One habit, ticked on one day.
    const days = { '2026-08-01': day([], { h1: true }) }
    expect(computeHabitConsistency(days, ['h1'], '2026-08', '2026-09-10')).toBeCloseTo(1 / 31)
  })

  it('measures the current month against days elapsed, not the whole month', () => {
    // Two of the first two days ticked, viewed on the 2nd: that is 100%, not 2/30.
    const days = {
      '2026-09-01': day([], { h1: true }),
      '2026-09-02': day([], { h1: true }),
    }
    expect(computeHabitConsistency(days, ['h1'], '2026-09', '2026-09-02')).toBe(1)
  })

  it('counts every habit on every elapsed day in the denominator', () => {
    const days = { '2026-09-01': day([], { h1: true }) }
    // Two habits, one day elapsed, one tick => 1/2.
    expect(computeHabitConsistency(days, ['h1', 'h2'], '2026-09', '2026-09-01')).toBe(0.5)
  })

  it('does not count a tick that is not exactly true', () => {
    const days = { '2026-09-01': day([], { h1: false }) }
    expect(computeHabitConsistency(days, ['h1'], '2026-09', '2026-09-01')).toBe(0)
  })

  it('is null for a month that has not happened yet', () => {
    expect(computeHabitConsistency({}, ['h1'], '2026-12', '2026-09-02')).toBeNull()
  })
})

describe('weekDatesFor', () => {
  it('returns Monday through Sunday for a midweek day', () => {
    // 2026-09-02 is a Wednesday.
    expect(weekDatesFor('2026-09-02')).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
      '2026-09-04', '2026-09-05', '2026-09-06',
    ])
  })

  it('treats Sunday as the end of its week, not the start of the next', () => {
    // 2026-09-06 is a Sunday.
    expect(weekDatesFor('2026-09-06')[0]).toBe('2026-08-31')
    expect(weekDatesFor('2026-09-06')[6]).toBe('2026-09-06')
  })

  it('returns seven consecutive dates', () => {
    expect(weekDatesFor('2026-01-01')).toHaveLength(7)
  })
})
