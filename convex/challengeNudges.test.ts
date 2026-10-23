/**
 * convex/challengeNudges.test.ts
 *
 * `nudgePartner` against the three-a-day, hour-apart allowance, end to end
 * against a mocked nodemailer. Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { zonedWallTimeToUtc } from './_shared/calendarTime'
import { emptySummary } from './_shared/challengeValidators'

const sendMail = vi.fn(async () => ({ messageId: 'x' }))
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

const modules = import.meta.glob('./**/*.*s')

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'
const at = (date: string, hhmm: string, tz: string) => zonedWallTimeToUtc(date, `${hhmm}:00`, tz).getTime()

const setup = {
  name: 'Q4 push',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  goals: [],
  donts: [],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

async function signUp(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

async function pair(t: ReturnType<typeof convexTest>, overrides: Partial<typeof setup> = {}) {
  const a = await signUp(t, 'a@example.com')
  const b = await signUp(t, 'b@example.com')
  await a.as.mutation(api.challenges.createChallenge, { ...setup, ...overrides, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, {})
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
  return { a, b }
}

beforeEach(() => {
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = 'https://ket-deepwork.vercel.app'
  sendMail.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('nudgePartner allowance', () => {
  test('three nudges an hour apart go out, the fourth is refused', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    // 10:00 Berlin is 04:00 New York: Sam owes the plan all through this.
    vi.useFakeTimers({ now: at('2026-10-22', '10:00', BERLIN) })
    const first = await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(first).toEqual({ left: 2, nextAt: at('2026-10-22', '11:00', BERLIN) })

    vi.setSystemTime(at('2026-10-22', '11:00', BERLIN))
    const second = await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(second.left).toBe(1)

    vi.setSystemTime(at('2026-10-22', '12:30', BERLIN))
    const third = await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(third).toEqual({ left: 0, nextAt: null })
    expect(sendMail).toHaveBeenCalledTimes(3)
    for (const call of sendMail.mock.calls) {
      expect((call as unknown as [{ to: string }])[0].to).toBe('b@example.com')
    }

    vi.setSystemTime(at('2026-10-22', '15:00', BERLIN))
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/nudged them 3 times today/i)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).toHaveBeenCalledTimes(3)

    const cards = await a.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(cards?.mine?.nudgesSentAt).toHaveLength(3)
  })

  test('a second nudge inside the hour is refused with the wait', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    vi.useFakeTimers({ now: at('2026-10-22', '10:00', BERLIN) })
    await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.setSystemTime(at('2026-10-22', '10:10', BERLIN))
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/again in 50 min/i)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  test('a row holding only the legacy stamp counts as one nudge', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const legacyAt = at('2026-10-22', '08:00', BERLIN)
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('challengeMembers')
        .filter((q) => q.eq(q.field('displayName'), 'Kin'))
        .first()
      await ctx.db.insert('challengeDays', {
        challengeId: member!.challengeId,
        userId: member!.userId,
        date: '2026-10-22',
        summary: emptySummary(),
        summaryUpdatedAt: legacyAt,
        dontsBroken: [],
        remindersSent: { plan: 0, checkin: 0 },
        nudgeSentAt: legacyAt,
      })
    })
    vi.useFakeTimers({ now: at('2026-10-22', '08:30', BERLIN) })
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/again in 30 min/i)

    vi.setSystemTime(at('2026-10-22', '09:00', BERLIN))
    const res = await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(res.left).toBe(1)
    expect(sendMail).toHaveBeenCalledTimes(1)
    const cards = await a.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(cards?.mine?.nudgesSentAt).toEqual([legacyAt, at('2026-10-22', '09:00', BERLIN)])
  })

  test('a partner who has locked in is not owed a nudge', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    vi.useFakeTimers({ now: at('2026-10-22', '15:00', BERLIN) })
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/already locked in/i)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).not.toHaveBeenCalled()
    const cards = await a.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(cards?.mine).toBeNull()
  })

  test('refused outside the challenge span on the partner clock', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t, { startDate: '2026-10-23' })
    // 05:00 Berlin on the 23rd is 23:00 New York on the 22nd: Sam's day is before the start.
    vi.useFakeTimers({ now: at('2026-10-23', '05:00', BERLIN) })
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/not running today/i)
    expect(sendMail).not.toHaveBeenCalled()
  })
})
