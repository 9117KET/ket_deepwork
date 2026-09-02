/**
 * Scenarios a real user walks into that used to cost them recorded work.
 * Each block below is one of those, written as the failure first.
 */

import { describe, expect, it } from 'vitest'
import type { DayState, DeepWorkSession, Task } from './types'
import {
  MIN_BANKABLE_MINUTES,
  blockDayIso,
  describeWorkLoss,
  detachSessionsFromTasks,
  bankableMinutes,
  summarizeTaskWork,
  taskWithDescendantIds,
} from './workSafety'

const task = (over: Partial<Task> & Pick<Task, 'id'>): Task => ({
  title: 'A task',
  isDone: false,
  sectionId: 'highPriority',
  date: '2026-09-02',
  ...over,
})

const session = (over: Partial<DeepWorkSession> & Pick<DeepWorkSession, 'id'>): DeepWorkSession => ({
  label: 'Deep work block',
  durationMinutes: 45,
  startedAt: '2026-09-02T09:00:00.000Z',
  ...over,
})

const day = (tasks: Task[], sessions: DeepWorkSession[] = []): Pick<DayState, 'tasks' | 'deepWorkSessions'> => ({
  tasks,
  deepWorkSessions: sessions,
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: a block is running, and you page back a day to check something.
// ─────────────────────────────────────────────────────────────────────────────

describe('blockDayIso — a block belongs to the day it started on', () => {
  it('credits the start day, not whatever day is on screen when it lands', () => {
    // Started Sep 2 at 09:00 local. The user has since navigated to Sep 1.
    const startedAt = new Date(2026, 8, 2, 9, 0, 0).toISOString()
    expect(blockDayIso(startedAt, '2026-09-01')).toBe('2026-09-02')
  })

  it('uses local date parts, so an evening block is not pushed to tomorrow', () => {
    // 23:30 local on Sep 2 is already Sep 3 in UTC for positive offsets.
    const startedAt = new Date(2026, 8, 2, 23, 30, 0).toISOString()
    expect(blockDayIso(startedAt, '2026-09-02')).toBe('2026-09-02')
  })

  it('falls back to the day on screen when there is no start stamp', () => {
    expect(blockDayIso(null, '2026-09-02')).toBe('2026-09-02')
    expect(blockDayIso(undefined, '2026-09-02')).toBe('2026-09-02')
    expect(blockDayIso('not-a-date', '2026-09-02')).toBe('2026-09-02')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: you hit reset on a block that has been running for half an hour.
// ─────────────────────────────────────────────────────────────────────────────

describe('bankableMinutes — what a block stopped early was worth', () => {
  const total = 45
  const ms = (mins: number) => mins * 60_000

  it('banks the part of the block that actually elapsed', () => {
    // 31 minutes in: 14 minutes still on the clock.
    expect(bankableMinutes(total, ms(14))).toBe(31)
  })

  it('banks nothing for a block stopped the instant it started', () => {
    expect(bankableMinutes(total, ms(45))).toBe(0)
  })

  it('never credits more than the block length', () => {
    // A corrupted negative remainder must not become extra credit.
    expect(bankableMinutes(total, -ms(600))).toBe(total)
  })

  it('treats a remainder longer than the block as nothing elapsed', () => {
    expect(bankableMinutes(total, ms(600))).toBe(0)
  })

  it('measures the countdown, not wall clock — a long pause banks no extra', () => {
    // Paused with 14 minutes left, resumed an hour later: still 31 minutes.
    expect(bankableMinutes(total, ms(14))).toBe(31)
  })

  it('is zero for a zero-length block and for a non-finite remainder', () => {
    expect(bankableMinutes(0, 0)).toBe(0)
    expect(bankableMinutes(total, Number.NaN)).toBe(total)
  })

  it('leaves a misclick below the interrupt threshold', () => {
    expect(bankableMinutes(total, ms(45) - 20_000)).toBeLessThan(MIN_BANKABLE_MINUTES)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: you delete a task you have already worked on.
// ─────────────────────────────────────────────────────────────────────────────

describe('summarizeTaskWork — what deleting a task would cost', () => {
  it('separates timed minutes from hand-logged ones', () => {
    const d = day(
      [task({ id: 't1', manualLoggedMinutes: 20 })],
      [session({ id: 's1', taskId: 't1', durationMinutes: 45 })],
    )
    const summary = summarizeTaskWork(d, ['t1'])
    expect(summary.sessionMinutes).toBe(45)
    expect(summary.sessionCount).toBe(1)
    expect(summary.manualMinutes).toBe(20)
    expect(summary.hasRecordedWork).toBe(true)
    // Timed minutes survive on the day; the hand-logged ones do not.
    expect(summary.hasIrrecoverableWork).toBe(true)
  })

  it('does not call timed work irrecoverable — the session outlives the task', () => {
    const d = day([task({ id: 't1' })], [session({ id: 's1', taskId: 't1' })])
    const summary = summarizeTaskWork(d, ['t1'])
    expect(summary.hasRecordedWork).toBe(true)
    expect(summary.hasIrrecoverableWork).toBe(false)
  })

  it('ignores work belonging to other tasks', () => {
    const d = day(
      [task({ id: 't1', manualLoggedMinutes: 20 }), task({ id: 't2', manualLoggedMinutes: 99 })],
      [session({ id: 's1', taskId: 't2', durationMinutes: 45 })],
    )
    expect(summarizeTaskWork(d, ['t1'])).toMatchObject({ sessionMinutes: 0, manualMinutes: 20 })
  })

  it('sums a bulk delete across every selected task', () => {
    const d = day(
      [task({ id: 't1', manualLoggedMinutes: 20 }), task({ id: 't2', manualLoggedMinutes: 10 })],
      [
        session({ id: 's1', taskId: 't1', durationMinutes: 45 }),
        session({ id: 's2', taskId: 't2', durationMinutes: 30 }),
      ],
    )
    expect(summarizeTaskWork(d, ['t1', 't2'])).toMatchObject({
      sessionMinutes: 75,
      sessionCount: 2,
      manualMinutes: 30,
    })
  })

  it('reports nothing for an untouched task, so deleting it is not interrupted', () => {
    const d = day([task({ id: 't1' })])
    expect(summarizeTaskWork(d, ['t1']).hasRecordedWork).toBe(false)
    expect(describeWorkLoss(summarizeTaskWork(d, ['t1']))).toBeNull()
  })

  it('survives a missing day and an empty selection', () => {
    expect(summarizeTaskWork(undefined, ['t1']).hasRecordedWork).toBe(false)
    expect(summarizeTaskWork(day([task({ id: 't1' })]), []).hasRecordedWork).toBe(false)
  })
})

describe('taskWithDescendantIds — deleting a parent takes its subtasks', () => {
  const tasks = [
    task({ id: 'root' }),
    task({ id: 'child-a', parentId: 'root' }),
    task({ id: 'child-b', parentId: 'root' }),
    task({ id: 'grandchild', parentId: 'child-a' }),
    task({ id: 'unrelated' }),
  ]

  it('collects the whole subtree at any depth', () => {
    expect(taskWithDescendantIds(tasks, 'root').sort()).toEqual(
      ['child-a', 'child-b', 'grandchild', 'root'].sort(),
    )
  })

  it('leaves unrelated tasks alone', () => {
    expect(taskWithDescendantIds(tasks, 'child-a').sort()).toEqual(['child-a', 'grandchild'])
  })

  it('terminates on a corrupted parent cycle instead of hanging', () => {
    const cyclic = [task({ id: 'a', parentId: 'b' }), task({ id: 'b', parentId: 'a' })]
    expect(taskWithDescendantIds(cyclic, 'a').sort()).toEqual(['a', 'b'])
  })

  it("counts a subtask's logged work when the parent is deleted", () => {
    const d = day(
      [task({ id: 'root' }), task({ id: 'child-a', parentId: 'root', manualLoggedMinutes: 25 })],
      [session({ id: 's1', taskId: 'child-a', durationMinutes: 45 })],
    )
    const ids = taskWithDescendantIds(d.tasks, 'root')
    expect(summarizeTaskWork(d, ids)).toMatchObject({ manualMinutes: 25, sessionMinutes: 45 })
  })
})

describe('detachSessionsFromTasks — worked minutes outlive the task', () => {
  it('keeps the session and drops only the dangling attribution', () => {
    const tasks = [task({ id: 't1', title: 'Write the sync design doc' })]
    const sessions = [session({ id: 's1', taskId: 't1', durationMinutes: 45 })]
    const [detached] = detachSessionsFromTasks(sessions, tasks, ['t1'])

    expect(detached).toBeDefined()
    expect(detached!.durationMinutes).toBe(45)
    expect(detached!.taskId).toBeUndefined()
    // The record still says what the work was.
    expect(detached!.label).toContain('Write the sync design doc')
  })

  it('leaves sessions for surviving tasks untouched', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' })]
    const sessions = [session({ id: 's1', taskId: 't1' }), session({ id: 's2', taskId: 't2' })]
    const out = detachSessionsFromTasks(sessions, tasks, ['t1'])
    expect(out.find((s) => s.id === 's2')!.taskId).toBe('t2')
  })

  it('does not duplicate a title already in the label', () => {
    const tasks = [task({ id: 't1', title: 'Deep work block' })]
    const sessions = [session({ id: 's1', taskId: 't1', label: 'Deep work block' })]
    expect(detachSessionsFromTasks(sessions, tasks, ['t1'])[0]!.label).toBe('Deep work block')
  })

  it('never loses a session — the count is preserved', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' })]
    const sessions = [
      session({ id: 's1', taskId: 't1' }),
      session({ id: 's2', taskId: 't2' }),
      session({ id: 's3' }),
    ]
    expect(detachSessionsFromTasks(sessions, tasks, ['t1', 't2'])).toHaveLength(3)
  })
})

describe('describeWorkLoss — the sentence shown before destroying something', () => {
  it('leads with what is actually lost', () => {
    const d = day(
      [task({ id: 't1', manualLoggedMinutes: 90 })],
      [session({ id: 's1', taskId: 't1', durationMinutes: 45 })],
    )
    const text = describeWorkLoss(summarizeTaskWork(d, ['t1']))!
    expect(text).toContain('1h 30m')
    expect(text).toMatch(/lost/)
    // and is honest that the timed work is not lost
    expect(text).toMatch(/stays in your totals/)
  })

  it('pluralises for a bulk delete', () => {
    const d = day([task({ id: 't1', manualLoggedMinutes: 30 }), task({ id: 't2', manualLoggedMinutes: 15 })])
    expect(describeWorkLoss(summarizeTaskWork(d, ['t1', 't2']), 2)).toContain('These 2 tasks')
  })

  it('says nothing when there is nothing to say', () => {
    expect(describeWorkLoss(summarizeTaskWork(day([task({ id: 't1' })]), ['t1']))).toBeNull()
  })
})
