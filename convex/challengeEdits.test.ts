/**
 * convex/challengeEdits.test.ts
 *
 * Editing a running season (spec 03, 7 Nov 2026): the creator corrects the
 * dates without losing a recorded day; goals carry ids like don'ts, with
 * legacy string goals read as `goal-legacy-<i>`; a member marks the day's
 * kept goals and broken don'ts any time (`markDay`), which is not an act;
 * the summary may carry planned and done minutes.
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

// 22 Oct, 12:00 Berlin (06:00 New York): both members are on the 22nd.
beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = 'https://ket-deepwork.vercel.app'
  sendMail.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

const setup = {
  name: 'Q4 push',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  goals: ['Ship the thesis draft', 'Run 3x a week'],
  donts: ['No doomscrolling', 'No alcohol'],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

type T = ReturnType<typeof convexTest>
type User = { id: Id<'users'>; as: ReturnType<T['withIdentity']> }

async function signUp(t: T, email: string): Promise<User> {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

async function pair(t: T, joinLists: { goals?: string[]; donts?: string[] } = {}) {
  const a = await signUp(t, 'a@example.com')
  const b = await signUp(t, 'b@example.com')
  const { challengeId } = await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, { challengeId })
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam', ...joinLists })
  return { a, b, challengeId }
}

const summary = (over: Partial<ReturnType<typeof emptySummary>> = {}) => ({ ...emptySummary(), ...over })

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ConvexError)
    return (e as ConvexError<{ code: string; message: string }>).data.message
  }
  throw new Error('expected a refusal')
}

const me = async (u: User) => (await u.as.query(api.challenges.myChallenges, {}))[0]!

const allDays = (t: T) => t.run(async (ctx) => ctx.db.query('challengeDays').collect())

const dayRow = async (t: T, userId: string, date: string) => (await allDays(t)).find((r) => r.userId === userId && r.date === date)

const memberRow = async (t: T, userId: string) =>
  (await t.run(async (ctx) => ctx.db.query('challengeMembers').collect())).find((m) => m.userId === userId)!

const span = (challengeId: Id<'challenges'>, over: Record<string, string> = {}) => ({
  challengeId,
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  ...over,
})

// ─── updateSpan ───────────────────────────────────────────────────────────────

describe('updateSpan: who may', () => {
  test('only the creator, only while it runs, only a member', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    const c = await signUp(t, 'c@example.com')
    expect(await refusal(b.as.mutation(api.challenges.updateSpan, span(challengeId)))).toBe('Only the creator can change the dates')
    expect(await refusal(c.as.mutation(api.challenges.updateSpan, span(challengeId)))).toBe('You are not in this challenge')
    await t.run(async (ctx) => ctx.db.patch(challengeId, { status: 'ended', endedReason: 'manual', endedAt: Date.now() }))
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId)))).toBe('This challenge has ended')
  })
})

describe('updateSpan: the rules', () => {
  test('the end cannot move before today, the start not past the first record, the span and deadlines as in create', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    // Sam: an unstamped summary row on the 5th (not a record), a lock-in on the 24th.
    await t.run(async (ctx) => {
      const base = { challengeId, userId: b.id as string, summaryUpdatedAt: 0, dontsBroken: [], remindersSent: { plan: 0, checkin: 0 } }
      await ctx.db.insert('challengeDays', { ...base, date: '2026-10-05', summary: emptySummary() })
      await ctx.db.insert('challengeDays', { ...base, date: '2026-10-24', summary: emptySummary(), planSetAt: 1 })
    })

    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { endDate: '2026-10-21' })))).toBe(
      "The end date can't be before today",
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '2026-10-25' })))).toBe(
      "The start can't move past 24 Oct, when the first lock-in, check-in or mark was recorded",
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '2026-10-01', endDate: '2027-10-02' })))).toBe(
      'A challenge can run for at most a year',
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, { ...span(challengeId), planDeadline: '22:00' }))).toBe(
      'The plan deadline must be before 21:30',
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, { ...span(challengeId), checkinDeadline: '21:00' }))).toBe(
      'The check-in deadline must be after 21:30',
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '2026-11-02', endDate: '2026-11-01' })))).toBe(
      'The challenge must end on or after it starts',
    )
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '1 Oct' })))).toBe('startDate must be YYYY-MM-DD')

    // The same sentences as createChallenge, from the one shared helper.
    expect(
      await refusal(a.as.mutation(api.challenges.createChallenge, { ...setup, planDeadline: '22:00', timezone: BERLIN, displayName: 'Kin' })),
    ).toBe('The plan deadline must be before 21:30')

    // Up to the first record itself is fine, and today as the end is fine.
    await expect(a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '2026-10-24' }))).resolves.toMatchObject({
      startDate: '2026-10-24',
    })
    const view = await a.as.mutation(api.challenges.updateSpan, span(challengeId, { startDate: '2026-10-20', endDate: '2026-10-22' }))
    expect(view).toMatchObject({ startDate: '2026-10-20', endDate: '2026-10-22', status: 'active' })
  })

  test('the end is judged on every member\'s clock', async () => {
    const t = convexTest(schema, modules)
    // 23:00 UTC on the 21st: 01:00 on the 22nd in Berlin (creator), 19:00 on the 21st in New York.
    vi.setSystemTime(Date.UTC(2026, 9, 21, 23, 0))
    const { a, challengeId } = await pair(t)
    expect(await refusal(a.as.mutation(api.challenges.updateSpan, span(challengeId, { endDate: '2026-10-21' })))).toBe(
      "The end date can't be before today",
    )
    await expect(a.as.mutation(api.challenges.updateSpan, span(challengeId, { endDate: '2026-10-22' }))).resolves.toMatchObject({
      endDate: '2026-10-22',
    })
  })
})

describe('updateSpan: a valid edit', () => {
  test('returns the new view, every read reflects it, and no day row changes', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    // Days on record: Kin locks in and checks in today, Sam syncs today, plus Kin's 20th.
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 3 }) })
    const donts = (await me(a)).me.donts
    await a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), note: 'ok', dontsBroken: [donts[0]!.id] })
    await b.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary({ tasksDone: 1 }), timezone: NY })
    await t.run(async (ctx) => {
      await ctx.db.insert('challengeDays', {
        challengeId,
        userId: a.id,
        date: '2026-10-20',
        summary: emptySummary(),
        summaryUpdatedAt: 5,
        checkinAt: 7,
        dontsBroken: [],
        remindersSent: { plan: 2, checkin: 1 },
      })
    })
    const before = await allDays(t)

    const view = await a.as.mutation(api.challenges.updateSpan, {
      challengeId,
      startDate: '2026-09-15',
      endDate: '2027-01-31',
      planDeadline: '09:00',
      checkinDeadline: '23:00',
    })
    expect(view).toMatchObject({
      id: challengeId,
      startDate: '2026-09-15',
      endDate: '2027-01-31',
      planDeadline: '09:00',
      checkinDeadline: '23:00',
      status: 'active',
      isCreator: true,
    })
    for (const u of [a, b]) {
      expect((await me(u)).challenge).toMatchObject({ startDate: '2026-09-15', endDate: '2027-01-31', planDeadline: '09:00', checkinDeadline: '23:00' })
    }
    const hist = await a.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' })
    expect(hist?.challenge).toMatchObject({ startDate: '2026-09-15', endDate: '2027-01-31' })
    expect(hist?.mine.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-22'])
    expect(hist?.partner.map((d) => d.date)).toEqual(['2026-10-22'])

    const after = await allDays(t)
    expect(after).toEqual(before)

    // Deadlines left out stay as they were.
    const again = await a.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-09-16', endDate: '2027-01-31' })
    expect(again).toMatchObject({ startDate: '2026-09-16', planDeadline: '09:00', checkinDeadline: '23:00' })
  })
})

// ─── Goals with ids ───────────────────────────────────────────────────────────

describe('goals with ids', () => {
  test('new lists get ids; legacy strings read as goal-legacy-<i> and survive the first edit', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    expect((await me(a)).me.goalItems).toEqual([
      { id: expect.stringMatching(/^goal-\d+-1$/), text: 'Ship the thesis draft' },
      { id: expect.stringMatching(/^goal-\d+-2$/), text: 'Run 3x a week' },
    ])

    // Sam's row as written before this run: plain strings.
    await t.run(async (ctx) => {
      const sam = await ctx.db
        .query('challengeMembers')
        .withIndex('by_user_challenge', (q) => q.eq('userId', b.id).eq('challengeId', challengeId))
        .unique()
      await ctx.db.patch(sam!._id, { goals: ['Read', 'Run'] })
    })
    const legacy = [
      { id: 'goal-legacy-0', text: 'Read' },
      { id: 'goal-legacy-1', text: 'Run' },
    ]
    expect((await me(b)).me.goalItems).toEqual(legacy)
    expect((await me(a)).partner?.goalItems).toEqual(legacy)
    // `goals` keeps the shape the live client renders: the original strings.
    expect((await me(b)).me.goals).toEqual(['Read', 'Run'])
    expect((await me(a)).partner?.goals).toEqual(['Read', 'Run'])

    expect(await b.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: ['goal-legacy-0'] })).toEqual({
      goalsKept: ['goal-legacy-0'],
      dontsBroken: [],
    })

    const saved = await b.as.mutation(api.challenges.updateMyCommitments, {
      challengeId,
      goals: [{ id: 'goal-legacy-0', text: 'Read daily' }, 'Swim'],
      donts: [],
    })
    expect(saved.goalItems).toEqual([
      { id: 'goal-legacy-0', text: 'Read daily' },
      { id: expect.stringMatching(/^goal-\d+-\d+$/), text: 'Swim' },
      { id: 'goal-legacy-1', text: 'Run', archivedAt: expect.any(Number) },
    ])
    expect(saved.goalItems[1]!.id).not.toMatch(/legacy/)
    // Texts of the active goals only, in both the result and the view.
    expect(saved.goals).toEqual(['Read daily', 'Swim'])
    expect((await me(b)).me.goals).toEqual(['Read daily', 'Swim'])
    // Stored as objects now; the view is the same list.
    expect((await memberRow(t, b.id)).goals).toEqual(saved.goalItems)
    expect((await me(b)).me.goalItems).toEqual(saved.goalItems)

    // The earlier mark still resolves, for Sam and for the partner.
    const seen = await a.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner?.goalsKept).toEqual(['goal-legacy-0'])
    const ids = new Set((await me(b)).me.goalItems.map((g) => g.id))
    expect(seen?.partner?.goalsKept.every((id) => ids.has(id))).toBe(true)

    // An archived goal can still be marked; an id never seen cannot, nor can it be edited.
    await expect(b.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: ['goal-legacy-1'] })).resolves.toBeTruthy()
    expect(await refusal(b.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: ['goal-legacy-5'] }))).toBe('Unknown goal')
    expect(
      await refusal(b.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: [{ id: 'goal-legacy-1', text: 'Back' }], donts: [] })),
    ).toBe('Unknown goal')
  })

  test('goals follow the don\'ts rule: a blank text removes, the cap ignores archived ones', async () => {
    const t = convexTest(schema, modules)
    const { a, challengeId } = await pair(t)
    const [first, second] = (await me(a)).me.goalItems
    const saved = await a.as.mutation(api.challenges.updateMyCommitments, {
      challengeId,
      goals: [{ id: first!.id, text: '  ' }, { id: second!.id, text: 'Run 4x a week' }],
      donts: [],
    })
    expect(saved.goalItems).toEqual([
      { id: second!.id, text: 'Run 4x a week' },
      { ...first!, archivedAt: expect.any(Number) },
    ])
    const ten = Array.from({ length: 10 }, (_, i) => `Goal ${i}`)
    await expect(a.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: ten, donts: [] })).resolves.toBeTruthy()
    expect(await refusal(a.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: [...ten, 'Eleven'], donts: [] }))).toBe(
      'At most 10 goals',
    )
  })

  test('the invite preview still shows the inviter\'s active goal texts', async () => {
    const t = convexTest(schema, modules)
    const a = await signUp(t, 'a@example.com')
    const { challengeId } = await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
    const { token } = await a.as.mutation(api.challenges.createInvite, { challengeId })
    const [first] = (await me(a)).me.goalItems
    await a.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: [first!], donts: [] })
    expect((await t.query(api.challenges.invitePreview, { token })).inviterGoals).toEqual(['Ship the thesis draft'])
  })
})

// ─── markDay ──────────────────────────────────────────────────────────────────

describe('markDay', () => {
  test('writes only the lists given and leaves the rest of the row as it was', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    const { goalItems: goals, donts } = (await me(a)).me
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary({ tasksTotal: 4 }) })
    await a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary({ tasksTotal: 4 }), note: 'Fine', dontsBroken: [donts[0]!.id] })
    const before = (await dayRow(t, a.id, '2026-10-22'))!

    const marked = await a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: [goals[0]!.id, goals[0]!.id] })
    expect(marked).toEqual({ goalsKept: [goals[0]!.id], dontsBroken: [donts[0]!.id] })
    const afterGoals = (await dayRow(t, a.id, '2026-10-22'))!
    expect(afterGoals).toEqual({ ...before, goalsKept: [goals[0]!.id] })

    const second = await a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', dontsBroken: [donts[1]!.id] })
    expect(second).toEqual({ goalsKept: [goals[0]!.id], dontsBroken: [donts[1]!.id] })
    expect((await dayRow(t, a.id, '2026-10-22'))!).toEqual({ ...before, goalsKept: [goals[0]!.id], dontsBroken: [donts[1]!.id] })

    // The partner sees the marks, in both of today's reads.
    const card = await b.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(card?.partner).toMatchObject({ goalsKept: [goals[0]!.id], dontsBroken: [donts[1]!.id] })
    const cards = await b.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] })
    expect(cards[0]?.partner?.goalsKept).toEqual([goals[0]!.id])
    // And my own Today block reads them back.
    const mine = await a.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] })
    expect(mine[0]?.mine?.goalsKept).toEqual([goals[0]!.id])
    // The partner view gains goalsKept and nothing else.
    expect(Object.keys(card!.partner!).sort()).toEqual(
      ['checkinAt', 'date', 'dontsBroken', 'goalsKept', 'note', 'planSetAt', 'summary', 'summaryUpdatedAt'].sort(),
    )
  })

  test('refuses unknown ids, days outside today or yesterday, days outside the span, and strangers', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t, { goals: ['Sam goal'], donts: ['Sam dont'] })
    const c = await signUp(t, 'c@example.com')
    const { goalItems: goals, donts } = (await me(a)).me
    expect(await refusal(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: ['made-up'] }))).toBe('Unknown goal')
    expect(await refusal(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', dontsBroken: ['made-up'] }))).toBe("Unknown don't")
    // A partner's id is not mine, even when the texts are alike.
    await t.run(async (ctx) => {
      const sam = (await ctx.db.query('challengeMembers').collect()).find((m) => m.userId === b.id)!
      await ctx.db.patch(sam._id, { goals: [{ id: 'goal-sam-1', text: 'Sam goal' }] })
    })
    expect(await refusal(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: ['goal-sam-1'] }))).toBe('Unknown goal')
    expect(await refusal(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-20', goalsKept: [goals[0]!.id] }))).toBe(
      'You can only check in for today or yesterday',
    )
    expect(await refusal(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-09-30', goalsKept: [goals[0]!.id] }))).toBe(
      'That day is outside the challenge',
    )
    expect(await refusal(c.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: [] }))).toBe('You are not in this challenge')
    // Yesterday is fine.
    await expect(a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-21', dontsBroken: [donts[0]!.id] })).resolves.toEqual({
      goalsKept: [],
      dontsBroken: [donts[0]!.id],
    })
  })

  test('a row made by a mark alone has no acts and does not count as activity', async () => {
    const t = convexTest(schema, modules)
    const { b, challengeId } = await pair(t, { goals: ['Read'] })
    const [goal] = (await me(b)).me.goalItems
    await b.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: [goal!.id] })
    const row = (await dayRow(t, b.id, '2026-10-22'))!
    expect(row.planSetAt).toBeUndefined()
    expect(row.checkinAt).toBeUndefined()
    expect(row.summary).toEqual(emptySummary())
    expect(row.goalsKept).toEqual([goal!.id])
    expect(row.dontsBroken).toEqual([])
    expect((await memberRow(t, b.id)).lastActedAt).toBeUndefined()
  })

  test('marks every day but no lock-in or check-in: the sweep still warns', async () => {
    const t = convexTest(schema, modules)
    vi.setSystemTime(at('2026-10-18', '12:00', BERLIN))
    const { a, b, challengeId } = await pair(t, { goals: ['Read'] })
    const [goal] = (await me(b)).me.goalItems
    // Kin locks in every day; Sam only ticks a goal on the 18th, 19th and 20th.
    await t.run(async (ctx) => {
      for (let day = 18; day <= 21; day++) {
        await ctx.db.insert('challengeDays', {
          challengeId,
          userId: a.id,
          date: `2026-10-${day}`,
          summary: emptySummary(),
          summaryUpdatedAt: 0,
          planSetAt: at(`2026-10-${day}`, '09:00', BERLIN),
          dontsBroken: [],
          remindersSent: { plan: 0, checkin: 0 },
        })
      }
    })
    for (const day of [18, 19, 20]) {
      vi.setSystemTime(at(`2026-10-${day}`, '20:00', NY))
      await b.as.mutation(api.challenges.markDay, { challengeId, date: `2026-10-${day}`, goalsKept: [goal!.id] })
    }
    vi.setSystemTime(at('2026-10-21', '08:00', NY))
    await t.action(internal.reminders.sweep, {})
    const challenge = await t.run(async (ctx) => ctx.db.get(challengeId))
    expect(challenge?.warning).toEqual({ userId: b.id, missedSince: '2026-10-18', issuedAt: at('2026-10-21', '08:00', NY) })
  })
})

// ─── checkIn with goals ───────────────────────────────────────────────────────

describe('checkIn and goalsKept', () => {
  test('writes goalsKept when given, keeps the mark when not, still checks don\'ts', async () => {
    const t = convexTest(schema, modules)
    const { a, challengeId } = await pair(t)
    const { goalItems: goals, donts } = (await me(a)).me
    await a.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: [goals[1]!.id] })
    await a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [donts[0]!.id, donts[0]!.id] })
    let row = (await dayRow(t, a.id, '2026-10-22'))!
    expect(row.goalsKept).toEqual([goals[1]!.id])
    expect(row.dontsBroken).toEqual([donts[0]!.id])
    expect(row.checkinAt).toEqual(expect.any(Number))

    await a.as.mutation(api.challenges.checkIn, {
      challengeId,
      date: '2026-10-22',
      summary: summary(),
      dontsBroken: [],
      goalsKept: [goals[0]!.id, goals[1]!.id, goals[0]!.id],
    })
    row = (await dayRow(t, a.id, '2026-10-22'))!
    expect(row.goalsKept).toEqual([goals[0]!.id, goals[1]!.id])
    expect(row.dontsBroken).toEqual([])

    expect(
      await refusal(a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: ['made-up'] })),
    ).toBe("Unknown don't")
    expect(
      await refusal(
        a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [], goalsKept: ['made-up'] }),
      ),
    ).toBe('Unknown goal')
  })
})

// ─── Minutes in the summary ───────────────────────────────────────────────────

describe('planned and done minutes', () => {
  test('every summary writer stores them; old summaries without them still pass; the partner sees them', async () => {
    const t = convexTest(schema, modules)
    const { a, b, challengeId } = await pair(t)
    const withMinutes = summary({
      tasksTotal: 5,
      tasks: [{ title: 'Email', isDone: true }, { title: 'Groceries', isDone: false }],
      plannedMinutes: 240,
      doneMinutes: 90,
    })

    await a.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: withMinutes, timezone: BERLIN })
    expect((await dayRow(t, a.id, '2026-10-22'))!.summary).toEqual(withMinutes)
    const seen = await b.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })
    expect(seen?.partner?.summary).toEqual(withMinutes)

    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: { ...withMinutes, doneMinutes: 120 } })
    expect((await dayRow(t, a.id, '2026-10-22'))!.summary).toMatchObject({ plannedMinutes: 240, doneMinutes: 120 })

    await a.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: { ...withMinutes, doneMinutes: 200 }, dontsBroken: [] })
    expect((await dayRow(t, a.id, '2026-10-22'))!.summary).toMatchObject({ plannedMinutes: 240, doneMinutes: 200 })

    // An old client: no minutes at all, on every writer.
    await b.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: summary(), timezone: NY })
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: summary() })
    await b.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: summary(), dontsBroken: [] })
    const sams = (await dayRow(t, b.id, '2026-10-22'))!.summary
    expect(sams).toEqual(emptySummary())
    expect(sams).not.toHaveProperty('plannedMinutes')
  })
})
