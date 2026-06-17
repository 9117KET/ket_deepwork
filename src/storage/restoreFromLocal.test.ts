import { describe, it, expect, vi } from 'vitest'
import {
  buildRestorePayload,
  chunk,
  restoreDaysInBatches,
  type RestoreDayPayload,
} from './restoreFromLocal'
import type { AppState, DayState } from '../domain/types'

function day(date: string, overrides: Partial<DayState> = {}): DayState {
  return { date, tasks: [], deepWorkSessions: [], ...overrides }
}

describe('buildRestorePayload', () => {
  it('returns one payload per day, sorted by date ascending', () => {
    const state: AppState = {
      days: {
        '2026-06-16': day('2026-06-16'),
        '2026-04-05': day('2026-04-05'),
        '2026-05-01': day('2026-05-01'),
      },
    }
    const out = buildRestorePayload(state, {}, 999)
    expect(out.map((d) => d.date)).toEqual(['2026-04-05', '2026-05-01', '2026-06-16'])
  })

  it('stamps updatedAt from persisted lastModified, falling back to now', () => {
    const state: AppState = { days: { '2026-06-16': day('2026-06-16'), '2026-06-17': day('2026-06-17') } }
    const out = buildRestorePayload(state, { '2026-06-16': 1234 }, 999)
    expect(out.find((d) => d.date === '2026-06-16')!.updatedAt).toBe(1234)
    expect(out.find((d) => d.date === '2026-06-17')!.updatedAt).toBe(999) // fallback
  })

  it('only emits validator-allowed fields (drops unknown local keys)', () => {
    const dirty = { ...day('2026-06-16'), bogusField: 'nope', anotherJunk: 42 } as unknown as DayState
    const out = buildRestorePayload({ days: { '2026-06-16': dirty } }, {}, 1)
    expect(Object.keys(out[0]!)).not.toContain('bogusField')
    expect(Object.keys(out[0]!)).not.toContain('anotherJunk')
  })

  it('normalises null scheduling fields to undefined (validator rejects null)', () => {
    const d = day('2026-06-16', { sleepHours: null, mood: null, bedTime: null })
    const out = buildRestorePayload({ days: { '2026-06-16': d } }, {}, 1)
    expect(out[0]!.sleepHours).toBeUndefined()
    expect(out[0]!.mood).toBeUndefined()
    expect(out[0]!.bedTime).toBeUndefined()
  })

  it('skips empty day slots', () => {
    const state = { days: { '2026-06-16': day('2026-06-16'), '2026-06-17': undefined } } as unknown as AppState
    expect(buildRestorePayload(state, {}, 1)).toHaveLength(1)
  })
})

describe('chunk', () => {
  it('splits into batches of at most size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('throws on non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})

describe('restoreDaysInBatches', () => {
  const mkDays = (n: number): RestoreDayPayload[] =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      tasks: [],
      deepWorkSessions: [],
    }))

  it('uploads every day across paced batches and reports final progress', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const result = await restoreDaysInBatches(mkDays(10), upsert, { batchSize: 4, delayMs: 50, sleepFn })

    expect(upsert).toHaveBeenCalledTimes(3) // 4 + 4 + 2
    expect(upsert.mock.calls[0]![0].days).toHaveLength(4)
    expect(upsert.mock.calls[2]![0].days).toHaveLength(2)
    expect(result).toEqual({ batch: 3, batches: 3, done: 10, total: 10 })
  })

  it('waits between batches but not after the last one', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    await restoreDaysInBatches(mkDays(10), upsert, { batchSize: 4, delayMs: 50, sleepFn })
    expect(sleepFn).toHaveBeenCalledTimes(2) // 3 batches → 2 gaps
  })

  it('emits incremental progress per batch', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const seen: number[] = []
    await restoreDaysInBatches(mkDays(5), upsert, {
      batchSize: 2,
      sleepFn,
      onProgress: (p) => seen.push(p.done),
    })
    expect(seen).toEqual([2, 4, 5])
  })

  it('propagates a failed batch and stops (local data is never mutated here)', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('over quota'))
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    await expect(
      restoreDaysInBatches(mkDays(6), upsert, { batchSize: 2, sleepFn }),
    ).rejects.toThrow('over quota')
    expect(upsert).toHaveBeenCalledTimes(2) // stopped after the failing batch
  })
})
