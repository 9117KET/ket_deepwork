import { describe, expect, it } from 'vitest'
import type { PersistedActiveBlock } from '../../storage/activeBlock'
import { blockTask, persistedBlockDayIso, restoreTimer } from './useDeepWorkTimer'

// vitest runs in `environment: 'node'` and @testing-library/react is not
// installed, so the hook itself is not rendered here; the two pure pieces that
// decide which day a stored block belongs to are.

/** Local wall-clock instant, as the planner keys its days. */
function local(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(y, m - 1, d, h, min)
}

function stored(overrides: Partial<PersistedActiveBlock>): PersistedActiveBlock {
  return {
    dayIso: '2026-09-02',
    taskId: 't1',
    label: 'Deep work block',
    totalMinutes: 45,
    startedAt: local(2026, 9, 2, 10).toISOString(),
    status: 'running',
    endsAt: local(2026, 9, 2, 10, 45).getTime(),
    remainingMs: 0,
    ...overrides,
  }
}

describe('persistedBlockDayIso: the day written with a running block', () => {
  it('is the day the block started, not the day on screen', () => {
    const startedAt = local(2026, 9, 2, 10).toISOString()
    expect(persistedBlockDayIso(startedAt, '2026-09-01', local(2026, 9, 2, 10, 5))).toBe('2026-09-02')
  })

  it('keeps a block that crosses midnight on the day it started', () => {
    const startedAt = local(2026, 9, 1, 23, 30).toISOString()
    expect(persistedBlockDayIso(startedAt, '2026-09-02', local(2026, 9, 2, 0, 15))).toBe('2026-09-01')
  })

  it('falls back to the local date, never a UTC one, when the start is unknown', () => {
    // 00:30 local is still the previous day in UTC for any zone east of
    // Greenwich, which is where `toISOString().slice(0, 10)` went wrong.
    const now = local(2026, 9, 2, 0, 30)
    expect(persistedBlockDayIso(null, undefined, now)).toBe('2026-09-02')
    expect(persistedBlockDayIso('not-a-date', undefined, now)).toBe('2026-09-02')
  })
})

describe('restoreTimer: an away claim belongs to the day the block started', () => {
  it('files a block started on D under D even when the record says the day on screen', () => {
    // Started on 2 Sep, then the planner was paged back to 1 Sep before the tab
    // closed, so the record carries the screen's day.
    const block = stored({ dayIso: '2026-09-01' })
    const restored = restoreTimer(block, local(2026, 9, 2, 11).getTime())
    expect(restored.awayBlock).not.toBeNull()
    expect(restored.awayBlock?.dayIso).toBe('2026-09-02')
    // The true instants are carried through untouched.
    expect(restored.awayBlock?.startedAt).toBe(block.startedAt)
    expect(restored.awayBlock?.finishedAt).toBe(new Date(block.endsAt as number).toISOString())
    expect(restored.awayBlock?.minutes).toBe(45)
  })

  it('keeps a block that crossed midnight on the day it started', () => {
    const block = stored({
      dayIso: '2026-09-02',
      startedAt: local(2026, 9, 1, 23, 30).toISOString(),
      endsAt: local(2026, 9, 2, 0, 15).getTime(),
    })
    const restored = restoreTimer(block, local(2026, 9, 2, 7).getTime())
    expect(restored.awayBlock?.dayIso).toBe('2026-09-01')
  })

  it('still resumes a block in flight and restores a paused one', () => {
    const running = restoreTimer(stored({}), local(2026, 9, 2, 10, 30).getTime())
    expect(running.status).toBe('running')
    expect(running.awayBlock).toBeNull()

    const paused = restoreTimer(
      stored({ status: 'paused', endsAt: null, remainingMs: 600_000 }),
      local(2026, 9, 2, 18).getTime(),
    )
    expect(paused.status).toBe('paused')
    expect(paused.remainingMs).toBe(600_000)
    expect(paused.startedAt).toBe(stored({}).startedAt)
  })

  it('still drops a claim older than twelve hours', () => {
    const restored = restoreTimer(stored({}), local(2026, 9, 3, 0).getTime())
    expect(restored.status).toBe('idle')
    expect(restored.awayBlock).toBeNull()
  })
})

describe('blockTask: the task a block is worked against', () => {
  const held = { id: 't1', title: 'Study German' }
  const other = { id: 't2', title: 'Write the doc' }

  it('is the task held since the block started while it runs or is paused', () => {
    // Paged to another day: the day on screen does not offer t1 at all.
    expect(blockTask('running', held, undefined)).toEqual(held)
    expect(blockTask('paused', held, undefined)).toEqual(held)
    // Even if the screen offers something else, the block's task does not move.
    expect(blockTask('running', held, other)).toEqual(held)
  })

  it('is an unattributed block when it started unattributed', () => {
    expect(blockTask('running', undefined, other)).toBeUndefined()
  })

  it('follows the selection while no block is under way', () => {
    expect(blockTask('idle', held, other)).toEqual(other)
    expect(blockTask('finished', held, undefined)).toBeUndefined()
  })
})

describe('restoreTimer: the task comes back with the block', () => {
  it('holds the stored task and label, whatever day is on screen', () => {
    const restored = restoreTimer(stored({ label: 'Study German' }), local(2026, 9, 2, 10, 30).getTime())
    expect(restored.task).toEqual({ id: 't1', title: 'Study German' })
  })

  it('holds no task for an unattributed block', () => {
    const restored = restoreTimer(stored({ taskId: undefined }), local(2026, 9, 2, 10, 30).getTime())
    expect(restored.task).toBeUndefined()
  })
})
