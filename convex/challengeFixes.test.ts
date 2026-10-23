/**
 * convex/challengeFixes.test.ts
 *
 * The audit fixes (spec 03): refusals as `ConvexError` sentences, a finished
 * season that stays readable, the partner's history to their own yesterday,
 * publishing only the member's today, and the creation limits.
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import schema from './schema'
import { api } from './_generated/api'
import { zonedWallTimeToUtc } from './_shared/calendarTime'
import { emptySummary } from './_shared/challengeValidators'
import { NUDGE_RULE_CODE } from './_shared/challengeNudges'

const modules = import.meta.glob('./**/*.*s')

const LONDON = 'Europe/London'
const TOKYO = 'Asia/Tokyo'
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

type T = ReturnType<typeof convexTest>

async function signUp(t: T, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

/** Kin in London, Sam in Tokyo: eight hours apart, so their dates differ every evening. */
async function pair(t: T) {
  const a = await signUp(t, 'a@example.com')
  const b = await signUp(t, 'b@example.com')
  await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: LONDON, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, {})
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: TOKYO, displayName: 'Sam' })
  return { a, b, token }
}

/** The data of the `ConvexError` a call rejects with. */
async function refusal(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ConvexError)
    return (e as ConvexError<{ code: string; message: string }>).data
  }
  throw new Error('expected a refusal')
}

beforeEach(() => {
  // 12:00 London on 22 Oct is 20:00 in Tokyo, the same date.
  vi.useFakeTimers({ now: at('2026-10-22', '12:00', LONDON), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('refusals are sentences', () => {
  test('an expected state throws ConvexError({ code, message })', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    expect(await refusal(a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() }))).toEqual({
      code: 'challenge',
      message: 'You are not in a challenge',
    })
  })

  test('a nudge refused by the rules carries its own code', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect(await refusal(a.as.mutation(api.challenges.nudgePartner, {}))).toEqual({
      code: NUDGE_RULE_CODE,
      message: 'They have already locked in their plan',
    })
  })
})

describe('the finished season stays readable', () => {
  test('an ended challenge is still returned; a new one can be started over it', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await t.run(async (ctx) => {
      const [challenge] = await ctx.db.query('challenges').collect()
      await ctx.db.patch(challenge!._id, { status: 'ended' })
    })

    const ended = await a.as.query(api.challenges.myChallenge, {})
    expect(ended?.challenge).toMatchObject({ name: 'Q4 push', status: 'ended' })
    expect(ended?.partner).toMatchObject({ displayName: 'Sam' })
    expect(ended?.invite).toBeNull()
    const hist = await a.as.query(api.challenges.history, { toDate: '2026-12-31' })
    expect(hist?.mine.map((d) => d.date)).toEqual(['2026-10-22'])
    expect(await a.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })).not.toBeNull()

    // Writes see only active challenges: the ended one cannot be written to, and does not block a new one.
    await expect(a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })).rejects.toThrow(/not in a challenge/i)
    await a.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Next', timezone: LONDON, displayName: 'Kin' })
    expect((await a.as.query(api.challenges.myChallenge, {}))?.challenge).toMatchObject({ name: 'Next', status: 'active' })
  })
})

describe('history to the partner\'s yesterday', () => {
  test('partnerToDate reaches the partner row on the viewer\'s today', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    // 20:00 London on 22 Oct is 04:00 on 23 Oct in Tokyo: Sam checks in for their 22nd.
    vi.setSystemTime(at('2026-10-22', '20:00', LONDON))
    await b.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: emptySummary(), dontsBroken: [] })

    // Kin's yesterday is the 21st; Sam's yesterday is the 22nd.
    const both = await a.as.query(api.challenges.history, { toDate: '2026-10-21', partnerToDate: '2026-10-22' })
    expect(both?.partner.map((d) => d.date)).toEqual(['2026-10-22'])
    expect(both?.mine).toEqual([])
    const same = await a.as.query(api.challenges.history, { toDate: '2026-10-21' })
    expect(same?.partner).toEqual([])
  })
})

describe('the planner publishes only today', () => {
  test('a sync for a day three ahead writes no row; today and the day either side do', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-25', summary: emptySummary(), timezone: LONDON })
    expect(await t.run(async (ctx) => ctx.db.query('challengeDays').collect())).toHaveLength(0)
    for (const date of ['2026-10-21', '2026-10-22', '2026-10-23']) {
      await a.as.mutation(api.challenges.syncDaySummary, { date, summary: emptySummary(), timezone: LONDON })
    }
    const rows = await t.run(async (ctx) => ctx.db.query('challengeDays').collect())
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-10-21', '2026-10-22', '2026-10-23'])
  })

  test('lock-in takes today only; check-in today or yesterday', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    expect(await refusal(a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-21', summary: emptySummary() }))).toEqual({
      code: 'challenge',
      message: 'You can only lock in today',
    })
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await a.as.mutation(api.challenges.checkIn, { date: '2026-10-21', summary: emptySummary(), dontsBroken: [] })
    await expect(
      a.as.mutation(api.challenges.checkIn, { date: '2026-10-20', summary: emptySummary(), dontsBroken: [] }),
    ).rejects.toThrow(/only check in for today or yesterday/i)
    await expect(
      a.as.mutation(api.challenges.checkIn, { date: '2026-10-23', summary: emptySummary(), dontsBroken: [] }),
    ).rejects.toThrow(/only check in for today or yesterday/i)
  })
})

describe('creation limits', () => {
  test('a season runs at most 366 days', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const base = { ...setup, timezone: LONDON, displayName: 'Kin' }
    await expect(
      a.as.mutation(api.challenges.createChallenge, { ...base, startDate: '2027-01-01', endDate: '2028-01-02' }),
    ).rejects.toThrow(/at most a year/i)
    // 2028 is a leap year: 1 Jan to 31 Dec is 366 days.
    await a.as.mutation(api.challenges.createChallenge, { ...base, startDate: '2028-01-01', endDate: '2028-12-31' })
    expect((await a.as.query(api.challenges.myChallenge, {}))?.challenge.endDate).toBe('2028-12-31')
  })

  test('the check-in deadline must fall after 21:30', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const base = { ...setup, timezone: LONDON, displayName: 'Kin' }
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, checkinDeadline: '21:00' })).rejects.toThrow(/after 21:30/)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, checkinDeadline: '21:30' })).rejects.toThrow(/after 21:30/)
    await a.as.mutation(api.challenges.createChallenge, { ...base, checkinDeadline: '21:31' })
  })

  test('blank don\'t rows do not count against the cap', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const ten = Array.from({ length: 10 }, (_, i) => ({ text: `Dont ${i + 1}` }))
    const saved = await a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [...ten, { text: '   ' }] })
    expect(saved.donts).toHaveLength(10)
    await expect(
      a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [...ten, { text: 'Eleven' }] }),
    ).rejects.toThrow(/at most 10 don'ts/i)
  })
})

describe('invite preview for a member', () => {
  test('a member opening their own accepted link is told they are in; others still see "used"', async () => {
    const t = convexTest(schema, modules)
    const { a, b, token } = await pair(t)
    const c = await signUp(t, 'c@example.com')
    expect(await b.as.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'member', challenge: { name: 'Q4 push' } })
    expect(await a.as.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'member' })
    expect(await c.as.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'used' })
    expect(await t.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'used' })
  })
})
