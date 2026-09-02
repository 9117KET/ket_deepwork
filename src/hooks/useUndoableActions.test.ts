/**
 * The staleness rule, tested on its own.
 *
 * This is the part of undo that fails silently when it is wrong: restoring a
 * snapshot over work done after the mistake does not error, it just destroys
 * it. Everything else in the hook is React plumbing; this is the invariant.
 */

import { describe, expect, it } from 'vitest'
import type { AppState } from '../domain/types'
import { UNDO_WINDOW_MS, isUndoStale, type UndoEntry } from './useUndoableActions'

const state = {} as AppState
const entry = (validAtVersion: number): UndoEntry => ({
  label: 'Deleted "Study German"',
  before: state,
  validAtVersion,
})

describe('isUndoStale — an offer only survives while nothing else moves', () => {
  it('is fresh when the state has not changed since the action', () => {
    expect(isUndoStale(entry(5), 5)).toBe(false)
  })

  it('goes stale the instant anything else changes the state', () => {
    // The user deleted a task, then edited another one. Restoring the snapshot
    // now would revert the edit too.
    expect(isUndoStale(entry(5), 6)).toBe(true)
  })

  it('is stale for any drift, not just the next change', () => {
    expect(isUndoStale(entry(5), 9)).toBe(true)
  })

  it('treats a rolled-back counter as stale rather than assuming freshness', () => {
    // Should not happen, but guessing wrong here costs data.
    expect(isUndoStale(entry(5), 4)).toBe(true)
  })

  it('has nothing to undo when there is no offer', () => {
    expect(isUndoStale(null, 0)).toBe(true)
  })
})

describe('the undo window', () => {
  it('is long enough to notice a mistake and short enough not to go stale', () => {
    expect(UNDO_WINDOW_MS).toBeGreaterThanOrEqual(5_000)
    expect(UNDO_WINDOW_MS).toBeLessThanOrEqual(30_000)
  })
})
