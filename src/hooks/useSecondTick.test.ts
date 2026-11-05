import { describe, expect, it } from 'vitest'
import { nextTickDelay } from './useSecondTick'

// vitest runs in `environment: 'node'` and @testing-library/react is not
// installed, so the hook itself is not rendered here; its scheduling helper is.
describe('nextTickDelay', () => {
  it('waits until the next whole second', () => {
    expect(nextTickDelay(1_700_000_000_250)).toBe(750)
    expect(nextTickDelay(1_700_000_000_999)).toBe(1)
    expect(nextTickDelay(1_700_000_000_001)).toBe(999)
  })

  it('waits a full second when exactly on one', () => {
    expect(nextTickDelay(1_700_000_000_000)).toBe(1000)
    expect(nextTickDelay(0)).toBe(1000)
  })
})
