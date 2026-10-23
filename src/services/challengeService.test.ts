import { describe, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'

vi.mock('../lib/convex', () => ({ convex: {} }))

import { challengeErrorCode, challengeErrorMessage } from './challengeService'

describe('challengeErrorMessage', () => {
  test('a ConvexError with object data shows its message', () => {
    const e = new ConvexError({ code: 'challenge', message: 'You can only lock in today' })
    expect(challengeErrorMessage(e)).toBe('You can only lock in today')
    expect(challengeErrorCode(e)).toBe('challenge')
  })

  test('a ConvexError with string data shows the string', () => {
    const e = new ConvexError('This invite has expired')
    expect(challengeErrorMessage(e)).toBe('This invite has expired')
    expect(challengeErrorCode(e)).toBeNull()
  })

  test('a dev-shaped Error is cut down to its sentence, across the newline', () => {
    const e = new Error(
      '[CONVEX M(challenges:checkIn)] [Request ID: 4f1c0e2a] Server Error\nUncaught Error: Unknown don\'t\n    at handler (../convex/challenges.ts:612:7)',
    )
    expect(challengeErrorMessage(e)).toBe("Unknown don't")
    expect(challengeErrorCode(e)).toBeNull()
  })

  test('a production-shaped redacted error falls back to a plain sentence', () => {
    expect(challengeErrorMessage('[CONVEX M(challenges:nudgePartner)] [Request ID: 4f1c0e2a] Server Error')).toBe('Something went wrong')
    expect(challengeErrorMessage(new Error(''))).toBe('Something went wrong')
  })
})
