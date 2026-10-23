/**
 * convex/_shared/challengeNudges.test.ts
 *
 * The nudge allowance: three a day, an hour apart, only while owed.
 * Run with: npm run test:convex
 */
import { describe, expect, test } from 'vitest'
import {
  NUDGE_DAILY_CAP,
  NUDGE_MIN_GAP_MS,
  NUDGE_RULE_REFUSAL,
  nudgeAvailability,
  nudgeLabel,
  nudgeLeftCaption,
  nudgeRefusal,
  nudgeTimes,
  partnerOwesToday,
} from './challengeNudges'

const T0 = Date.UTC(2026, 9, 22, 9, 0)
const MIN = 60_000

describe('nudgeTimes', () => {
  test('empty for a missing row', () => {
    expect(nudgeTimes(null)).toEqual([])
    expect(nudgeTimes(undefined)).toEqual([])
    expect(nudgeTimes({})).toEqual([])
  })

  test('a legacy single stamp counts as one entry', () => {
    expect(nudgeTimes({ nudgeSentAt: T0 })).toEqual([T0])
  })

  test('the array wins over the legacy stamp and comes back sorted', () => {
    expect(nudgeTimes({ nudgesSentAt: [T0 + 2 * MIN, T0], nudgeSentAt: T0 })).toEqual([T0, T0 + 2 * MIN])
  })

  test('does not mutate the stored array', () => {
    const stored = [T0 + MIN, T0]
    nudgeTimes({ nudgesSentAt: stored })
    expect(stored).toEqual([T0 + MIN, T0])
  })
})

describe('nudgeAvailability', () => {
  test('ready with the full allowance when nothing was sent', () => {
    expect(nudgeAvailability({ nowMs: T0, times: [], partnerOwes: true })).toEqual({ state: 'ready', left: NUDGE_DAILY_CAP })
  })

  test('cooling inside the gap, with the instant it opens again', () => {
    expect(nudgeAvailability({ nowMs: T0 + 10 * MIN, times: [T0], partnerOwes: true })).toEqual({
      state: 'cooling',
      left: 2,
      nextAt: T0 + NUDGE_MIN_GAP_MS,
    })
  })

  test('ready again at exactly the gap', () => {
    expect(nudgeAvailability({ nowMs: T0 + NUDGE_MIN_GAP_MS - 1, times: [T0], partnerOwes: true }).state).toBe('cooling')
    expect(nudgeAvailability({ nowMs: T0 + NUDGE_MIN_GAP_MS, times: [T0], partnerOwes: true })).toEqual({ state: 'ready', left: 2 })
  })

  test('the gap is measured from the latest nudge', () => {
    const times = [T0, T0 + NUDGE_MIN_GAP_MS]
    expect(nudgeAvailability({ nowMs: T0 + NUDGE_MIN_GAP_MS + 5 * MIN, times, partnerOwes: true }).state).toBe('cooling')
  })

  test('spent at the cap, however long ago the last one was', () => {
    const times = [T0, T0 + NUDGE_MIN_GAP_MS, T0 + 2 * NUDGE_MIN_GAP_MS]
    expect(nudgeAvailability({ nowMs: T0 + 10 * NUDGE_MIN_GAP_MS, times, partnerOwes: true })).toEqual({ state: 'spent' })
  })

  test('a legacy row leaves two', () => {
    const times = nudgeTimes({ nudgeSentAt: T0 })
    expect(nudgeAvailability({ nowMs: T0 + NUDGE_MIN_GAP_MS, times, partnerOwes: true })).toEqual({ state: 'ready', left: 2 })
  })

  test('precedence: not owed beats spent, spent beats cooling', () => {
    const spentRecently = [T0, T0 + MIN, T0 + 2 * MIN]
    expect(nudgeAvailability({ nowMs: T0 + 3 * MIN, times: spentRecently, partnerOwes: false })).toEqual({ state: 'notOwed' })
    expect(nudgeAvailability({ nowMs: T0 + 3 * MIN, times: spentRecently, partnerOwes: true })).toEqual({ state: 'spent' })
    expect(nudgeAvailability({ nowMs: T0 + MIN, times: [T0], partnerOwes: false })).toEqual({ state: 'notOwed' })
  })
})

describe('partnerOwesToday', () => {
  test('the plan before the evening, the check-in after it', () => {
    expect(partnerOwesToday({ evening: false })).toBe(true)
    expect(partnerOwesToday({ evening: false, planSetAt: T0 })).toBe(false)
    expect(partnerOwesToday({ evening: false, checkinAt: T0 })).toBe(true)
    expect(partnerOwesToday({ evening: true, planSetAt: T0 })).toBe(true)
    expect(partnerOwesToday({ evening: true, checkinAt: T0 })).toBe(false)
  })
})

describe('labels and refusals', () => {
  test('button text per state', () => {
    expect(nudgeLabel({ state: 'ready', left: 2 }, T0)).toBe('Nudge')
    expect(nudgeLabel({ state: 'cooling', left: 2, nextAt: T0 + 42 * MIN }, T0)).toBe('Nudge again in 42 min')
    expect(nudgeLabel({ state: 'spent' }, T0)).toBe('Nudged 3/3 today')
    expect(nudgeLabel({ state: 'notOwed' }, T0)).toBe('')
  })

  test('cooling minutes round up and never show zero', () => {
    expect(nudgeLabel({ state: 'cooling', left: 2, nextAt: T0 + 41 * MIN + 1 }, T0)).toBe('Nudge again in 42 min')
    expect(nudgeLabel({ state: 'cooling', left: 2, nextAt: T0 + 1 }, T0)).toBe('Nudge again in 1 min')
  })

  test('no caption on the first nudge of the day', () => {
    expect(nudgeLeftCaption(3)).toBe('')
    expect(nudgeLeftCaption(2)).toBe('2 left today')
    expect(nudgeLeftCaption(1)).toBe('1 left today')
    expect(nudgeLeftCaption(0)).toBe('')
  })

  test('refusals carry the messages the client recognises', () => {
    const spent = nudgeRefusal({ state: 'spent' }, T0)
    const cooling = nudgeRefusal({ state: 'cooling', left: 2, nextAt: T0 + 50 * MIN }, T0)
    expect(spent).toBe('You have nudged them 3 times today')
    expect(cooling).toBe('You can nudge again in 50 min')
    expect(nudgeRefusal({ state: 'ready', left: 3 }, T0)).toBeNull()
    for (const m of [spent!, cooling!, 'They have already checked in', 'The challenge is not running today']) {
      expect(m).toMatch(NUDGE_RULE_REFUSAL)
    }
    expect('Server Error').not.toMatch(NUDGE_RULE_REFUSAL)
  })
})
