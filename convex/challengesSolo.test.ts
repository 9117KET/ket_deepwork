/**
 * convex/challengesSolo.test.ts
 *
 * A challenge made for one person. `solo: true` is stored on create, read as
 * `solo` in every view, and cleared the moment a partner accepts an invite.
 * Everything else runs as for any one-member challenge.
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { emptySummary } from './_shared/challengeValidators'

const modules = import.meta.glob('./**/*.*s')

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'
const TODAY = '2026-10-22'

const setup = {
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  goals: [],
  donts: [],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
  timezone: BERLIN,
  displayName: 'Kin',
}

type T = ReturnType<typeof convexTest>

async function signUp(t: T, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}
type User = Awaited<ReturnType<typeof signUp>>

async function start(owner: User, name: string, solo?: boolean): Promise<Id<'challenges'>> {
  const args = solo === undefined ? { ...setup, name } : { ...setup, name, solo }
  const { challengeId } = await owner.as.mutation(api.challenges.createChallenge, args)
  return challengeId
}

async function join(owner: User, guest: User, challengeId: Id<'challenges'>, displayName: string) {
  const { token } = await owner.as.mutation(api.challenges.createInvite, { challengeId })
  await guest.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName })
}

async function stored(t: T, challengeId: Id<'challenges'>) {
  return await t.run(async (ctx) => ctx.db.get(challengeId))
}

/** `solo` as myChallenges, dayCards, todayCards and history each report it. */
async function views(user: User, challengeId: Id<'challenges'>) {
  const mine = await user.as.query(api.challenges.myChallenges, {})
  const day = await user.as.query(api.challenges.dayCards, { challengeId, myDate: TODAY, partnerDate: TODAY })
  const today = await user.as.query(api.challenges.todayCards, { myDate: TODAY, cards: [{ challengeId, partnerDate: TODAY }] })
  const hist = await user.as.query(api.challenges.history, { challengeId, toDate: '2026-10-21' })
  return {
    myChallenges: mine.find((e) => e.challenge.id === challengeId)?.challenge.solo,
    dayCards: day?.challenge.solo,
    todayCards: today.find((c) => c.challengeId === challengeId)?.challenge.solo,
    history: hist?.challenge.solo,
  }
}

const all = (solo: boolean) => ({ myChallenges: solo, dayCards: solo, todayCards: solo, history: solo })

async function refusal(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ConvexError)
    return (e as ConvexError<{ code: string; message: string }>).data
  }
  throw new Error('expected a refusal')
}

// 12:00 Berlin, 06:00 New York: 22 Oct for both.
beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.ADMIN_EMAILS
})

describe('creating', () => {
  test('solo: true is stored and every view says so', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const id = await start(kin, 'Just me', true)
    expect((await stored(t, id))!.solo).toBe(true)
    expect(await views(kin, id)).toEqual(all(true))
  })

  test('without solo, or with solo: false, nothing is stored and every view says false', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const plain = await start(kin, 'Plain')
    const explicit = await start(kin, 'Explicit', false)
    expect((await stored(t, plain))!.solo).toBeUndefined()
    expect((await stored(t, explicit))!.solo).toBeUndefined()
    expect(await views(kin, plain)).toEqual(all(false))
    expect(await views(kin, explicit)).toEqual(all(false))
  })

  test('a row written before the field existed reads as two-person', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const id = await start(kin, 'Old', true)
    // Strip the field, as on every row created before this change.
    await t.run(async (ctx) => ctx.db.patch(id, { solo: undefined }))
    expect((await stored(t, id))!.solo).toBeUndefined()
    expect(await views(kin, id)).toEqual(all(false))
  })
})

describe('a partner joins', () => {
  test('an invite still works, and accepting it clears solo for both', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const sam = await signUp(t, 'sam@example.com')
    const id = await start(kin, 'Just me', true)

    const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId: id })
    expect(token).toEqual(expect.any(String))
    await sam.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })

    expect((await stored(t, id))!.solo).toBe(false)
    expect(await views(kin, id)).toEqual(all(false))
    expect(await views(sam, id)).toEqual(all(false))
    const kinSees = await kin.as.query(api.challenges.myChallenges, {})
    expect(kinSees[0]!.partner?.displayName).toBe('Sam')
  })

  // Rewritten for groups (2026-11-11): a third person may join, but only with a link of their own.
  test('a third person cannot use a spent link, and joins with a fresh one', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const sam = await signUp(t, 'sam@example.com')
    const ana = await signUp(t, 'ana@example.com')
    const id = await start(kin, 'Just me', true)
    const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId: id })
    await sam.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })

    expect((await refusal(ana.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Ana' }))).message).toBe(
      'This invite has already been used',
    )
    expect(await ana.as.query(api.challenges.myChallenges, {})).toHaveLength(0)
    const fresh = await kin.as.mutation(api.challenges.createInvite, { challengeId: id })
    await ana.as.mutation(api.challenges.acceptInvite, { token: fresh.token, timezone: NY, displayName: 'Ana' })
    expect((await stored(t, id))!.solo).toBe(false)
    expect((await ana.as.query(api.challenges.myChallenges, {}))[0]!.others.map((o) => o.displayName)).toEqual(['Kin', 'Sam'])
  })
})

describe('running alone', () => {
  test('lock in, check in, leave (allLeft), then delete', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const id = await start(kin, 'Just me', true)

    await kin.as.mutation(api.challenges.lockInPlan, { date: TODAY, summary: emptySummary() })
    await kin.as.mutation(api.challenges.checkIn, { challengeId: id, date: TODAY, summary: emptySummary(), note: 'Fine', dontsBroken: [] })
    const day = await kin.as.query(api.challenges.dayCards, { challengeId: id, myDate: TODAY, partnerDate: TODAY })
    expect(day!.mine).toMatchObject({ planSetAt: expect.any(Number), checkinAt: expect.any(Number) })
    expect(day!.partner).toBeNull()

    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId: id })
    const ended = await stored(t, id)
    expect(ended).toMatchObject({ status: 'ended', endedReason: 'allLeft', solo: true })

    await kin.as.mutation(api.challenges.deleteChallenge, { challengeId: id })
    expect(await stored(t, id)).toBeNull()
  })

  test('nudgePartner says nobody has joined', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const id = await start(kin, 'Just me', true)
    expect((await refusal(kin.as.mutation(api.challenges.nudgePartner, { challengeId: id }))).message).toBe('Nobody has joined yet')
  })
})

describe('admin and privacy', () => {
  test('adminListChallenges rows carry solo', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const sam = await signUp(t, 'sam@example.com')
    await start(kin, 'Just me', true)
    const pair = await start(kin, 'Pair')
    await join(kin, sam, pair, 'Sam')
    const joined = await start(kin, 'Was solo', true)
    await join(kin, sam, joined, 'Sam')

    process.env.ADMIN_EMAILS = 'kin@example.com'
    const rows = await kin.as.query(api.challenges.adminListChallenges, {})
    const solo = Object.fromEntries(rows.map((r) => [r.name, r.solo]))
    expect(solo).toEqual({ 'Just me': true, Pair: false, 'Was solo': false })
  })

  test('no view carries a user id', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'kin@example.com')
    const sam = await signUp(t, 'sam@example.com')
    const id = await start(kin, 'Just me', true)
    const kinJson = JSON.stringify(await kin.as.query(api.challenges.myChallenges, {}))
    expect(kinJson).not.toContain(kin.id)
    expect(kinJson).not.toContain('@example.com')

    await join(kin, sam, id, 'Sam')
    for (const [user, other] of [[kin, sam], [sam, kin]] as const) {
      const json = JSON.stringify([
        await user.as.query(api.challenges.myChallenges, {}),
        await user.as.query(api.challenges.dayCards, { challengeId: id, myDate: TODAY, partnerDate: TODAY }),
        await user.as.query(api.challenges.todayCards, { myDate: TODAY, cards: [{ challengeId: id, partnerDate: TODAY }] }),
        await user.as.query(api.challenges.history, { challengeId: id, toDate: '2026-10-21' }),
      ])
      expect(json).not.toContain(other.id)
      expect(json).not.toContain('@example.com')
    }
  })
})
