import { describe, it, expect } from 'vitest'
import { isRemoteDayStale } from './localStorageState'

// Regression guard for the data-loss bug where a whole day of todos vanished on
// refresh: the read-merge applied a stale/empty server row over fresher local
// data because the read had no recency check (only the server-side write had
// one). isRemoteDayStale is the read-side mirror of that server guard.
describe('isRemoteDayStale', () => {
  it('skips a remote row that is older than the local copy (the bug)', () => {
    // Yesterday was edited locally at t=2000; the server still has the stale
    // t=1000 row. Applying it would wipe the local tasks - it must be skipped.
    expect(isRemoteDayStale(true, 2000, 1000)).toBe(true)
  })

  it('applies a remote row that is newer than local (multi-device update)', () => {
    // Another device edited the day more recently - that update must win.
    expect(isRemoteDayStale(true, 1000, 2000)).toBe(false)
  })

  it('applies a remote row with an equal timestamp (same-data merge)', () => {
    // The common case: this device synced the day and the server stored the
    // exact stamp. Not stale - apply so genuine remote merges still flow.
    expect(isRemoteDayStale(true, 1500, 1500)).toBe(false)
  })

  it('never treats a remote row as stale when there is no local copy', () => {
    // Nothing local to protect - the remote is all we have, always apply it.
    expect(isRemoteDayStale(false, undefined, undefined)).toBe(false)
    expect(isRemoteDayStale(false, 5000, 0)).toBe(false)
  })

  it('makes local win when the backend never stored updatedAt (safe degradation)', () => {
    // Backend predates the updatedAt field → remote reads as undefined (0).
    // Any local edit time wins, so a thin server row can never wipe local data.
    expect(isRemoteDayStale(true, 1000, undefined)).toBe(true)
  })

  it('applies remote when neither side has a timestamp', () => {
    // Both default to 0; not strictly greater, so the remote still applies.
    expect(isRemoteDayStale(true, undefined, undefined)).toBe(false)
  })
})
