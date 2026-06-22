import { describe, it, expect } from 'vitest'
import { isRemoteDayStale, mergeRemoteDayState } from './localStorageState'
import type { DayState, Task } from '../domain/types'

// Diagnostic for the reported symptom: "updates I make on one device do not
// appear on my phone (same account); it worked at first, then stopped."
//
// Both the server write guard (convex/plannerDays.ts isStaleWrite) and the
// client read guard (isRemoteDayStale) decide last-write-wins using `updatedAt`,
// a wall-clock Date.now() stamped by whichever device made the edit. When a
// remote day arrives, the reader applies it only if isRemoteDayStale === false.
// These tests model a phone (the reader) receiving an edit pushed from a laptop.

function task(id: string, title = id): Task {
  return { id, title, sectionId: 'highPriority', date: '2026-06-22', isDone: false }
}
function day(tasks: Task[]): DayState {
  return { date: '2026-06-22', tasks, deepWorkSessions: [] }
}

describe('cross-device sync (read-side gate)', () => {
  // A day with no local unsynced edits reaches the recency guard (dirty/pending
  // days are skipped earlier). hasLocal=true because the phone already cached it.

  it('WORKS with synced clocks: a newer remote edit is applied', () => {
    const localUpdatedAt = 1_000 // phone last synced this day at t=1000
    const remoteUpdatedAt = 2_000 // laptop edited it later at t=2000
    const skip = isRemoteDayStale(true, localUpdatedAt, remoteUpdatedAt)
    expect(skip).toBe(false) // laptop's edit appears on the phone ✓

    const merged = mergeRemoteDayState(day([task('t1', 'old')]), day([task('t1', 'new')]))
    expect(merged.tasks[0]!.title).toBe('new')
  })

  it('FAILS with clock skew: phone clock ahead of laptop drops the update', () => {
    // Phone's clock runs ~5 min ahead. Its last cached edit is stamped 1_300_000,
    // the laptop's genuinely-newer edit is stamped 1_000_000 (laptop's clock).
    const phoneLocalUpdatedAt = 1_300_000
    const laptopRemoteUpdatedAt = 1_000_000
    const skip = isRemoteDayStale(true, phoneLocalUpdatedAt, laptopRemoteUpdatedAt)
    // The guard treats the laptop's edit as "stale" purely because of clock skew,
    // so the phone NEVER applies it -> "updates do not appear on my phone".
    expect(skip).toBe(true)
  })

  it('FAILS persistently: once a day is stuck, later equal-ish edits stay hidden', () => {
    // Until the laptop's stamp finally exceeds the phone's skewed local stamp,
    // every laptop edit in between is silently skipped.
    expect(isRemoteDayStale(true, 1_300_000, 1_100_000)).toBe(true)
    expect(isRemoteDayStale(true, 1_300_000, 1_299_999)).toBe(true)
    expect(isRemoteDayStale(true, 1_300_000, 1_300_001)).toBe(false) // only now visible
  })

  it('the merge layer itself is not the problem (it preserves + applies correctly)', () => {
    // When the gate lets the update through, merge does the right thing.
    const merged = mergeRemoteDayState(day([task('a')]), day([task('a'), task('b')]))
    expect(merged.tasks.map(t => t.id)).toEqual(['a', 'b'])
  })
})
