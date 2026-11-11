/**
 * convex/challengeReopen.test.ts
 *
 * Reopening an ended challenge (2026-11-11): only the creator, only an ended
 * one, with every member row and every day row exactly as it was; a new end
 * date when the old one has passed; the closed stretch recorded and counted
 * against nobody; one email to each other member.
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
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
  goals: ['Ship it'],
  donts: ['No doomscrolling'],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

type T = ReturnType<typeof convexTest>
type User = { id: Id<'users'>; email: string; as: ReturnType<T['withIdentity']> }

async function signUp(t: T, name: string): Promise<User> {
  const email = `${name.toLowerCase()}@example.com`
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, email, as: t.withIdentity({ subject: `${id}|s1` }) }
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

/** Kin (Berlin, creator), then Sam (New York) and any others (Berlin), each through a fresh invite. */
async function group(t: T, others: string[] = ['Sam'], over: Partial<typeof setup> = {}) {
  const kin = await signUp(t, 'Kin')
  const { challengeId } = await kin.as.mutation(api.challenges.createChallenge, { ...setup, ...over, timezone: BERLIN, displayName: 'Kin' })
  const users = [kin]
  for (const name of others) {
    const u = await signUp(t, name)
    const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId })
    await u.as.mutation(api.challenges.acceptInvite, { token, timezone: name === 'Sam' ? NY : BERLIN, displayName: name })
    users.push(u)
  }
  return { users, challengeId }
}

const challengeRow = async (t: T, id: Id<'challenges'>) => (await t.run(async (ctx) => ctx.db.get(id)))!
const snapshot = (t: T) =>
  t.run(async (ctx) => ({
    members: await ctx.db.query('challengeMembers').collect(),
    days: await ctx.db.query('challengeDays').collect(),
  }))
const scheduledMails = (t: T) =>
  t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect()).map((f) => f.args[0] as { to: string; subject: string; text: string }))

beforeEach(() => {
  // 22 Oct, 12:00 Berlin, 06:00 New York.
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = 'https://ket-deepwork.vercel.app'
  sendMail.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.EMAIL_DELIVERY
})

// ─── 16: every way a challenge ends ───────────────────────────────────────────

describe('reopening keeps everything', () => {
  const endings: Array<[string, (t: T, ids: { challengeId: Id<'challenges'>; users: User[] }) => Promise<string | undefined>]> = [
    [
      'inactive',
      async (t, { challengeId, users }) => {
        await t.run(async (ctx) =>
          ctx.db.patch(challengeId, {
            status: 'ended',
            endedReason: 'inactive',
            endedAt: Date.now(),
            warning: { userId: users[1]!.id, missedSince: '2026-10-18', issuedAt: 1 },
          }),
        )
        return undefined
      },
    ],
    [
      'seasonOver',
      async (t, { challengeId }) => {
        await t.run(async (ctx) => ctx.db.patch(challengeId, { endDate: '2026-10-23' }))
        await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-24', '12:00', BERLIN) })
        vi.setSystemTime(at('2026-10-24', '12:30', BERLIN))
        return '2026-12-31'
      },
    ],
    [
      'allLeft',
      async (_t, { challengeId, users }) => {
        await users[1]!.as.mutation(api.challenges.leaveChallenge, { challengeId })
        await users[0]!.as.mutation(api.challenges.leaveChallenge, { challengeId })
        return undefined
      },
    ],
    [
      'manual',
      async (t, { challengeId }) => {
        await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
        return undefined
      },
    ],
    [
      'creatorLeft',
      async (t, { challengeId }) => {
        await t.run(async (ctx) => ctx.db.patch(challengeId, { status: 'ended', endedReason: 'creatorLeft', endedAt: Date.now() }))
        return undefined
      },
    ],
  ]

  for (const [reason, end] of endings) {
    test(`a challenge that ended ${reason} is active again; every member and day row is exactly as it was`, async () => {
      const t = convexTest(schema, modules)
      const { users, challengeId } = await group(t)
      const [kin, sam] = users as [User, User]
      await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
      await sam.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: emptySummary(), note: 'Done', dontsBroken: [] })
      const endDate = await end(t, { challengeId, users })
      const ended = await challengeRow(t, challengeId)
      expect(ended).toMatchObject({ status: 'ended', endedReason: reason })

      const before = await snapshot(t)
      expect(await kin.as.mutation(api.challenges.reopenChallenge, { challengeId, ...(endDate ? { endDate } : {}) })).toBeNull()
      const after = await snapshot(t)
      expect(after).toEqual(before)
      const row = await challengeRow(t, challengeId)
      expect(row.status).toBe('active')
      expect(row.endedReason).toBeUndefined()
      expect(row.endedAt).toBeUndefined()
      expect(row.warning).toBeUndefined()
      expect((await kin.as.query(api.challenges.myChallenges, {}))[0]!.challenge).toMatchObject({
        status: 'active',
        endedReason: null,
        endedAt: null,
        warning: null,
        reopenedDate: expect.any(String),
      })
    })
  }

  test('after an allLeft reopen, a member who left stays former until invited back', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t)
    const [kin, sam] = users as [User, User]
    await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId })
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId })
    expect(await sam.as.query(api.challenges.myChallenges, {})).toEqual([])
    expect((await kin.as.query(api.challenges.myChallenges, {}))[0]!.others).toEqual([])
  })
})

// ─── 17, 18: who may, and the end date ────────────────────────────────────────

describe('who may reopen', () => {
  test('a non-creator, a running challenge and a creator at twenty active challenges are refused', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t)
    const [kin, sam] = users as [User, User]
    expect(await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId }))).toEqual({
      code: 'challenge',
      message: 'This challenge is already running',
    })
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    expect(await refusal(sam.as.mutation(api.challenges.reopenChallenge, { challengeId }))).toEqual({
      code: 'challenge',
      message: 'Only the creator can reopen a challenge',
    })
    const stranger = await signUp(t, 'Zed')
    expect((await refusal(stranger.as.mutation(api.challenges.reopenChallenge, { challengeId }))).message).toBe('You are not in this challenge')
    for (let i = 1; i <= 20; i++) {
      await kin.as.mutation(api.challenges.createChallenge, { ...setup, name: `Season ${i}`, timezone: BERLIN, displayName: 'Kin' })
    }
    expect(await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId }))).toEqual({
      code: 'challenge',
      message: 'You are in 20 challenges already',
    })
    expect((await challengeRow(t, challengeId)).status).toBe('ended')
  })

  test('a challenge deleted while ended cannot be reopened', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t)
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    await users[0]!.as.mutation(api.challenges.deleteChallenge, { challengeId })
    expect((await refusal(users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId }))).message).toBe('This challenge no longer exists')
  })
})

describe('the end date of a reopen', () => {
  test('a passed end needs a new one (needsEndDate); a valid one is stored; at most 366 days from the reopen day', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam'], { startDate: '2026-01-01', endDate: '2026-10-25' })
    const kin = users[0]!
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    vi.setSystemTime(at('2026-11-01', '12:00', BERLIN))

    expect(await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId }))).toEqual({
      code: 'needsEndDate',
      message: 'Pick an end date from today on',
    })
    expect((await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '2026-10-31' }))).code).toBe('needsEndDate')
    // 1 Nov 2026 to 2 Nov 2027 is 367 days, inclusive.
    expect(await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '2027-11-02' }))).toEqual({
      code: 'challenge',
      message: 'A season runs at most 366 days from today',
    })
    expect((await refusal(kin.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '15 Dec' }))).message).toBe('endDate must be YYYY-MM-DD')
    expect((await challengeRow(t, challengeId)).status).toBe('ended')

    // The original start (1 Jan 2026) is 546 days before this end; only the reopen day counts.
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '2027-06-30' })
    expect(await challengeRow(t, challengeId)).toMatchObject({ status: 'active', startDate: '2026-01-01', endDate: '2027-06-30' })
  })

  test('the end is judged on every active member\'s clock', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam'], { endDate: '2026-10-31' })
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    // 23:30 New York on 31 Oct is 04:30 on 1 Nov in Berlin: the old end is still today for Sam, already past for Kin.
    vi.setSystemTime(at('2026-10-31', '23:30', NY))
    expect((await refusal(users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId }))).code).toBe('needsEndDate')
    await users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '2026-11-01' })
    expect((await challengeRow(t, challengeId)).endDate).toBe('2026-11-01')
  })
})

// ─── Fix round 2: updateSpan measures a reopened season from its reopen day ──

describe('editing the dates of a reopened season', () => {
  test('the 366-day cap runs from the reopen day: past a year from the start is fine, past a year from the reopen is refused', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam'], { startDate: '2026-01-01', endDate: '2026-10-25' })
    const kin = users[0]!
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    vi.setSystemTime(at('2026-11-01', '12:00', BERLIN))
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId, endDate: '2027-06-30' })

    // 1 Jan 2026 to 31 Jul 2027 is 577 days, but only 273 from the reopen on 1 Nov 2026: the end and a deadline can be edited.
    expect(
      await kin.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-01-01', endDate: '2027-07-31', checkinDeadline: '22:00' }),
    ).toMatchObject({ startDate: '2026-01-01', endDate: '2027-07-31', checkinDeadline: '22:00' })
    // 1 Nov 2026 to 1 Nov 2027 is 366 days, inclusive: allowed; one more is not.
    await kin.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-01-01', endDate: '2027-11-01' })
    expect(await refusal(kin.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-01-01', endDate: '2027-11-02' }))).toEqual({
      code: 'challenge',
      message: 'A season runs at most 366 days from the day it was reopened',
    })
    expect((await challengeRow(t, challengeId)).endDate).toBe('2027-11-01')
  })

  test('a never-reopened challenge keeps the cap from its start', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam'], { startDate: '2026-01-01', endDate: '2026-12-31' })
    expect(await refusal(users[0]!.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-01-01', endDate: '2027-01-02' }))).toEqual({
      code: 'challenge',
      message: 'A challenge can run for at most a year',
    })
    // 1 Jan 2026 to 1 Jan 2027 is 366 days, inclusive.
    await users[0]!.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-01-01', endDate: '2027-01-01' })
    expect((await challengeRow(t, challengeId)).endDate).toBe('2027-01-01')
  })
})

// ─── 19, 20: the closed stretch counts for nobody ─────────────────────────────

describe('after a reopen', () => {
  test('the sweep at once and on the next three days neither warns nor closes; a full quiet run after the reopen day warns', async () => {
    const t = convexTest(schema, modules)
    vi.setSystemTime(at('2026-10-18', '12:00', BERLIN))
    const { users, challengeId } = await group(t)
    const [kin] = users as [User, User]
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })

    // Three weeks closed with no row at all, then a reopen on 10 Nov.
    vi.setSystemTime(at('2026-11-10', '12:00', BERLIN))
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId })
    const sweep = (nowMs: number) => t.mutation(internal.challengesInternal.claimDueReminders, { nowMs })
    const kinds = (due: Array<{ kind: string }>) => due.map((d) => d.kind).filter((k) => k !== 'plan' && k !== 'checkin')

    expect(kinds(await sweep(at('2026-11-10', '12:15', BERLIN)))).toEqual([])
    for (const date of ['2026-11-11', '2026-11-12', '2026-11-13']) {
      expect(kinds(await sweep(at(date, '08:00', NY)))).toEqual([])
      const row = await challengeRow(t, challengeId)
      expect(row.status).toBe('active')
      expect(row.warning).toBeUndefined()
    }
    // 11, 12 and 13 Nov are three full quiet days after the reopen day: the usual warning.
    expect(kinds(await sweep(at('2026-11-14', '08:00', NY)))).toEqual(['warning', 'warning'])
    expect((await challengeRow(t, challengeId)).warning).toBeDefined()
  })

  test('closedSpans records the stretch; a reopen the day it ended records none; challengeView returns both fields', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t)
    const [kin, sam] = users as [User, User]
    // Kin locked in on the 22nd, the day it ended: that day was lived.
    await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    vi.setSystemTime(at('2026-11-10', '12:00', BERLIN))
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId })
    expect(await challengeRow(t, challengeId)).toMatchObject({
      reopenedDate: '2026-11-10',
      reopenedAt: at('2026-11-10', '12:00', BERLIN),
      closedSpans: [{ from: '2026-10-23', to: '2026-11-09' }],
    })
    const view = (await sam.as.query(api.challenges.myChallenges, {}))[0]!.challenge
    expect(view).toMatchObject({ reopenedDate: '2026-11-10', closedSpans: [{ from: '2026-10-23', to: '2026-11-09' }] })

    // Ended and reopened the same day: no new span.
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    vi.setSystemTime(at('2026-11-10', '18:00', BERLIN))
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId })
    expect((await challengeRow(t, challengeId)).closedSpans).toEqual([{ from: '2026-10-23', to: '2026-11-09' }])

    // An end day nobody acted on is part of the span.
    vi.setSystemTime(at('2026-11-12', '12:00', BERLIN))
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    vi.setSystemTime(at('2026-11-15', '12:00', BERLIN))
    await kin.as.mutation(api.challenges.reopenChallenge, { challengeId })
    expect((await challengeRow(t, challengeId)).closedSpans).toEqual([
      { from: '2026-10-23', to: '2026-11-09' },
      { from: '2026-11-12', to: '2026-11-14' },
    ])
    // A never-reopened challenge reads as null and empty.
    const fresh = await group(convexTest(schema, modules))
    expect((await fresh.users[0]!.as.query(api.challenges.myChallenges, {}))[0]!.challenge).toMatchObject({ reopenedDate: null, closedSpans: [] })
  })
})

// ─── 21: the running-again email ──────────────────────────────────────────────

describe('telling the others', () => {
  test('every other active member gets one email, the reopener none', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam', 'Ana'])
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    await users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId })
    const mails = await scheduledMails(t)
    expect(mails.map((m) => m.to).sort()).toEqual(['ana@example.com', 'sam@example.com'])
    expect(mails.every((m) => m.subject === 'Q4 push is running again')).toBe(true)
    expect(mails[0]!.text).toContain(`https://ket-deepwork.vercel.app/challenge/${challengeId}`)
  })

  test('with EMAIL_DELIVERY=off, nothing is sent', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0) })
    process.env.EMAIL_DELIVERY = 'off'
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Sam', 'Ana'])
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    await users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId })
    sendMail.mockClear()
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).not.toHaveBeenCalled()
    delete process.env.EMAIL_DELIVERY
    // The same reopen with delivery on does send, so the test above is not vacuous.
    await t.mutation(internal.challengesInternal.endChallenge, { challengeId })
    await users[0]!.as.mutation(api.challenges.reopenChallenge, { challengeId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).toHaveBeenCalledTimes(2)
  })
})
