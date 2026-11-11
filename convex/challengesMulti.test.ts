/**
 * convex/challengesMulti.test.ts
 *
 * One person, many challenges, each with its own partner and each private to
 * its members. The day's summary fans out, the lock-in is one act for the
 * day, the check-in is per challenge, the creator leaving hands it over, and
 * an admin reads every challenge. Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { emptySummary } from './_shared/challengeValidators'

const modules = import.meta.glob('./**/*.*s')

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'
const LISBON = 'Europe/Lisbon'

const setup = {
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
type User = Awaited<ReturnType<typeof signUp>>

async function start(t: T, owner: User, name: string, timezone = BERLIN, displayName = 'Kin'): Promise<Id<'challenges'>> {
  const { challengeId } = await owner.as.mutation(api.challenges.createChallenge, { ...setup, name, timezone, displayName })
  return challengeId
}

async function join(owner: User, guest: User, challengeId: Id<'challenges'>, timezone: string, displayName: string) {
  const { token } = await owner.as.mutation(api.challenges.createInvite, { challengeId })
  await guest.as.mutation(api.challenges.acceptInvite, { token, timezone, displayName })
}

/** Kin runs "Q4 push" with Sam and "Thesis sprint" with Ana. */
async function twoChallenges(t: T) {
  const kin = await signUp(t, 'kin@example.com')
  const sam = await signUp(t, 'sam@example.com')
  const ana = await signUp(t, 'ana@example.com')
  const q4 = await start(t, kin, 'Q4 push')
  await join(kin, sam, q4, NY, 'Sam')
  const thesis = await start(t, kin, 'Thesis sprint')
  await join(kin, ana, thesis, LISBON, 'Ana')
  return { kin, sam, ana, q4, thesis }
}

async function dayRow(t: T, challengeId: Id<'challenges'>, userId: string, date: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query('challengeDays')
      .withIndex('by_challenge_user_date', (q) => q.eq('challengeId', challengeId).eq('userId', userId).eq('date', date))
      .unique(),
  )
}

async function refusal(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ConvexError)
    return (e as ConvexError<{ code: string; message: string }>).data
  }
  throw new Error('expected a refusal')
}

// 12:00 Berlin, 06:00 New York, 11:00 Lisbon: one date, 22 Oct, for everyone.
beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.ADMIN_EMAILS
})

describe('many challenges, each private', () => {
  test('each partner sees exactly their own challenge, and nothing of the other', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, ana } = await twoChallenges(t)

    const mine = await kin.as.query(api.challenges.myChallenges, {})
    expect(mine.map((e) => e.challenge.name)).toEqual(['Thesis sprint', 'Q4 push'])
    expect(mine.map((e) => e.partner?.displayName)).toEqual(['Ana', 'Sam'])

    const samSees = await sam.as.query(api.challenges.myChallenges, {})
    expect(samSees).toHaveLength(1)
    expect(samSees[0]!.challenge.name).toBe('Q4 push')
    expect(samSees[0]!.challenge.isCreator).toBe(false)
    expect(samSees[0]!.partner).not.toHaveProperty('userId')
    expect(samSees[0]!.me).not.toHaveProperty('userId')
    const samJson = JSON.stringify(samSees)
    expect(samJson).not.toContain('Thesis sprint')
    expect(samJson).not.toContain('Ana')
    expect(samJson).not.toContain(kin.id)
    expect(samJson).not.toContain('@example.com')

    const anaSees = await ana.as.query(api.challenges.myChallenges, {})
    expect(anaSees.map((e) => e.challenge.name)).toEqual(['Thesis sprint'])
    expect(JSON.stringify(anaSees)).not.toContain('Q4 push')
  })

  test('todayCards: two rows for Kin, one for each partner; foreign ids are skipped', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, ana, q4, thesis } = await twoChallenges(t)
    await sam.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })

    const cards = [
      { challengeId: q4, partnerDate: '2026-10-22' },
      { challengeId: thesis, partnerDate: '2026-10-22' },
    ]
    const kinCards = await kin.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards })
    expect(kinCards.map((c) => c.challengeId)).toEqual([q4, thesis])
    expect(kinCards[0]!.partner).toMatchObject({ date: '2026-10-22', planSetAt: expect.any(Number) })
    expect(kinCards[0]!.partner).not.toHaveProperty('userId')
    expect(kinCards[0]!.partner).not.toHaveProperty('remindersSent')
    expect(kinCards[1]!.partner).toBeNull()

    const samCards = await sam.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards })
    expect(samCards.map((c) => c.challengeId)).toEqual([q4])
    expect(samCards[0]!.mine).toMatchObject({ planSetAt: expect.any(Number), checkinAt: null })
    expect(samCards[0]!.mine).not.toHaveProperty('remindersSent')
    expect(samCards[0]!.mine).not.toHaveProperty('userId')
    expect(JSON.stringify(samCards)).not.toContain(thesis)

    const anaCards = await ana.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards })
    expect(anaCards.map((c) => c.challengeId)).toEqual([thesis])
  })

  test('dayCards and history answer only for a challenge you are in', async () => {
    const t = convexTest(schema, modules)
    const { sam, thesis, q4 } = await twoChallenges(t)
    expect(await sam.as.query(api.challenges.dayCards, { challengeId: thesis, myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await sam.as.query(api.challenges.history, { challengeId: thesis, toDate: '2026-10-21' })).toBeNull()
    expect(await sam.as.query(api.challenges.dayCards, { challengeId: q4, myDate: '2026-10-22', partnerDate: '2026-10-22' })).not.toBeNull()
    // A stale or mistyped route id reads as "not yours", never an argument error.
    expect(await sam.as.query(api.challenges.dayCards, { challengeId: 'nope', myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await sam.as.query(api.challenges.history, { challengeId: 'nope', toDate: '2026-10-21' })).toBeNull()
    expect(await refusal(sam.as.mutation(api.challenges.nudgePartner, { challengeId: thesis }))).toEqual({
      code: 'challenge',
      message: 'You are not in this challenge',
    })
  })
})

describe('one publish, one lock-in, check-ins apart', () => {
  test('syncDaySummary writes the row in both challenges', async () => {
    const t = convexTest(schema, modules)
    const { kin, q4, thesis } = await twoChallenges(t)
    await kin.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: { ...emptySummary(), tasksTotal: 4 }, timezone: BERLIN })
    expect(await dayRow(t, q4, kin.id, '2026-10-22')).toMatchObject({ summary: { tasksTotal: 4 } })
    expect(await dayRow(t, thesis, kin.id, '2026-10-22')).toMatchObject({ summary: { tasksTotal: 4 } })
  })

  test('the timezone refresh reaches every membership', async () => {
    const t = convexTest(schema, modules)
    const { kin } = await twoChallenges(t)
    await kin.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: emptySummary(), timezone: 'Europe/Paris' })
    const zones = (await kin.as.query(api.challenges.myChallenges, {})).map((e) => e.me.timezone)
    expect(zones).toEqual(['Europe/Paris', 'Europe/Paris'])
  })

  test('lockInPlan with an id stamps one; without, it stamps both and keeps the first time', async () => {
    const t = convexTest(schema, modules)
    const { kin, q4, thesis } = await twoChallenges(t)
    const one = await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary(), challengeId: q4 })
    expect(one.locked).toEqual([{ challengeId: q4, planSetAt: one.planSetAt }])
    expect((await dayRow(t, q4, kin.id, '2026-10-22'))?.planSetAt).toBe(one.planSetAt)
    expect(await dayRow(t, thesis, kin.id, '2026-10-22')).toBeNull()

    vi.setSystemTime(Date.UTC(2026, 9, 22, 10, 30))
    const all = await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect(all.locked).toHaveLength(2)
    expect(all.planSetAt).toBe(one.planSetAt)
    expect((await dayRow(t, q4, kin.id, '2026-10-22'))?.planSetAt).toBe(one.planSetAt)
    expect((await dayRow(t, thesis, kin.id, '2026-10-22'))?.planSetAt).toBe(Date.UTC(2026, 9, 22, 10, 30))
    // Both member rows record the act.
    const members = await t.run(async (ctx) =>
      ctx.db
        .query('challengeMembers')
        .withIndex('by_user', (q) => q.eq('userId', kin.id))
        .take(10),
    )
    expect(members.map((m) => m.lastActedAt)).toEqual([Date.UTC(2026, 9, 22, 10, 30), Date.UTC(2026, 9, 22, 10, 30)])
  })

  test('checkIn on one challenge does not touch the other', async () => {
    const t = convexTest(schema, modules)
    const { kin, q4, thesis } = await twoChallenges(t)
    await kin.as.mutation(api.challenges.checkIn, { challengeId: q4, date: '2026-10-22', summary: emptySummary(), note: 'Good', dontsBroken: [] })
    expect(await dayRow(t, q4, kin.id, '2026-10-22')).toMatchObject({ checkinAt: expect.any(Number), note: 'Good' })
    expect(await dayRow(t, thesis, kin.id, '2026-10-22')).toBeNull()
  })
})

describe('the cap', () => {
  test('twenty active challenges at once; the twenty-first is refused, joining too', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    for (let i = 1; i <= 20; i++) await start(t, kin, `Season ${i}`)
    expect(await refusal(kin.as.mutation(api.challenges.createChallenge, { ...setup, name: 'One more', timezone: BERLIN, displayName: 'Kin' }))).toEqual({
      code: 'challenge',
      message: 'You are in 20 challenges already',
    })
    const sam = await signUp(t, 'sam@example.com')
    const theirs = await start(t, sam, 'Sam season', NY, 'Sam')
    const { token } = await sam.as.mutation(api.challenges.createInvite, { challengeId: theirs })
    await expect(kin.as.mutation(api.challenges.acceptInvite, { token, timezone: BERLIN, displayName: 'Kin' })).rejects.toThrow(
      /in 20 challenges already/,
    )
  })
})

describe('leaving', () => {
  // Rewritten for groups (2026-11-11): the creator leaving no longer ends it (`creatorLeft`);
  // the role passes to the longest-standing member and the challenge runs on.
  test('the creator leaving hands it to the partner, who runs on; the leaver no longer sees it', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, q4, thesis } = await twoChallenges(t)
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId: q4 })
    const samSees = await sam.as.query(api.challenges.myChallenges, {})
    expect(samSees).toHaveLength(1)
    expect(samSees[0]!.challenge).toMatchObject({ status: 'active', endedReason: null, isCreator: true, memberCount: 1 })
    expect(samSees[0]!.partner).toBeNull()
    const kinSees = await kin.as.query(api.challenges.myChallenges, {})
    expect(kinSees.map((e) => [e.challenge.name, e.challenge.status])).toEqual([['Thesis sprint', 'active']])
    await sam.as.mutation(api.challenges.checkIn, { challengeId: q4, date: '2026-10-22', summary: emptySummary(), dontsBroken: [] })
    expect(await refusal(kin.as.mutation(api.challenges.checkIn, { challengeId: q4, date: '2026-10-22', summary: emptySummary(), dontsBroken: [] }))).toEqual({
      code: 'challenge',
      message: 'You are not in this challenge',
    })
    // The other challenge is untouched.
    expect((await kin.as.query(api.challenges.myChallenges, {}))[0]!.challenge.id).toBe(thesis)
  })

  test('a partner leaving leaves it active for the creator', async () => {
    const t = convexTest(schema, modules)
    const { kin, ana, thesis } = await twoChallenges(t)
    await ana.as.mutation(api.challenges.leaveChallenge, { challengeId: thesis })
    expect(await ana.as.query(api.challenges.myChallenges, {})).toEqual([])
    const kinThesis = (await kin.as.query(api.challenges.myChallenges, {})).find((e) => e.challenge.id === thesis)!
    expect(kinThesis.challenge).toMatchObject({ status: 'active', endedReason: null })
    expect(kinThesis.partner).toBeNull()
  })
})

describe('admin', () => {
  test('adminStatus: false for a plain user and when unset; true for an ADMIN_EMAILS address', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam } = await twoChallenges(t)
    expect(await kin.as.query(api.challenges.adminStatus, {})).toEqual({ isAdmin: false })
    expect(await t.query(api.challenges.adminStatus, {})).toEqual({ isAdmin: false })
    process.env.ADMIN_EMAILS = ' other@example.com , KIN@Example.com '
    expect(await kin.as.query(api.challenges.adminStatus, {})).toEqual({ isAdmin: true })
    expect(await sam.as.query(api.challenges.adminStatus, {})).toEqual({ isAdmin: false })
  })

  test('adminListChallenges refuses a non-admin and lists every challenge with member emails', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, q4 } = await twoChallenges(t)
    process.env.ADMIN_EMAILS = 'kin@example.com'
    expect(await refusal(sam.as.query(api.challenges.adminListChallenges, {}))).toEqual({ code: 'challenge', message: 'Not an admin' })

    await sam.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    // Rewritten for groups (2026-11-11): the creator leaving hands over instead of ending it with `creatorLeft`.
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId: q4 })
    const rows = await kin.as.query(api.challenges.adminListChallenges, {})
    expect(rows.map((r) => r.name)).toEqual(['Thesis sprint', 'Q4 push'])
    const q4Row = rows.find((r) => r.id === q4)!
    expect(q4Row).toMatchObject({ status: 'active', endedReason: null, warning: null, formerMembers: 1 })
    expect(q4Row.members).toEqual([
      { displayName: 'Sam', email: 'sam@example.com', timezone: NY, joinedAt: expect.any(Number), lastActedAt: Date.UTC(2026, 9, 22, 10, 0), isCreator: true },
    ])
    expect(rows.find((r) => r.name === 'Thesis sprint')!.members.map((m) => m.email)).toEqual(['kin@example.com', 'ana@example.com'])
  })
})

describe('deleting an ended challenge', () => {
  test('the creator deletes an ended one for good; a running one, a partner and a stranger are refused', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, ana, q4, thesis } = await twoChallenges(t)
    await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', challengeId: q4, summary: emptySummary() })

    expect((await refusal(kin.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 }))).message).toMatch(/end the challenge/i)
    // Ended by hand: the creator leaving no longer ends a challenge with others in it (2026-11-11).
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId: q4 })
    expect((await refusal(sam.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 }))).message).toMatch(/creator or an admin/i)
    expect((await refusal(ana.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 }))).message).toMatch(/creator or an admin/i)

    await kin.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 })
    const left = await t.run(async (ctx) => ({
      challenges: await ctx.db.query('challenges').collect(),
      members: await ctx.db.query('challengeMembers').collect(),
      days: await ctx.db.query('challengeDays').collect(),
    }))
    expect(left.challenges.map((c) => c._id)).toEqual([thesis])
    expect(left.members.every((m) => m.challengeId === thesis)).toBe(true)
    expect(left.days.every((d) => d.challengeId === thesis)).toBe(true)
    expect(await sam.as.query(api.challenges.myChallenges, {})).toHaveLength(0)
    expect((await kin.as.query(api.challenges.myChallenges, {})).map((e) => e.challenge.name)).toEqual(['Thesis sprint'])
    expect((await refusal(kin.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 }))).message).toMatch(/no longer exists/i)
  })

  test('an admin may delete any ended challenge; a plain user may not', async () => {
    const t = convexTest(schema, modules)
    const { sam, q4 } = await twoChallenges(t)
    const admin = await signUp(t, 'root@example.com')
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId: q4 })
    process.env.ADMIN_EMAILS = 'root@example.com'
    await expect(sam.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 })).rejects.toThrow()
    await admin.as.mutation(api.challenges.deleteChallenge, { challengeId: q4 })
    expect(await t.run(async (ctx) => ctx.db.get(q4))).toBeNull()
  })
})
