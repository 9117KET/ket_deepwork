/**
 * convex/challenges.test.ts
 *
 * Two accounts, one challenge: setup, invites, the daily acts, and what each
 * side is allowed to see of the other. Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { emptySummary } from './_shared/challengeValidators'

const modules = import.meta.glob('./**/*.*s')

// The day's acts only take the member's own today: pin the clock to 22 Oct, 12:00 Berlin.
beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

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
  const { challengeId } = await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, { challengeId })
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
  return { a, b, token, challengeId }
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
  test('creating a challenge makes you its first member; a second one runs alongside it', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    expect(((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null)).toBeNull()

    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: ' Kin ' })
    const mine = ((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null)
    expect(mine?.challenge).toMatchObject({ name: 'Q4 push', startDate: '2026-10-01', endDate: '2026-12-31', status: 'active' })
    expect(mine?.me.goals).toEqual(['Ship the thesis draft', 'Run 3x a week'])
    expect(mine?.me.donts.map((d) => d.text)).toEqual(['No doomscrolling past 30 min', 'No alcohol'])
    expect(mine?.me).toMatchObject({ displayName: 'Kin', timezone: BERLIN })
    expect(mine?.partner).toBeNull()

    expect(mine?.challenge).toMatchObject({ endedReason: null, endedAt: null, warning: null, isCreator: true })

    // Many challenges per person: a second is a new season beside the first, not a refusal.
    await a.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Thesis sprint', timezone: BERLIN, displayName: 'Kin' })
    const all = await a.as.query(api.challenges.myChallenges, {})
    expect(all.map((e) => e.challenge.name).sort()).toEqual(['Q4 push', 'Thesis sprint'])
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
    expect(((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null)).toBeNull()
  })
})

describe('invites', () => {
  test('an invite link previews without auth, is accepted once, and a third person finds it full', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const b = await signUp(t, 'b@example.com')
    const c = await signUp(t, 'c@example.com')
    const { challengeId } = await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })

    const first = await a.as.mutation(api.challenges.createInvite, { challengeId })
    const again = await a.as.mutation(api.challenges.createInvite, { challengeId })
    expect(again.token).toBe(first.token)
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.invite?.token).toBe(first.token)

    expect(await t.query(api.challenges.invitePreview, { token: first.token })).toEqual({
      status: 'ok',
      challenge: { name: 'Q4 push', startDate: '2026-10-01', endDate: '2026-12-31' },
      inviterName: 'Kin',
      inviterGoals: ['Ship the thesis draft', 'Run 3x a week'],
      inviterDonts: ['No doomscrolling past 30 min', 'No alcohol'],
    })
    expect(await t.query(api.challenges.invitePreview, { token: 'nope' })).toMatchObject({ status: 'notFound' })

    await b.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Sam' })
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.partner).toMatchObject({ displayName: 'Sam', timezone: NY })
    expect((((await b.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.partner).toMatchObject({ displayName: 'Kin', timezone: BERLIN })
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.invite).toBeNull()

    expect(await t.query(api.challenges.invitePreview, { token: first.token })).toMatchObject({ status: 'used' })
    await expect(
      c.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Cy' }),
    ).rejects.toThrow(/already been used/i)
    await expect(a.as.mutation(api.challenges.createInvite, { challengeId })).rejects.toThrow(/two members/i)
    // Accepting again as a member is a no-op, not an error.
    await b.as.mutation(api.challenges.acceptInvite, { token: first.token, timezone: NY, displayName: 'Sam' })
  })

  test('an expired invite is refused', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const b = await signUp(t, 'b@example.com')
    const { challengeId } = await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
    const { token } = await a.as.mutation(api.challenges.createInvite, { challengeId })
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
    const fresh = await a.as.mutation(api.challenges.createInvite, { challengeId })
    expect(fresh.token).not.toBe(token)
  })

  test('someone already in a challenge can join another', async () => {
    const t = convexTest(schema, modules)
    const { b } = await pair(t)
    const c = await signUp(t, 'c@example.com')
    const other = await c.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Other', timezone: BERLIN, displayName: 'Cy' })
    const { token } = await c.as.mutation(api.challenges.createInvite, { challengeId: other.challengeId })
    const joined = await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
    expect(joined.challengeId).toBe(other.challengeId)
    const mine = await b.as.query(api.challenges.myChallenges, {})
    expect(mine.map((e) => e.challenge.name).sort()).toEqual(['Other', 'Q4 push'])
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
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.me.timezone).toBe('Asia/Tokyo')
  })

  test('lock-in is idempotent and stays set through later syncs', async () => {
    const t = convexTest(schema, modules)
    const { a, challengeId } = await pair(t)
    const first = await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 3 }) })
    const second = await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 5 }) })
    expect(second.planSetAt).toBe(first.planSetAt)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary({ tasksTotal: 6 }), timezone: BERLIN })
    const cards = await a.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(cards?.mine).toMatchObject({ planSetAt: first.planSetAt, summary: { tasksTotal: 6 } })
    await expect(a.as.mutation(api.challenges.lockInPlan, { date: '2027-01-01', summary: summary() })).rejects.toThrow(/outside/i)
  })

  test('check-in stores the note and confession, rejects unknown don\'ts, keeps the first time', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    const donts = (((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))!.me.donts
    await expect(
      a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), note: 'ok', dontsBroken: ['made-up'] }),
    ).rejects.toThrow(/unknown don't/i)
    const first = await a.as.mutation(api.challenges.checkIn, {
      challengeId,
      date: '2026-10-22',
      summary: summary({ deepWorkMinutes: 90 }),
      note: 'Solid day.',
      dontsBroken: [donts[0]!.id, donts[0]!.id],
    })
    const seen = await b.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner).toEqual({
      date: '2026-10-22',
      summary: summary({ deepWorkMinutes: 90 }),
      summaryUpdatedAt: expect.any(Number),
      planSetAt: null,
      checkinAt: first.checkinAt,
      note: 'Solid day.',
      dontsBroken: [donts[0]!.id],
    })
    const second = await a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [] })
    expect(second.checkinAt).toBe(first.checkinAt)
    const again = await b.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(again?.partner).toMatchObject({ note: null, dontsBroken: [] })
  })

  test('the partner view never carries reminder bookkeeping', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: BERLIN })
    const seen = await b.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner).not.toHaveProperty('remindersSent')
    expect(seen?.partner).not.toHaveProperty('nudgeSentAt')
    expect(seen?.partner).not.toHaveProperty('nudgesSentAt')
    expect(seen?.partner).not.toHaveProperty('userId')
    const hist = await b.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' })
    expect(hist?.partner).toHaveLength(1)
    expect(hist?.partner[0]).not.toHaveProperty('remindersSent')
  })

  test('history covers both members from the start date up to toDate', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    for (const day of [20, 21, 22]) {
      vi.setSystemTime(Date.UTC(2026, 9, day, 10, 0))
      await a.as.mutation(api.challenges.lockInPlan, { date: `2026-10-${day}`, summary: summary() })
    }
    await b.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-21', summary: summary(), dontsBroken: [] })
    const hist = await a.as.query(api.challenges.history, { challengeId, toDate: '2026-10-21' })
    expect(hist?.mine.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-21'])
    expect(hist?.partner.map((d) => d.date)).toEqual(['2026-10-21'])
  })
})

describe('renaming', () => {
  test('either member renames the season; blanks, long names and outsiders are refused', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    await b.as.mutation(api.challenges.renameChallenge, { challengeId, name: '  Winter lock-in ' })
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.challenge.name).toBe('Winter lock-in')
    await expect(a.as.mutation(api.challenges.renameChallenge, { challengeId, name: '   ' })).rejects.toThrow(/name is required/i)
    await expect(a.as.mutation(api.challenges.renameChallenge, { challengeId, name: 'x'.repeat(81) })).rejects.toThrow(/80 characters/i)
    const c = await signUp(t, 'c@example.com')
    await expect(c.as.mutation(api.challenges.renameChallenge, { challengeId, name: 'Mine now' })).rejects.toThrow(/not in this challenge/i)
    await expect(t.mutation(api.challenges.renameChallenge, { challengeId, name: 'x' })).rejects.toThrow(/not authenticated/i)
  })
})

describe('leaving', () => {
  test('the partner leaving keeps it running; the creator then leaving ends it; rows stay', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })
    await b.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect(((await b.as.query(api.challenges.myChallenges, {}))[0] ?? null)).toBeNull()
    const alone = ((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null)
    expect(alone?.partner).toBeNull()
    expect(alone?.challenge.status).toBe('active')
    // Alone again, the creator can invite someone new.
    expect((await a.as.mutation(api.challenges.createInvite, { challengeId })).token).toBeTruthy()

    await a.as.mutation(api.challenges.leaveChallenge, { challengeId })
    // The creator's row is kept, so the season stays readable, ended.
    expect((((await a.as.query(api.challenges.myChallenges, {}))[0] ?? null))?.challenge).toMatchObject({ status: 'ended', endedReason: 'allLeft' })
    const challenges = await t.run(async (ctx) => ctx.db.query('challenges').collect())
    expect(challenges[0]).toMatchObject({ status: 'ended', endedReason: 'allLeft', endedAt: expect.any(Number) })
    expect(await t.run(async (ctx) => ctx.db.query('challengeDays').collect())).toHaveLength(1)
    await expect(a.as.mutation(api.challenges.leaveChallenge, { challengeId })).rejects.toThrow(/has ended/i)
    // Free to start again.
    await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  })
})

describe('auth guards', () => {
  test('every write needs a signed-in user; reads answer null', async () => {
    const t = convexTest(schema, modules)
    const owner = await signUp(t, 'o@example.com')
    const { challengeId } = await owner.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'O' })
    await expect(t.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'x' })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.createInvite, { challengeId })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.acceptInvite, { token: 'x', timezone: BERLIN, displayName: 'x' })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: BERLIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [] })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.leaveChallenge, { challengeId })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.challenges.nudgePartner, { challengeId })).rejects.toThrow(/not authenticated/i)
    expect(((await t.query(api.challenges.myChallenges, {}))[0] ?? null)).toBeNull()
    expect(await t.query(api.challenges.myChallenges, {})).toEqual([])
    expect(await t.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await t.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] })).toEqual([])
    expect(await t.query(api.challenges.history, { challengeId, toDate: '2026-10-22' })).toBeNull()
  })

  test('a signed-in non-member is told so', async () => {
    const t = convexTest(schema, modules)
    const { challengeId } = await pair(t)
    const c = await signUp(t, 'c@example.com')
    await expect(c.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })).rejects.toThrow(/not in a challenge/i)
    await expect(c.as.mutation(api.challenges.lockInPlan, { challengeId, date: '2026-10-22', summary: summary() })).rejects.toThrow(/not in this challenge/i)
    await expect(c.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [] })).rejects.toThrow(/not in this challenge/i)
    expect(await c.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await c.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' })).toBeNull()
    expect(await c.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] })).toEqual([])
  })
})
