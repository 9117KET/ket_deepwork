/**
 * convex/challengeGroups.test.ts
 *
 * Group challenges (2026-11-11): up to eight members, `others` beside the
 * old `partner`, soft leaving and returning, the creator hand-over, a quiet
 * member dropped from a group, per-target nudges, the check-in reminder's
 * own deadline, and `updateSpan` guarding marks and closed stretches.
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
import { reminderEmail } from './reminders'

const sendMail = vi.fn(async () => ({ messageId: 'x' }))
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

const modules = import.meta.glob('./**/*.*s')

const BERLIN = 'Europe/Berlin'
const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'
const SITE = 'https://ket-deepwork.vercel.app'
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
type User = { id: Id<'users'>; email: string; name: string; as: ReturnType<T['withIdentity']> }
type Mail = { to: string; subject: string; text: string }

async function signUp(t: T, name: string): Promise<User> {
  const email = `${name.toLowerCase()}@example.com`
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, email, name, as: t.withIdentity({ subject: `${id}|s1` }) }
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

/** Kin creates; each other name joins in order through a fresh invite, one minute apart. */
async function group(t: T, names: string[], zones: Record<string, string> = {}, over: Partial<typeof setup> = {}) {
  const users: User[] = []
  for (const n of names) users.push(await signUp(t, n))
  const [creator, ...rest] = users
  const { challengeId } = await creator!.as.mutation(api.challenges.createChallenge, {
    ...setup,
    ...over,
    timezone: zones[creator!.name] ?? BERLIN,
    displayName: creator!.name,
  })
  for (const u of rest) {
    vi.setSystemTime(Date.now() + 60_000)
    const { token } = await creator!.as.mutation(api.challenges.createInvite, { challengeId })
    await u.as.mutation(api.challenges.acceptInvite, { token, timezone: zones[u.name] ?? BERLIN, displayName: u.name })
  }
  return { users, challengeId }
}

const entryOf = async (u: User, challengeId: Id<'challenges'>) =>
  (await u.as.query(api.challenges.myChallenges, {})).find((e) => e.challenge.id === challengeId)

const memberRows = (t: T) => t.run(async (ctx) => ctx.db.query('challengeMembers').collect())
const dayRows = (t: T) => t.run(async (ctx) => ctx.db.query('challengeDays').collect())
const challengeRow = async (t: T, id: Id<'challenges'>) => (await t.run(async (ctx) => ctx.db.get(id)))!

/** The emails scheduled from mutations (nudges, reopen notices), without running them. */
const scheduledMails = (t: T) =>
  t.run(async (ctx) => (await ctx.db.system.query('_scheduled_functions').collect()).map((f) => f.args[0] as Mail))

async function insertDay(t: T, challengeId: Id<'challenges'>, userId: string, date: string, extra: Record<string, unknown> = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert('challengeDays', {
      challengeId,
      userId,
      date,
      summary: emptySummary(),
      summaryUpdatedAt: 0,
      dontsBroken: [],
      remindersSent: { plan: 0, checkin: 0 },
      ...extra,
    })
  })
}

beforeEach(() => {
  // 22 Oct, 12:00 Berlin, 06:00 New York, 19:00 Tokyo.
  vi.useFakeTimers({ now: Date.UTC(2026, 9, 22, 10, 0), toFake: ['Date'] })
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = SITE
  sendMail.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.ADMIN_EMAILS
})

// ─── 1, 2: eight seats; others beside partner ────────────────────────────────

describe('eight seats', () => {
  test('eight can be in one challenge; the ninth is refused by createInvite and acceptInvite, and the preview says full', async () => {
    const t = convexTest(schema, modules)
    const names = ['Kin', 'Sam', 'Ana', 'Bo', 'Cy', 'Di', 'Ed', 'Flo']
    const { users, challengeId } = await group(t, names)
    expect((await entryOf(users[7]!, challengeId))!.challenge.memberCount).toBe(8)

    const nine = await signUp(t, 'Gus')
    expect(await refusal(users[3]!.as.mutation(api.challenges.createInvite, { challengeId }))).toEqual({
      code: 'challenge',
      message: 'This challenge is full (8 members)',
    })
    // An invite made earlier and still open, now that every seat is taken.
    await t.run(async (ctx) => {
      await ctx.db.insert('challengeInvites', { challengeId, token: 'late', createdBy: users[0]!.id, expiresAt: Date.now() + 60_000 })
    })
    expect(await t.query(api.challenges.invitePreview, { token: 'late' })).toMatchObject({ status: 'full', memberCount: 8, capacity: 8 })
    expect(await refusal(nine.as.mutation(api.challenges.acceptInvite, { token: 'late', timezone: BERLIN, displayName: 'Gus' }))).toEqual({
      code: 'challenge',
      message: 'This challenge is full (8 members)',
    })
    expect(await nine.as.query(api.challenges.myChallenges, {})).toEqual([])
  })

  test('with four, each viewer sees the three others in join order, partner = others[0], and the invite while seats remain', async () => {
    const t = convexTest(schema, modules)
    const names = ['Kin', 'Sam', 'Ana', 'Bo']
    const { users, challengeId } = await group(t, names)
    const { token } = await users[2]!.as.mutation(api.challenges.createInvite, { challengeId })
    for (const u of users) {
      const entry = (await entryOf(u, challengeId))!
      expect(entry.others.map((o) => o.displayName)).toEqual(names.filter((n) => n !== u.name))
      expect(entry.partner).toEqual(entry.others[0])
      expect(entry.challenge).toMatchObject({ memberCount: 4, capacity: 8 })
      expect(entry.invite?.token).toBe(token)
      expect(entry.others.every((o) => typeof o.key === 'string' && o.key.length > 0)).toBe(true)
      expect(entry.others.find((o) => o.displayName === 'Kin')?.isCreator ?? u.name === 'Kin').toBe(true)
      expect(entry.me.isCreator).toBe(u.name === 'Kin')
    }
  })
})

// ─── 3: per-member dates ──────────────────────────────────────────────────────

describe('each member read at their own date', () => {
  test('dayCards, todayCards and history return others per member date, and partner as before', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana', 'Bo'], { Sam: NY, Ana: TOKYO })
    const [kin, sam, ana, bo] = users as [User, User, User, User]
    // Each member has a row on the 21st, 22nd and 23rd, the note naming whose and which day.
    for (const u of [sam, ana, bo]) {
      for (const date of ['2026-10-21', '2026-10-22', '2026-10-23']) {
        await insertDay(t, challengeId, u.id, date, { note: `${u.name} ${date}`, checkinAt: 1 })
      }
    }
    const keys = Object.fromEntries((await entryOf(kin, challengeId))!.others.map((o) => [o.displayName, o.key]))

    const otherDates = [
      { key: keys.Ana!, date: '2026-10-23' },
      { key: keys.Bo!, date: '2026-10-21' },
    ]
    const cards = (await kin.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22', otherDates }))!
    expect(cards.others.map((o) => [o.key, o.day?.note])).toEqual([
      [keys.Sam, 'Sam 2026-10-22'],
      [keys.Ana, 'Ana 2026-10-23'],
      [keys.Bo, 'Bo 2026-10-21'],
    ])
    expect(cards.partner?.note).toBe('Sam 2026-10-22')

    const today = await kin.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-21', otherDates }] })
    expect(today[0]!.others.map((o) => o.day?.note)).toEqual(['Sam 2026-10-21', 'Ana 2026-10-23', 'Bo 2026-10-21'])
    expect(today[0]!.partner?.note).toBe('Sam 2026-10-21')

    const hist = (await kin.as.query(api.challenges.history, {
      challengeId,
      toDate: '2026-10-21',
      partnerToDate: '2026-10-22',
      otherToDates: [{ key: keys.Ana!, toDate: '2026-10-23' }],
    }))!
    expect(hist.others.map((o) => [o.key, o.rows.map((r) => r.date)])).toEqual([
      [keys.Sam, ['2026-10-21', '2026-10-22']],
      [keys.Ana, ['2026-10-21', '2026-10-22', '2026-10-23']],
      [keys.Bo, ['2026-10-21', '2026-10-22']],
    ])
    expect(hist.partner.map((r) => r.date)).toEqual(['2026-10-21', '2026-10-22'])
    // A malformed per-member date is refused like a malformed partnerDate.
    await expect(
      kin.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22', otherDates: [{ key: keys.Ana!, date: '22 Oct' }] }),
    ).rejects.toThrow(/YYYY-MM-DD/)
  })
})

// ─── 4: the live client's calls, unchanged ───────────────────────────────────

describe('the live two-person client keeps working', () => {
  test('every public function called the way src/ calls it on main returns the old fields with the old types', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'Kin')
    const sam = await signUp(t, 'Sam')
    // challengeService.createChallenge / createInvite / acceptInvite
    const { challengeId } = await kin.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
    const invite = await kin.as.mutation(api.challenges.createInvite, { challengeId })
    expect(invite).toEqual({ token: expect.any(String), expiresAt: expect.any(Number) })
    const preview = await t.query(api.challenges.invitePreview, { token: invite.token })
    expect(preview).toMatchObject({ status: 'ok', challenge: { name: 'Q4 push', startDate: '2026-10-01', endDate: '2026-12-31' }, inviterName: 'Kin' })
    expect(preview.inviterGoals).toEqual(['Ship it'])
    expect(preview.inviterDonts).toEqual(['No doomscrolling'])
    expect(await sam.as.mutation(api.challenges.acceptInvite, { token: invite.token, timezone: NY, displayName: 'Sam' })).toEqual({ challengeId })

    // useChallenges: myChallenges
    const entry = (await kin.as.query(api.challenges.myChallenges, {}))[0]!
    expect(entry.challenge).toMatchObject({
      id: challengeId,
      name: 'Q4 push',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      planDeadline: '10:00',
      checkinDeadline: '23:59',
      createdAt: expect.any(Number),
      status: 'active',
      endedReason: null,
      endedAt: null,
      warning: null,
      isCreator: true,
      solo: false,
    })
    for (const m of [entry.me, entry.partner!]) {
      expect(m).toMatchObject({ displayName: expect.any(String), timezone: expect.any(String), joinedAt: expect.any(Number) })
      expect(Array.isArray(m.goals) && m.goals.every((g) => typeof g === 'string')).toBe(true)
      expect(Array.isArray(m.goalItems)).toBe(true)
      expect(Array.isArray(m.donts)).toBe(true)
    }
    expect(entry.partner!.displayName).toBe('Sam')
    expect(entry.invite).toBeNull()

    // challengeService: syncDaySummary, lockInPlan (with and without id), checkIn, markDay
    await kin.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: emptySummary(), timezone: BERLIN })
    const locked = await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect(locked).toEqual({ planSetAt: expect.any(Number), locked: [{ challengeId, planSetAt: expect.any(Number) }] })
    await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary(), challengeId })
    const dontId = entry.me.donts[0]!.id
    expect(await kin.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: emptySummary(), note: 'ok', dontsBroken: [dontId] })).toEqual({
      checkinAt: expect.any(Number),
    })
    expect(await kin.as.mutation(api.challenges.markDay, { challengeId, date: '2026-10-22', goalsKept: [entry.me.goalItems[0]!.id] })).toEqual({
      goalsKept: [entry.me.goalItems[0]!.id],
      dontsBroken: [dontId],
    })

    // useChallengeDetail: dayCards({ challengeId, myDate, partnerDate })
    const samCards = (await sam.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' }))!
    expect(samCards.challenge).toMatchObject({ id: challengeId, status: 'active', isCreator: false })
    expect(Object.keys(samCards.partner!).sort()).toEqual(
      ['checkinAt', 'date', 'dontsBroken', 'goalsKept', 'note', 'planSetAt', 'summary', 'summaryUpdatedAt'].sort(),
    )
    expect(samCards.mine).toBeNull()

    // useTodayCards: todayCards({ myDate, cards: [{ challengeId, partnerDate }] })
    const kinToday = await kin.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] })
    expect(kinToday[0]!.mine).toMatchObject({
      planSetAt: expect.any(Number),
      checkinAt: expect.any(Number),
      note: 'ok',
      dontsBroken: [dontId],
      goalsKept: [entry.me.goalItems[0]!.id],
      nudgesSentAt: null,
      nudgeSentAt: null,
    })
    expect(kinToday[0]!.partner).toBeNull()

    // useChallengeHistory: history({ challengeId, toDate }) and with partnerToDate
    const hist = (await sam.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' }))!
    expect(hist.mine).toEqual([])
    expect(hist.partner.map((d) => d.date)).toEqual(['2026-10-22'])
    expect((await sam.as.query(api.challenges.history, { challengeId, toDate: '2026-10-21', partnerToDate: '2026-10-22' }))!.partner).toHaveLength(1)

    // challengeService.nudgePartner(challengeId): the partner, as before.
    expect(await kin.as.mutation(api.challenges.nudgePartner, { challengeId })).toEqual({ left: 2, nextAt: expect.any(Number) })
    expect((await scheduledMails(t)).map((m) => m.to)).toEqual(['sam@example.com'])
    const kinRow = (await dayRows(t)).find((r) => r.userId === kin.id && r.date === '2026-10-22')!
    expect(kinRow.nudgesSentAt).toHaveLength(1)

    // updateMyCommitments, renameChallenge, updateSpan
    const saved = await kin.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: ['Ship it'], donts: [{ id: dontId, text: 'No doomscrolling' }] })
    expect(saved.goals).toEqual(['Ship it'])
    expect(await sam.as.mutation(api.challenges.renameChallenge, { challengeId, name: 'Winter' })).toEqual({ name: 'Winter' })
    expect(await kin.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-01', endDate: '2027-01-31' })).toMatchObject({
      endDate: '2027-01-31',
      isCreator: true,
    })

    // useIsAdmin, adminListChallenges
    expect(await kin.as.query(api.challenges.adminStatus, {})).toEqual({ isAdmin: false })

    // leaveChallenge: the partner leaves; the creator runs on alone, as before.
    expect(await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })).toBeNull()
    const alone = (await kin.as.query(api.challenges.myChallenges, {}))[0]!
    expect(alone.partner).toBeNull()
    expect(alone.challenge.status).toBe('active')
    // The creator leaving alone ends it (allLeft); deleteChallenge then removes it.
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect((await kin.as.query(api.challenges.myChallenges, {}))[0]!.challenge).toMatchObject({ status: 'ended', endedReason: 'allLeft' })
    expect(await kin.as.mutation(api.challenges.deleteChallenge, { challengeId })).toBeNull()
  })
})

// ─── 5, 6: privacy with four ──────────────────────────────────────────────────

describe('privacy in a group', () => {
  test('no other member\'s user id, email or bookkeeping in any return, for any of four viewing any other', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana', 'Bo'])
    // Everyone acts and nudges, so every row carries bookkeeping that must stay home.
    for (const u of users) {
      await u.as.mutation(api.challenges.syncDaySummary, { date: '2026-10-22', summary: emptySummary(), timezone: BERLIN })
    }
    await users[0]!.as.mutation(api.challenges.nudgePartner, { challengeId })
    await users[1]!.as.mutation(api.challenges.nudgePartner, { challengeId })
    await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '12:05', BERLIN) })
    for (const u of users) await insertDay(t, challengeId, u.id, '2026-10-21', { checkinAt: 1, nudgesSentAt: [1], nudgesByMember: { x: [1] } })

    for (const viewer of users) {
      const entry = (await entryOf(viewer, challengeId))!
      const keys = entry.others.map((o) => o.key)
      const otherDates = keys.map((key) => ({ key, date: '2026-10-22' }))
      const reads = {
        list: await viewer.as.query(api.challenges.myChallenges, {}),
        cards: await viewer.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22', otherDates }),
        today: await viewer.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22', otherDates }] }),
        history: await viewer.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' }),
      }
      const json = JSON.stringify(reads)
      for (const other of users.filter((u) => u !== viewer)) {
        expect(json).not.toContain(other.id)
        expect(json).not.toContain(other.email)
      }
      // Other members' days: exactly the DayView keys, no bookkeeping.
      const dayKeys = ['checkinAt', 'date', 'dontsBroken', 'goalsKept', 'note', 'planSetAt', 'summary', 'summaryUpdatedAt'].sort()
      const otherDays = [
        reads.cards!.partner,
        ...reads.cards!.others.map((o) => o.day),
        reads.today[0]!.partner,
        ...reads.today[0]!.others.map((o) => o.day),
        ...reads.history!.partner,
        ...reads.history!.others.flatMap((o) => o.rows),
      ]
      expect(otherDays.length).toBeGreaterThan(6)
      for (const day of otherDays) expect(Object.keys(day!).sort()).toEqual(dayKeys)
      // Member views carry no user id either.
      for (const o of reads.list.flatMap((e) => [e.me, ...e.others])) expect(o).not.toHaveProperty('userId')
    }
  })

  test('a member of challenge A learns nothing of another member\'s challenge B', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana', 'Bo'])
    const bo = users[3]!
    const eve = await signUp(t, 'Eve')
    const { challengeId: thesis } = await bo.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Thesis sprint', timezone: BERLIN, displayName: 'Bo' })
    const { token } = await bo.as.mutation(api.challenges.createInvite, { challengeId: thesis })
    await eve.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Eve' })
    await bo.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })

    for (const viewer of users.slice(0, 3)) {
      const keys = (await entryOf(viewer, challengeId))!.others.map((o) => o.key)
      const json = JSON.stringify([
        await viewer.as.query(api.challenges.myChallenges, {}),
        await viewer.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' }),
        await viewer.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22', otherDates: keys.map((key) => ({ key, date: '2026-10-22' })) }] }),
        await viewer.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' }),
      ])
      expect(json).not.toContain('Thesis sprint')
      expect(json).not.toContain('Eve')
      expect(json).not.toContain(thesis)
      expect(await viewer.as.query(api.challenges.dayCards, { challengeId: thesis, myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    }
  })
})

// ─── 7: nudges per target ─────────────────────────────────────────────────────

describe('nudging one member of a group', () => {
  test('memberKey reaches that member only; three a day and an hour apart per target; no key is the first other; a foreign key is refused', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana', 'Bo'])
    const [kin] = users as [User]
    const keys = Object.fromEntries((await entryOf(kin, challengeId))!.others.map((o) => [o.displayName, o.key]))
    const sentTo = async () => (await scheduledMails(t)).map((m) => m.to)

    expect(await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Ana })).toEqual({ left: 2, nextAt: expect.any(Number) })
    expect(await sentTo()).toEqual(['ana@example.com'])
    // The gap is per target: Ana again is too soon, Bo is not.
    expect((await refusal(kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Ana }))).message).toMatch(/again in 60 min/)
    await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Bo })
    // Without a key, the first other member (Sam), as the two-person client expects.
    await kin.as.mutation(api.challenges.nudgePartner, { challengeId })
    expect(await sentTo()).toEqual(['ana@example.com', 'bo@example.com', 'sam@example.com'])

    // The cap is per target: two more for Ana, an hour apart, then refused.
    vi.setSystemTime(Date.now() + 61 * 60_000)
    await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Ana })
    vi.setSystemTime(Date.now() + 61 * 60_000)
    expect(await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Ana })).toEqual({ left: 0, nextAt: null })
    vi.setSystemTime(Date.now() + 61 * 60_000)
    expect((await refusal(kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Ana }))).message).toBe(
      'You have nudged them 3 times today',
    )
    // Bo still has room.
    await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: keys.Bo })

    // The bookkeeping: per key on Kin's row, and the legacy list keeps all of them.
    const row = (await dayRows(t)).find((r) => r.userId === kin.id)!
    expect(row.nudgesByMember![keys.Ana!]).toHaveLength(3)
    expect(row.nudgesByMember![keys.Bo!]).toHaveLength(2)
    expect(row.nudgesByMember![keys.Sam!]).toHaveLength(1)
    expect(row.nudgesSentAt).toHaveLength(6)
    const myDay = (await kin.as.query(api.challenges.todayCards, { myDate: '2026-10-22', cards: [{ challengeId, partnerDate: '2026-10-22' }] }))[0]!.mine!
    expect(myDay.nudgesByMember[keys.Ana!]).toHaveLength(3)

    // A key from another challenge, or my own key, is not a member to nudge here.
    const other = await group(t, ['Zed', 'Yan'])
    const yanKey = (await entryOf(other.users[0]!, other.challengeId))!.others[0]!.key
    for (const memberKey of [yanKey, (await entryOf(kin, challengeId))!.me.key, 'nonsense']) {
      expect(await refusal(kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey }))).toEqual({
        code: 'challenge',
        message: 'They are not in this challenge',
      })
    }
  })
})

describe('nudging a member with no email (fix round 2)', () => {
  test('in a group the refusal names nobody; in a pair it says your partner; nothing is recorded or queued', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    const [kin, sam, ana] = users as [User, User, User]
    await t.run(async (ctx) => ctx.db.patch(ana.id, { email: undefined }))
    const anaKey = (await entryOf(kin, challengeId))!.others.find((o) => o.displayName === 'Ana')!.key
    expect(await refusal(kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: anaKey }))).toEqual({
      code: 'challenge',
      message: 'They have no email address on file',
    })
    expect(await scheduledMails(t)).toEqual([])
    expect((await dayRows(t)).filter((r) => r.userId === kin.id)).toEqual([])
    // Another member with an address is still nudged.
    await kin.as.mutation(api.challenges.nudgePartner, { challengeId, memberKey: (await entryOf(kin, challengeId))!.others[0]!.key })
    expect((await scheduledMails(t)).map((m) => m.to)).toEqual([sam.email])

    const t2 = convexTest(schema, modules)
    const two = await group(t2, ['Kin', 'Sam'])
    await t2.run(async (ctx) => ctx.db.patch(two.users[1]!.id, { email: undefined }))
    expect((await refusal(two.users[0]!.as.mutation(api.challenges.nudgePartner, { challengeId: two.challengeId }))).message).toBe(
      'Your partner has no email address on file',
    )
  })
})

// ─── Fix round 3 ─────────────────────────────────────────────────────────────

describe('invites from someone who is no longer in it (fix round 3)', () => {
  test('a link made by a member who left or was dropped previews as not valid, names nobody, and cannot be accepted', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana', 'Bo'])
    const [kin, sam, ana] = users as [User, User, User, User]
    await sam.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: ['Sam secret goal'], donts: [{ text: 'Sam secret dont' }] })
    const { token: samToken } = await sam.as.mutation(api.challenges.createInvite, { challengeId })
    await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })

    const preview = await t.query(api.challenges.invitePreview, { token: samToken })
    expect(preview).toMatchObject({ status: 'notFound', challenge: null, inviterName: null, inviterGoals: [], inviterDonts: [] })
    const json = JSON.stringify(preview)
    for (const secret of ['Sam', 'secret', 'Q4 push']) expect(json).not.toContain(secret)

    const newcomer = await signUp(t, 'Gus')
    expect(await refusal(newcomer.as.mutation(api.challenges.acceptInvite, { token: samToken, timezone: BERLIN, displayName: 'Gus' }))).toEqual({
      code: 'challenge',
      message: 'This invite link is no longer valid',
    })
    expect(await newcomer.as.query(api.challenges.myChallenges, {})).toEqual([])

    // The same for a member the sweep dropped.
    const { token: anaToken } = await ana.as.mutation(api.challenges.createInvite, { challengeId })
    await t.run(async (ctx) => {
      const row = (await ctx.db.query('challengeMembers').collect()).find((m) => m.userId === ana.id)!
      await ctx.db.patch(row._id, { leftAt: Date.now(), leftReason: 'inactive' })
    })
    expect(await t.query(api.challenges.invitePreview, { token: anaToken })).toMatchObject({ status: 'notFound', inviterName: null })
    expect((await refusal(newcomer.as.mutation(api.challenges.acceptInvite, { token: anaToken, timezone: BERLIN, displayName: 'Gus' }))).message).toBe(
      'This invite link is no longer valid',
    )

    // The dead links are never handed out again as "the open invite".
    expect((await entryOf(kin, challengeId))!.invite).toBeNull()
    // A link from someone still in it works as before.
    const { token: kinToken } = await kin.as.mutation(api.challenges.createInvite, { challengeId })
    expect([samToken, anaToken]).not.toContain(kinToken)
    expect(await t.query(api.challenges.invitePreview, { token: kinToken })).toMatchObject({ status: 'ok', inviterName: 'Kin' })
    await newcomer.as.mutation(api.challenges.acceptInvite, { token: kinToken, timezone: BERLIN, displayName: 'Gus' })
  })
})

describe('hand-over with pre-v2 rows (fix round 3)', () => {
  test('a successor with no lists gets empty ones, not the legacy challenge-row lists; the old creator keeps theirs', async () => {
    const t = convexTest(schema, modules)
    const kin = await signUp(t, 'Kin')
    const sam = await signUp(t, 'Sam')
    const ana = await signUp(t, 'Ana')
    // The shape written before per-member lists: lists on the challenge row, none on member rows.
    const challengeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('challenges', {
        name: 'Old season',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        goals: ['Legacy goal'],
        donts: [{ id: 'dont-legacy-1', text: 'Legacy dont' }],
        planDeadline: '10:00',
        checkinDeadline: '23:59',
        createdBy: kin.id,
        createdAt: 1,
        status: 'active',
      })
      for (const [u, joinedAt] of [[kin, 1], [sam, 2], [ana, 3]] as const) {
        await ctx.db.insert('challengeMembers', { challengeId: id, userId: u.id, timezone: BERLIN, displayName: u.name, joinedAt })
      }
      return id
    })
    expect((await entryOf(kin, challengeId))!.me.goals).toEqual(['Legacy goal'])
    expect((await entryOf(sam, challengeId))!.me.goals).toEqual([])

    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect((await challengeRow(t, challengeId)).createdBy).toBe(sam.id)
    const rows = await memberRows(t)
    const samRow = rows.find((m) => m.userId === sam.id)!
    expect(samRow.goals).toEqual([])
    expect(samRow.donts).toEqual([])
    const samEntry = (await entryOf(sam, challengeId))!
    expect(samEntry.me).toMatchObject({ goals: [], goalItems: [], donts: [], isCreator: true })
    // The old creator's legacy lists now live on their own row, with the ids they always read as.
    const kinRow = rows.find((m) => m.userId === kin.id)!
    expect(kinRow.goals).toEqual([{ id: 'goal-legacy-0', text: 'Legacy goal' }])
    expect(kinRow.donts).toEqual([{ id: 'dont-legacy-1', text: 'Legacy dont' }])
    // Ana, untouched by the hand-over, still reads as having none.
    expect(rows.find((m) => m.userId === ana.id)!.goals).toBeUndefined()
    expect((await entryOf(ana, challengeId))!.me.goals).toEqual([])
  })
})

describe('the row bound (fix round 3)', () => {
  test('with seats free but 64 member rows, a newcomer is told the challenge cannot take new members; a former member still returns', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam'])
    const [kin, sam] = users as [User, User]
    await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })
    // 62 more former rows: 64 rows in all (Kin, Sam and these), one active.
    await t.run(async (ctx) => {
      for (let i = 0; i < 62; i++) {
        await ctx.db.insert('challengeMembers', {
          challengeId,
          userId: `former-${i}`,
          timezone: BERLIN,
          displayName: `Former ${i}`,
          joinedAt: i,
          leftAt: 1,
          leftReason: 'left',
        })
      }
    })
    const newcomer = await signUp(t, 'Gus')
    const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId })
    expect(await refusal(newcomer.as.mutation(api.challenges.acceptInvite, { token, timezone: BERLIN, displayName: 'Gus' }))).toEqual({
      code: 'challenge',
      message: 'This challenge cannot take new members',
    })
    // Sam's own row is among the 64, so Sam can come back.
    await sam.as.mutation(api.challenges.acceptInvite, { token, timezone: BERLIN, displayName: 'Sam' })
    expect((await entryOf(kin, challengeId))!.others.map((o) => o.displayName)).toEqual(['Sam'])
  })
})

// ─── 8 to 11: leaving and returning ──────────────────────────────────────────

describe('leaving and returning', () => {
  test('a member who leaves keeps their row and days; nobody sees them; an invite brings them back whole', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    const [kin, sam, ana] = users as [User, User, User]
    await sam.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await sam.as.mutation(api.challenges.updateMyCommitments, { challengeId, goals: ['Run'], donts: [{ text: 'No sugar' }] })
    const before = (await memberRows(t)).find((m) => m.userId === sam.id)!
    const samDays = (await dayRows(t)).filter((d) => d.userId === sam.id)

    await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })
    const after = (await memberRows(t)).find((m) => m.userId === sam.id)!
    expect(after).toEqual({ ...before, leftAt: Date.UTC(2026, 9, 22, 10, 2), leftReason: 'left' })
    expect(await sam.as.query(api.challenges.myChallenges, {})).toEqual([])
    expect(await sam.as.query(api.challenges.dayCards, { challengeId, myDate: '2026-10-22', partnerDate: '2026-10-22' })).toBeNull()
    expect(await sam.as.query(api.challenges.history, { challengeId, toDate: '2026-10-22' })).toBeNull()
    expect((await refusal(sam.as.mutation(api.challenges.checkIn, { challengeId, date: '2026-10-22', summary: emptySummary(), dontsBroken: [] }))).message).toBe(
      'You are not in this challenge',
    )
    for (const u of [kin, ana]) {
      const entry = (await entryOf(u, challengeId))!
      expect(entry.others.map((o) => o.displayName)).not.toContain('Sam')
      expect(entry.challenge.memberCount).toBe(2)
    }
    expect((await dayRows(t)).filter((d) => d.userId === sam.id)).toEqual(samDays)

    // Three days later Sam accepts a new invite: the same row, active again, joinedDate their today.
    vi.setSystemTime(at('2026-10-25', '12:00', BERLIN))
    const { token } = await ana.as.mutation(api.challenges.createInvite, { challengeId })
    expect(await t.query(api.challenges.invitePreview, { token })).toMatchObject({ status: 'ok' })
    await sam.as.mutation(api.challenges.acceptInvite, { token, timezone: BERLIN, displayName: 'Someone else', goals: ['Ignored'] })
    const back = (await memberRows(t)).find((m) => m.userId === sam.id)!
    expect(back._id).toBe(before._id)
    expect(back).toEqual({ ...before, joinedDate: '2026-10-25' })
    expect((await memberRows(t)).filter((m) => m.userId === sam.id)).toHaveLength(1)
    const samEntry = (await entryOf(sam, challengeId))!
    expect(samEntry.me).toMatchObject({ displayName: 'Sam', goals: ['Run'], key: before._id })
    // The same don'ts with the same ids (the accept's lists are ignored: Sam's own are not empty).
    expect(samEntry.me.donts).toEqual(before.donts)
    expect(samEntry.me.donts.filter((d) => d.archivedAt === undefined).map((d) => d.text)).toEqual(['No sugar'])
    const hist = (await sam.as.query(api.challenges.history, { challengeId, toDate: '2026-10-24' }))!
    expect(hist.mine.map((d) => d.date)).toEqual(['2026-10-22'])
    // Join order is their original one: second, after Kin.
    expect((await entryOf(kin, challengeId))!.others.map((o) => o.displayName)).toEqual(['Sam', 'Ana'])
  })

  test('the creator leaving a group of three hands it to the longest-standing member; the old creator cannot change the dates', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    const [kin, sam, ana] = users as [User, User, User]
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId })
    const stored = await challengeRow(t, challengeId)
    expect(stored).toMatchObject({ status: 'active', createdBy: sam.id })
    expect(stored.endedReason).toBeUndefined()
    const samEntry = (await entryOf(sam, challengeId))!
    expect(samEntry.challenge.isCreator).toBe(true)
    expect(samEntry.me.isCreator).toBe(true)
    expect((await entryOf(ana, challengeId))!.others).toEqual([expect.objectContaining({ displayName: 'Sam', isCreator: true })])
    await sam.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-01', endDate: '2027-01-15' })
    expect((await refusal(ana.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-01', endDate: '2027-01-20' }))).message).toBe(
      'Only the creator can change the dates',
    )
    expect((await refusal(kin.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-01', endDate: '2027-01-20' }))).message).toBe(
      'You are not in this challenge',
    )
  })

  test('the last active member leaving ends it allLeft, keeps their row active, and can still read it', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    const [kin, sam, ana] = users as [User, User, User]
    await kin.as.mutation(api.challenges.leaveChallenge, { challengeId })
    await sam.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect((await challengeRow(t, challengeId)).createdBy).toBe(ana.id)
    await ana.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect(await challengeRow(t, challengeId)).toMatchObject({ status: 'ended', endedReason: 'allLeft' })
    const anaRow = (await memberRows(t)).find((m) => m.userId === ana.id)!
    expect(anaRow.leftAt).toBeUndefined()
    expect((await entryOf(ana, challengeId))!.challenge).toMatchObject({ status: 'ended', endedReason: 'allLeft', isCreator: true })
    expect(await ana.as.query(api.challenges.history, { challengeId, toDate: '2026-10-21' })).not.toBeNull()
    expect(await kin.as.query(api.challenges.myChallenges, {})).toEqual([])
  })

  test('a warning naming the leaver goes with them', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    await t.run(async (ctx) => ctx.db.patch(challengeId, { warning: { userId: users[2]!.id, missedSince: '2026-10-18', issuedAt: 1 } }))
    expect((await entryOf(users[0]!, challengeId))!.challenge.warning).toMatchObject({ forMe: false, displayName: 'Ana' })
    await users[2]!.as.mutation(api.challenges.leaveChallenge, { challengeId })
    expect((await challengeRow(t, challengeId)).warning).toBeUndefined()
  })
})

// ─── 12 to 15: the sweep with groups ─────────────────────────────────────────

/** Every named member except `quiet` locks in every day from the 18th to `last` (October). */
async function actThrough(t: T, challengeId: Id<'challenges'>, users: User[], quiet: User, last: number) {
  for (const u of users) {
    if (u === quiet) continue
    for (let day = 18; day <= last; day++) await insertDay(t, challengeId, u.id, `2026-10-${day}`, { planSetAt: 1 })
  }
}

/**
 * The sweep's claim at `nowMs`, rendered as the emails it would send. (Read from the claim, not the
 * mocked transport: nudges scheduled by other tests on real timers would land in the transport.)
 */
async function sweepAt(t: T, nowMs: number): Promise<Mail[]> {
  vi.setSystemTime(nowMs)
  const due = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs })
  return due.map((r) => ({ to: r.to, ...reminderEmail(r, SITE) }))
}

describe('a quiet member of a group', () => {
  test('three active, one quiet: warned, then dropped alone; the challenge runs on and each of the three gets one dropped email', async () => {
    const t = convexTest(schema, modules)
    vi.setSystemTime(at('2026-10-18', '12:00', BERLIN))
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'], { Sam: NY })
    const [kin, sam, ana] = users as [User, User, User]
    await actThrough(t, challengeId, users, sam, 22)

    const warned = await sweepAt(t, at('2026-10-21', '08:00', NY))
    expect(warned.map((m) => m.to).sort()).toEqual(['ana@example.com', 'kin@example.com', 'sam@example.com'])
    expect(warned.find((m) => m.to === 'kin@example.com')!.text).toMatch(/Sam drops out and the challenge runs on for everyone else/)
    expect(warned.find((m) => m.to === 'sam@example.com')!.text).toMatch(/you stay in/)
    expect((await challengeRow(t, challengeId)).warning).toMatchObject({ userId: sam.id })

    const dropped = await sweepAt(t, at('2026-10-22', '08:00', NY))
    const droppedMails = dropped.filter((m) => /dropped out|out of Q4 push/.test(m.subject))
    expect(droppedMails.map((m) => m.to).sort()).toEqual(['ana@example.com', 'kin@example.com', 'sam@example.com'])
    expect(droppedMails.find((m) => m.to === 'kin@example.com')!.subject).toBe('Sam has dropped out of Q4 push')
    expect(droppedMails.find((m) => m.to === 'sam@example.com')!.subject).toBe('You are out of Q4 push for now')
    expect(droppedMails.find((m) => m.to === 'sam@example.com')!.text).toMatch(/invite link/)
    const stored = await challengeRow(t, challengeId)
    expect(stored.status).toBe('active')
    expect(stored.warning).toBeUndefined()
    expect(stored.createdBy).toBe(kin.id)
    expect((await memberRows(t)).find((m) => m.userId === sam.id)).toMatchObject({ leftAt: at('2026-10-22', '08:00', NY), leftReason: 'inactive' })
    expect((await entryOf(ana, challengeId))!.others.map((o) => o.displayName)).toEqual(['Kin'])
    // Nothing more about Sam afterwards; the two-member rule applies from now on.
    expect((await sweepAt(t, at('2026-10-22', '08:15', NY))).filter((m) => m.to === 'sam@example.com')).toEqual([])
  })

  test('the dropped member was the creator: the challenge has a new creator', async () => {
    const t = convexTest(schema, modules)
    vi.setSystemTime(at('2026-10-18', '12:00', BERLIN))
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    const [kin, sam] = users as [User, User, User]
    await actThrough(t, challengeId, users, kin, 22)
    await sweepAt(t, at('2026-10-21', '08:00', BERLIN))
    expect((await challengeRow(t, challengeId)).warning).toMatchObject({ userId: kin.id })
    await sweepAt(t, at('2026-10-22', '08:00', BERLIN))
    const stored = await challengeRow(t, challengeId)
    expect(stored).toMatchObject({ status: 'active', createdBy: sam.id })
    expect((await entryOf(sam, challengeId))!.challenge.isCreator).toBe(true)
    expect(await kin.as.query(api.challenges.myChallenges, {})).toEqual([])
  })

  test('a challenge of eight: every member gets their own plan reminder', async () => {
    const t = convexTest(schema, modules)
    const names = ['Kin', 'Sam', 'Ana', 'Bo', 'Cy', 'Di', 'Ed', 'Flo']
    const { users } = await group(t, names)
    const due = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '10:05', BERLIN) })
    expect(due.filter((d) => d.kind === 'plan').map((d) => d.to).sort()).toEqual(users.map((u) => u.email).sort())
    expect(due.every((d) => d.group === true)).toBe(true)
  })
})

// ─── 23: the check-in reminder names the deadline ─────────────────────────────

describe('the check-in reminder', () => {
  test('names the challenge\'s own deadline; "midnight" only for 23:59; "the group" for three or more', async () => {
    const t = convexTest(schema, modules)
    const { challengeId } = await group(t, ['Kin', 'Sam'], {}, { checkinDeadline: '22:00' })
    const due = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '21:35', BERLIN) })
    expect(due).toHaveLength(2)
    const mail = reminderEmail(due[0]!, SITE)
    expect(mail.subject).toBe('Check in before 22:00 — Q4 push')
    expect(mail.text).toMatch(/closes at 22:00/)
    expect(mail.text).toMatch(/your partner will see it/)
    expect(`${mail.subject} ${mail.text}`).not.toMatch(/midnight/)
    expect(due[0]!.challengeId).toBe(challengeId)

    const t2 = convexTest(schema, modules)
    await group(t2, ['Kin', 'Sam', 'Ana'])
    const late = await t2.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '21:35', BERLIN) })
    const lateMail = reminderEmail(late[0]!, SITE)
    expect(lateMail.subject).toBe('Check in before midnight — Q4 push')
    expect(lateMail.text).toMatch(/the group will see it/)
  })
})

// ─── 24: updateSpan guards marks and closed stretches ─────────────────────────

describe('updateSpan and what it must not hide', () => {
  test('the start cannot move past the first day holding a mark, nor past the first closed stretch', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam'])
    // Sam marked a goal on the 10th and did nothing else that day.
    await insertDay(t, challengeId, users[1]!.id, '2026-10-10', { goalsKept: ['goal-1'] })
    expect((await refusal(users[0]!.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-11', endDate: '2026-12-31' }))).message).toBe(
      "The start can't move past 10 Oct, when the first lock-in, check-in or mark was recorded",
    )
    await users[0]!.as.mutation(api.challenges.updateSpan, { challengeId, startDate: '2026-10-10', endDate: '2026-12-31' })

    const t2 = convexTest(schema, modules)
    const two = await group(t2, ['Kin', 'Sam'])
    await t2.run(async (ctx) => ctx.db.patch(two.challengeId, { closedSpans: [{ from: '2026-10-05', to: '2026-10-08' }] }))
    expect(
      (await refusal(two.users[0]!.as.mutation(api.challenges.updateSpan, { challengeId: two.challengeId, startDate: '2026-10-06', endDate: '2026-12-31' })))
        .message,
    ).toBe("The start can't move past 5 Oct, when the challenge was closed")
    await two.users[0]!.as.mutation(api.challenges.updateSpan, { challengeId: two.challengeId, startDate: '2026-10-05', endDate: '2026-12-31' })
  })
})

// ─── admin ────────────────────────────────────────────────────────────────────

describe('admin list with groups', () => {
  test('lists active members and counts former ones', async () => {
    const t = convexTest(schema, modules)
    const { users, challengeId } = await group(t, ['Kin', 'Sam', 'Ana'])
    await users[1]!.as.mutation(api.challenges.leaveChallenge, { challengeId })
    process.env.ADMIN_EMAILS = 'kin@example.com'
    const [row] = await users[0]!.as.query(api.challenges.adminListChallenges, {})
    expect(row!.members.map((m) => m.displayName)).toEqual(['Kin', 'Ana'])
    expect(row!.formerMembers).toBe(1)
  })
})
