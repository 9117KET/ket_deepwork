/**
 * convex/challenges.test.ts
 *
 * Two accounts, one challenge: setup, invites, the daily acts, and what each
 * side is allowed to see of the other. Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { emptySummary } from './_shared/challengeValidators'

const modules = import.meta.glob('./**/*.*s')

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'

const setup = {
  name: 'Q4 push',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  goals: ['Ship the thesis draft', 'Run 3x a week', '  '],
  donts: ['No doomscrolling past 30 min', 'No alcohol'],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

const summary = (over: Partial<ReturnType<typeof emptySummary>> = {}) => ({ ...emptySummary(), ...over })

/** A signed-up user: a `users` row whose id is the subject's first segment, as @convex-dev/auth does it. */
async function signUp(t: ReturnType<typeof convexTest>, email: string, session = 's1') {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|${session}` }) }
}

async function pair(t: ReturnType<typeof convexTest>) {
  const a = await signUp(t, 'a@example.com')
  const b = await signUp(t, 'b@example.com')
  await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, {})
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
  return { a, b, token }
}

describe('currentUser', () => {
  test('returns the email stored on the users row, which the JWT does not carry', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    expect(await a.as.query(api.users.currentUser, {})).toEqual({ id: a.id, email: 'a@example.com' })
    expect(await t.query(api.users.currentUser, {})).toBeNull()
  })
})

describe('setup', () => {
  test('creating a challenge makes you its first member; a second challenge is refused', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    expect(await a.as.query(api.challenges.myChallenge, {})).toBeNull()

    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: ' Kin ' })
    const mine = await a.as.query(api.challenges.myChallenge, {})
    expect(mine?.challenge).toMatchObject({ name: 'Q4 push', startDate: '2026-10-01', endDate: '2026-12-31', status: 'active' })
    expect(mine?.me.goals).toEqual(['Ship the thesis draft', 'Run 3x a week'])
    expect(mine?.me.donts.map((d) => d.text)).toEqual(['No doomscrolling past 30 min', 'No alcohol'])
    expect(mine?.me).toMatchObject({ displayName: 'Kin', timezone: BERLIN })
    expect(mine?.partner).toBeNull()

    await expect(
      a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' }),
    ).rejects.toThrow(/already in a challenge/i)
  })

  test('validation: dates, deadlines, timezone, name', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const base = { ...setup, timezone: BERLIN, displayName: 'Kin' }
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, endDate: '2026-09-30' })).rejects.toThrow(/end on or after/i)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, startDate: '1 Oct' })).rejects.toThrow(/YYYY-MM-DD/)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, planDeadline: '25:00' })).rejects.toThrow(/HH:MM/)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, planDeadline: '22:00' })).rejects.toThrow(/before 21:30/)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, timezone: 'Mars/Olympus' })).rejects.toThrow(/timezone/i)
    await expect(a.as.mutation(api.challenges.createChallenge, { ...base, name: '   ' })).rejects.toThrow(/name/i)
    expect(await a.as.query(api.challenges.myChallenge, {})).toBeNull()
  })
})

describe('invites', () => {
  test('an invite link previews without auth, is accepted once, and a third person finds it full', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const b = await signUp(t, 'b@example.com')
    const c = await signUp(t, 'c@example.com')
    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })

    const first = await a.as.mutation(api.challenges.createInvite, {})
    const again = await a.as.mutation(api.challenges.createInvite, {})
    expect(again.token).toBe(first.token)
    expect((await a.as.query(api.challenges.myChallenge, {}))?.invite?.token).toBe(first.token)

    expect(await t.query(api.challenges.invitePreview, { token: first.token })).toEqual({
      status: 'ok',
      challenge: { name: 'Q4 push', startDate: '2026-10-01', endDate: '2026-12-31' },
      inviterName: 'Kin',
      inviterGoals: ['Ship the thesis draft', 'Run 3x a week'],
      inviterDonts: ['No doomscrolling past 30 min', 'No alcohol'],
    })
    expect(await t.query(api.challenges.invitePreview, { token: 'nope' })).toMatchObject({ status: 'notFound' })

    await b.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Sam' })
    expect((await a.as.query(api.challenges.myChallenge, {}))?.partner).toMatchObject({ displayName: 'Sam', timezone: NY })
    expect((await b.as.query(api.challenges.myChallenge, {}))?.partner).toMatchObject({ displayName: 'Kin', timezone: BERLIN })
    expect((await a.as.query(api.challenges.myChallenge, {}))?.invite).toBeNull()

    expect(await t.query(api.challenges.invitePreview, { token: first.token })).toMatchObject({ status: 'used' })
    await expect(
      c.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Cy' }),
    ).rejects.toThrow(/already been used/i)
    await expect(a.as.mutation(api.challenges.createInvite, {})).rejects.toThrow(/two members/i)
    // Accepting again as a member is a no-op, not an error.
    await b.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Sam' })
  })

  test('an expired invite is refused', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const b = await signUp(t, 'b@example.com')
    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
    const { token } = await a.as.mutation(api.challenges.createInvite, {})
    await t.run(async (ctx) => {
      const invite = await ctx.db
        .query('challengeInvites')
        .withIndex('by_token', (q) => q.eq('token', token))
        .unique()
      await ctx.db.patch(invite!._id, { expiresAt: Date.now() - 1 })
    })
    expect(await t.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'expired' })
    await expect(b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })).rejects.toThrow(/expired/i)
    // Asking for a link again mints a fresh one.
    const fresh = await a.as.mutation(api.challenges.createInvite, {})
    expect(fresh.token).not.toBe(token)
  })

  test('someone already in a challenge cannot join another', async () => {
    const t = convexTest(schema, modules)
    const { b } = await pair(t)
    const c = await signUp(t, 'c@example.com')
    await c.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Other', timezone: BERLIN, displayName: 'Cy' })
    const { token } = await c.as.mutation(api.challenges.createInvite, {})
    await expect(b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })).rejects.toThrow(
      /already in a challenge/i,
    )
  })
})

describe('the day', () => {
  test('summaries outside the span are dropped; inside, one row is created then patched', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-09-30', summary: summary({ tasksTotal: 3 }), timezone: BERLIN })
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary({ tasksTotal: 3 }), timezone: BERLIN })
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary({ tasksTotal: 4 }), timezone: BERLIN })
    const rows = await t.run(async (ctx) => ctx.db.query('challengeDays').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ date: '2026-10-22', summary: { tasksTotal: 4 }, dontsBroken: [], remindersSent: { plan: 0, checkin: 0 } })
  })

  test('a sync refreshes the member timezone', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: 'Asia/Tokyo' })
    expect((await a.as.query(api.challenges.myChallenge, {}))?.me.timezone).toBe('Asia/Tokyo')
  })

  test('lock-in is idempotent and stays set through later syncs', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const first = await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 3 }) })
    const second = await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 5 }) })
    expect(second.planSetAt).toBe(first.planSetAt)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary({ tasksTotal: 6 }), timezone: BERLIN })
    const cards = await a.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(cards?.mine).toMatchObject({ planSetAt: first.planSetAt, summary: { tasksTotal: 6 } })
    await expect(a.as.mutation(api.challenges.lockInPlan, { date: '2027-01-01', summary: summary() })).rejects.toThrow(/outside/i)
  })

  test('check-in stores the note and confession, rejects unknown don\'ts, keeps the first time', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    const donts = (await a.as.query(api.challenges.myChallenge, {}))!.me.donts
    await expect(
      a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: summary(), note: 'ok', dontsBroken: ['made-up'] }),
    ).rejects.toThrow(/unknown don't/i)
    const first = await a.as.mutation(api.challenges.checkIn, {
      date: '2026-10-22',
      summary: summary({ deepWorkMinutes: 90 }),
      note: 'Solid day.',
      dontsBroken: [donts[0]!.id, donts[0]!.id],
    })
    const seen = await b.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner).toEqual({
      date: '2026-10-22',
      summary: summary({ deepWorkMinutes: 90 }),
      summaryUpdatedAt: expect.any(Number),
      planSetAt: null,
      checkinAt: first.checkinAt,
      note: 'Solid day.',
      dontsBroken: [donts[0]!.id],
    })
    const second = await a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: summary(), dontsBroken: [] })
    expect(second.checkinAt).toBe(first.checkinAt)
    const again = await b.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(again?.partner).toMatchObject({ note: null, dontsBroken: [] })
  })

  test('the partner view never carries reminder bookkeeping', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: BERLIN })
    const seen = await b.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner).not.toHaveProperty('remindersSent')
    expect(seen?.partner).not.toHaveProperty('nudgeSentAt')
    expect(seen?.partner).not.toHaveProperty('userId')
    const hist = await b.as.query(api.challenges.history, { toDate: '2026-10-22' })
    expect(hist?.partner).toHaveLength(1)
    expect(hist?.partner[0]).not.toHaveProperty('remindersSent')
  })

  test('history covers both members from the start date up to toDate', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    for (const date of ['2026-10-20', '2026-10-21', '2026-10-22']) {
      await a.as.mutation(api.challenges.lockInPlan, { date, summary: summary() })
    }
    await b.as.mutation(api.challenges.checkIn, { date: '2026-10-21', summary: summary(), dontsBroken: [] })
    const hist = await a.as.query(api.challenges.history, { toDate: '2026-10-21' })
    expect(hist?.mine.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-21'])
    expect(hist?.partner.map((d) => d.date)).toEqual(['2026-10-21'])
  })
})

describe('leaving', () => {
  test('the last one out ends the challenge; rows stay', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })
    await a.as.mutation(api.challenges.leaveChallenge, {})
    expect(await a.as.query(api.challenges.myChallenge, {})).toBeNull()
    expect((await b.as.query(api.challenges.myChallenge, {}))?.partner).toBeNull()
    await b.as.mutation(api.challenges.leaveChallenge, {})
    expect(await b.as.query(api.challenges.myChallenge, {})).toBeNull()
    const challenges = await t.run(async (ctx) => ctx.db.query('challenges').collect())
    expect(challenges[0]?.status).toBe('ended')
    expect(await t.run(async (ctx) => ctx.db.query('challengeDays').collect())).toHaveLength(1)
    // Free to start again.
    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  })
})

describe('auth guards', () => {
  test('every write needs a signed-in user; reads answer null', async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'x' })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.createInvite, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.acceptInvite, { token: 'x', timezone: BERLIN, displayName: 'x' })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: BERLIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: summary(), dontsBroken: [] })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.leaveChallenge, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/not authenticated/i)
    expect(await t.query(api.challenges.myChallenge, {})).toBeNull()
    expect(await t.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await t.query(api.challenges.history, { toDate: '2026-10-22' })).toBeNull()
  })

  test('a signed-in non-member is told so', async () => {
    const t = convexTest(schema, modules)
    const c = await signUp(t, 'c@example.com')
    await expect(c.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })).rejects.toThrow(/not in a challenge/i)
    expect(await c.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
  })
})
