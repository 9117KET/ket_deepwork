/**
 * convex/challengeCommitments.test.ts
 *
 * Per-member goals and don'ts: each member owns their lists, the partner can
 * read them, a removed don't is archived so old confessions still resolve,
 * and challenges created before this change hand their lists to the creator.
 * Run with: npm run test:convex
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
  goals: ['Ship the thesis draft'],
  donts: ['No doomscrolling', 'No alcohol'],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

type T = ReturnType<typeof convexTest>

async function signUp(t: T, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

async function create(t: T) {
  const a = await signUp(t, 'a@example.com')
  await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, {})
  return { a, token }
}

async function pair(t: T, joinLists: { goals?: string[]; donts?: string[] } = {}) {
  const { a, token } = await create(t)
  const b = await signUp(t, 'b@example.com')
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam', ...joinLists })
  return { a, b, token }
}

const me = async (u: { as: ReturnType<T['withIdentity']> }) => (await u.as.query(api.challenges.myChallenge, {}))!

describe('where the lists live', () => {
  test('the creator owns the lists; the challenge view carries none', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const view = await me(a)
    expect(view.challenge).not.toHaveProperty('goals')
    expect(view.challenge).not.toHaveProperty('donts')
    expect(view.me.goals).toEqual(['Ship the thesis draft'])
    expect(view.me.donts.map((d) => d.text)).toEqual(['No doomscrolling', 'No alcohol'])
    const row = await t.run(async (ctx) => (await ctx.db.query('challenges').collect())[0]!)
    expect(row.goals).toEqual([])
    expect(row.donts).toEqual([])
  })

  test('an invitee who brings no lists starts empty', async () => {
    const t = convexTest(schema, modules)
    const { b } = await pair(t)
    expect((await me(b)).me).toMatchObject({ goals: [], donts: [] })
  })

  test('acceptInvite stores the joiner\'s own lists, cleaned, with fresh ids', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t, { goals: ['Run 3x a week', '  '], donts: [' No sugar '] })
    const view = await me(b)
    expect(view.me.goals).toEqual(['Run 3x a week'])
    expect(view.me.donts).toEqual([{ id: expect.stringMatching(/^dont-/), text: 'No sugar' }])
    // The partner sees them, read-only.
    expect((await me(a)).partner).toMatchObject({ displayName: 'Sam', goals: ['Run 3x a week'], donts: [{ text: 'No sugar' }] })
    expect((await me(b)).partner?.goals).toEqual(['Ship the thesis draft'])
  })

  test('legacy: lists on the challenge row resolve to the creator, never to the invitee', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    // Recreate the shape stored before per-member lists: lists on the challenge, none on members.
    await t.run(async (ctx) => {
      const challenge = (await ctx.db.query('challenges').collect())[0]!
      await ctx.db.patch(challenge._id, { goals: ['Old goal'], donts: [{ id: 'dont-1-1', text: 'Old dont' }] })
      for (const m of await ctx.db.query('challengeMembers').collect()) {
        await ctx.db.patch(m._id, { goals: undefined, donts: undefined, commitmentsUpdatedAt: undefined })
      }
    })
    expect((await me(a)).me).toMatchObject({ goals: ['Old goal'], donts: [{ id: 'dont-1-1', text: 'Old dont' }] })
    expect((await me(b)).me).toMatchObject({ goals: [], donts: [] })
    expect((await me(b)).partner?.donts).toEqual([{ id: 'dont-1-1', text: 'Old dont' }])
    // A legacy confession still checks in, and the first edit moves the lists onto the member.
    await a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: emptySummary(), dontsBroken: ['dont-1-1'] })
    await a.as.mutation(api.challenges.updateMyCommitments, { goals: ['Old goal'], donts: [{ id: 'dont-1-1', text: 'Old dont, reworded' }] })
    expect((await me(a)).me.donts).toEqual([{ id: 'dont-1-1', text: 'Old dont, reworded' }])
  })
})

describe('updateMyCommitments', () => {
  test('keeps ids through text edits, archives removed don\'ts, mints new ids', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const [first, second] = (await me(a)).me.donts
    const result = await a.as.mutation(api.challenges.updateMyCommitments, {
      goals: ['New goal', ' '],
      donts: [{ id: first!.id, text: 'No doomscrolling after 22:00' }, { text: 'No snooze' }],
    })
    expect(result.goals).toEqual(['New goal'])
    const view = (await me(a)).me
    expect(view.goals).toEqual(['New goal'])
    expect(view.donts).toHaveLength(3)
    expect(view.donts[0]).toEqual({ id: first!.id, text: 'No doomscrolling after 22:00' })
    expect(view.donts[1]).toMatchObject({ text: 'No snooze' })
    expect(view.donts[1]!.archivedAt).toBeUndefined()
    expect([first!.id, second!.id]).not.toContain(view.donts[1]!.id)
    // Removed, not deleted: the id and text stay, flagged.
    expect(view.donts[2]).toEqual({ id: second!.id, text: 'No alcohol', archivedAt: expect.any(Number) })
    const row = await t.run(async (ctx) => (await ctx.db.query('challengeMembers').collect()).find((m) => m.displayName === 'Kin')!)
    expect(row.commitmentsUpdatedAt).toEqual(expect.any(Number))
  })

  test('an archived don\'t stays archived and does not count against the cap', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [] })
    const archived = (await me(a)).me.donts
    expect(archived.every((d) => d.archivedAt !== undefined)).toBe(true)
    const ten = Array.from({ length: 10 }, (_, i) => ({ text: `Dont ${i + 1}` }))
    await a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: ten })
    const view = (await me(a)).me.donts
    expect(view.filter((d) => d.archivedAt === undefined)).toHaveLength(10)
    expect(view.filter((d) => d.archivedAt !== undefined).map((d) => d.id)).toEqual(archived.map((d) => d.id))
    expect(new Set(view.map((d) => d.id)).size).toBe(view.length)
    // An archived id cannot be sent back as active: un-archiving is not a thing.
    await expect(
      a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [{ id: archived[0]!.id, text: 'Back' }] }),
    ).rejects.toThrow(/unknown don't/i)
  })

  test('rejects unknown ids, including the partner\'s', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t, { donts: ['No sugar'] })
    await expect(a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [{ id: 'made-up', text: 'x' }] })).rejects.toThrow(/unknown don't/i)
    const sams = (await me(b)).me.donts[0]!.id
    await expect(a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [{ id: sams, text: 'Hijack' }] })).rejects.toThrow(/unknown don't/i)
    expect((await me(b)).me.donts).toEqual([{ id: sams, text: 'No sugar' }])
  })

  test('caps: at most 10 of each, 200 characters an item', async () => {
    const t = convexTest(schema, modules)
    const { a } = await pair(t)
    const eleven = Array.from({ length: 11 }, (_, i) => `Item ${i}`)
    await expect(a.as.mutation(api.challenges.updateMyCommitments, { goals: eleven, donts: [] })).rejects.toThrow(/at most 10 goals/i)
    await expect(
      a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: eleven.map((text) => ({ text })) }),
    ).rejects.toThrow(/at most 10 don'ts/i)
    await expect(
      a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [{ text: 'x'.repeat(201) }] }),
    ).rejects.toThrow(/200 characters/)
    await expect(a.as.mutation(api.challenges.updateMyCommitments, { goals: ['x'.repeat(201)], donts: [] })).rejects.toThrow(/200 characters/)
  })

  test('needs a signed-in member', async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [] })).rejects.toThrow(/not authenticated/i)
    const c = await signUp(t, 'c@example.com')
    await expect(c.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [] })).rejects.toThrow(/not in a challenge/i)
  })
})

describe('checkIn against your own don\'ts', () => {
  test('a partner\'s don\'t is unknown; your own archived one still counts', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t, { donts: ['No sugar'] })
    const kins = (await me(a)).me.donts
    const sams = (await me(b)).me.donts
    await expect(
      a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: emptySummary(), dontsBroken: [sams[0]!.id] }),
    ).rejects.toThrow(/unknown don't/i)
    await a.as.mutation(api.challenges.updateMyCommitments, { goals: [], donts: [{ id: kins[0]!.id, text: kins[0]!.text }] })
    await a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: emptySummary(), dontsBroken: [kins[1]!.id] })
    const seen = await b.as.query(api.challenges.dayCards, { myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner?.dontsBroken).toEqual([kins[1]!.id])
    // The archived don't still resolves to its text through the partner's view.
    const partnerDonts = (await me(b)).partner!.donts
    expect(partnerDonts.find((d) => d.id === kins[1]!.id)).toMatchObject({ text: 'No alcohol', archivedAt: expect.any(Number) })
  })
})

describe('invitePreview', () => {
  test('carries the inviter\'s active goals and don\'t texts, without auth', async () => {
    const t = convexTest(schema, modules)
    const { a, token } = await create(t)
    const [first] = (await me(a)).me.donts
    await a.as.mutation(api.challenges.updateMyCommitments, { goals: ['Ship the thesis draft'], donts: [{ id: first!.id, text: first!.text }] })
    const preview = await t.query(api.challenges.invitePreview, { token })
    expect(preview).toMatchObject({ status: 'ok', inviterName: 'Kin', inviterGoals: ['Ship the thesis draft'], inviterDonts: ['No doomscrolling'] })
  })

  test('full carries them too; used and unknown carry none', async () => {
    const t = convexTest(schema, modules)
    const { token } = await pair(t)
    const used = await t.query(api.challenges.invitePreview, { token })
    expect(used).toMatchObject({ status: 'used', inviterGoals: [], inviterDonts: [] })
    const missing = await t.query(api.challenges.invitePreview, { token: 'nope' })
    expect(missing).toMatchObject({ status: 'notFound', inviterGoals: [], inviterDonts: [] })
    // A second, still-open invite on a full challenge.
    await t.run(async (ctx) => {
      const challenge = (await ctx.db.query('challenges').collect())[0]!
      await ctx.db.insert('challengeInvites', { challengeId: challenge._id, token: 'second', createdBy: challenge.createdBy, expiresAt: Date.now() + 60_000 })
    })
    const full = await t.query(api.challenges.invitePreview, { token: 'second' })
    expect(full).toMatchObject({ status: 'full', inviterGoals: ['Ship the thesis draft'], inviterDonts: ['No doomscrolling', 'No alcohol'] })
  })
})
