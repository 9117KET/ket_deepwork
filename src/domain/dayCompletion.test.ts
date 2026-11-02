import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { computeDayCompletion, gaugeFigures, minutesInWords } from './dayCompletion'
import { durationOptions } from './durations'

let seq = 0
function task(partial: Partial<Task>): Task {
  seq += 1
  return {
    id: partial.id ?? `t${seq}`,
    title: partial.title ?? `Task ${seq}`,
    sectionId: partial.sectionId ?? 'highPriority',
    date: '2026-11-02',
    isDone: partial.isDone ?? false,
    ...partial,
  }
}

describe('computeDayCompletion', () => {
  it('reports nothing planned on an empty day, with a ratio of 0', () => {
    expect(computeDayCompletion([])).toEqual({
      plannedMinutes: 0,
      doneMinutes: 0,
      ratio: 0,
      rootCount: 0,
      doneRootCount: 0,
      unestimatedCount: 0,
    })
  })

  it('counts a done leaf in full and an undone one not at all', () => {
    const result = computeDayCompletion([
      task({ durationMinutes: 60, isDone: true }),
      task({ durationMinutes: 30 }),
    ])
    expect(result.plannedMinutes).toBe(90)
    expect(result.doneMinutes).toBe(60)
    expect(result.ratio).toBeCloseTo(2 / 3)
    expect(result.rootCount).toBe(2)
    expect(result.doneRootCount).toBe(1)
    expect(result.unestimatedCount).toBe(0)
  })

  it('earns a parent pro rata of its done subtask minutes and ignores its own tick', () => {
    const parent = task({ id: 'p', durationMinutes: 120, isDone: true })
    const result = computeDayCompletion([
      parent,
      task({ parentId: 'p', durationMinutes: 30, isDone: true }),
      task({ parentId: 'p', durationMinutes: 30, isDone: true }),
      task({ parentId: 'p', durationMinutes: 60 }),
    ])
    expect(result.plannedMinutes).toBe(120)
    expect(result.doneMinutes).toBe(60)
    expect(result.ratio).toBe(0.5)
    expect(result.rootCount).toBe(1)
    expect(result.doneRootCount).toBe(0)
  })

  it('counts a task without a duration as 30 minutes and says so', () => {
    const result = computeDayCompletion([
      task({ durationMinutes: 60, isDone: true }),
      task({ durationMinutes: 30 }),
      task({}),
    ])
    expect(result.plannedMinutes).toBe(120)
    expect(result.doneMinutes).toBe(60)
    expect(result.ratio).toBe(0.5)
    expect(result.unestimatedCount).toBe(1)
  })

  it('counts a subtask without a duration as 30 minutes of its parent', () => {
    const result = computeDayCompletion([
      task({ id: 'p', durationMinutes: 90 }),
      task({ parentId: 'p', durationMinutes: 60, isDone: true }),
      task({ parentId: 'p', isDone: false }),
    ])
    expect(result.doneMinutes).toBe(60)
  })

  it('treats a parent whose subtasks are all 0 minutes as done only when all are done', () => {
    const half = computeDayCompletion([
      task({ id: 'p', durationMinutes: 60 }),
      task({ parentId: 'p', durationMinutes: 0, isDone: true }),
      task({ parentId: 'p', durationMinutes: 0 }),
    ])
    expect(half.doneMinutes).toBe(0)
    expect(Number.isNaN(half.ratio)).toBe(false)

    const all = computeDayCompletion([
      task({ id: 'p', durationMinutes: 60 }),
      task({ parentId: 'p', durationMinutes: 0, isDone: true }),
      task({ parentId: 'p', durationMinutes: 0, isDone: true }),
    ])
    expect(all.doneMinutes).toBe(60)
    expect(all.ratio).toBe(1)
  })

  it('gives an unticked parent all its minutes when every subtask is done', () => {
    const result = computeDayCompletion([
      task({ id: 'p', durationMinutes: 90, isDone: false }),
      task({ parentId: 'p', durationMinutes: 30, isDone: true }),
      task({ parentId: 'p', durationMinutes: 60, isDone: true }),
    ])
    expect(result.doneMinutes).toBe(90)
    expect(result.ratio).toBe(1)
    expect(result.doneRootCount).toBe(1)
  })

  it('plans 0 minutes for a 0-minute root and does not count it as unestimated', () => {
    const result = computeDayCompletion([
      task({ durationMinutes: 60, isDone: true }),
      task({ durationMinutes: 0 }),
      task({ durationMinutes: 30 }),
    ])
    expect(result.plannedMinutes).toBe(90)
    expect(result.doneMinutes).toBe(60)
    expect(result.rootCount).toBe(3)
    expect(result.unestimatedCount).toBe(0)
  })

  it('treats a negative or NaN duration as unset: 30 minutes, counted as unestimated', () => {
    const result = computeDayCompletion([
      task({ durationMinutes: -15 }),
      task({ durationMinutes: Number.NaN, isDone: true }),
      task({ durationMinutes: 60 }),
    ])
    expect(result.plannedMinutes).toBe(120)
    expect(result.doneMinutes).toBe(30)
    expect(result.unestimatedCount).toBe(2)
    expect(Number.isNaN(result.ratio)).toBe(false)
  })

  it('never returns a NaN ratio, even when every root is 0 minutes', () => {
    const result = computeDayCompletion([task({ durationMinutes: 0, isDone: true })])
    expect(result.plannedMinutes).toBe(0)
    expect(result.ratio).toBe(0)
    expect(Number.isNaN(result.ratio)).toBe(false)
  })
})

describe('gaugeFigures', () => {
  it('is the exact floor of done over planned, where floating point would undercount', () => {
    // Math.floor(0.58 * 100) is 57; the gauge must say 58.
    expect(gaugeFigures({ plannedMinutes: 250, doneMinutes: 145 })).toEqual({ done: 145, planned: 250, percent: 58 })
    expect(gaugeFigures({ plannedMinutes: 500, doneMinutes: 285 })).toEqual({ done: 285, planned: 500, percent: 57 })
  })

  it('reads 100% at the full mark and 0% when nothing is planned', () => {
    expect(gaugeFigures({ plannedMinutes: 60, doneMinutes: 60 })).toEqual({ done: 60, planned: 60, percent: 100 })
    expect(gaugeFigures({ plannedMinutes: 0, doneMinutes: 0 }).percent).toBe(0)
  })

  it('floors fractional done minutes from a part-done parent, never past full', () => {
    const fromTasks = computeDayCompletion([
      task({ id: 'p', durationMinutes: 90 }),
      task({ parentId: 'p', durationMinutes: 20, isDone: true }),
      task({ parentId: 'p', durationMinutes: 40 }),
    ])
    expect(gaugeFigures(fromTasks)).toEqual({ done: 30, planned: 90, percent: 33 })
    expect(gaugeFigures({ plannedMinutes: 60, doneMinutes: 59.6 }).percent).toBe(98)
  })
})

describe('minutesInWords', () => {
  it('reads minutes the way the gauge says them', () => {
    expect(minutesInWords(0)).toBe('0 minutes')
    expect(minutesInWords(45)).toBe('45 minutes')
    expect(minutesInWords(60)).toBe('1 hour')
    expect(minutesInWords(180)).toBe('3 hours')
    expect(minutesInWords(330)).toBe('5 hours 30')
  })
})

describe('durationOptions', () => {
  it('lists the quick lengths then the ladder, ascending', () => {
    expect(durationOptions()).toEqual([10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480])
  })

  it('inserts a stored off-list value in order rather than dropping it', () => {
    const options = durationOptions(150)
    expect(options.indexOf(150)).toBe(options.indexOf(120) + 1)
    expect(options.indexOf(180)).toBe(options.indexOf(150) + 1)
    expect(durationOptions(5)[0]).toBe(5)
    expect(durationOptions(60)).toEqual(durationOptions())
  })
})
