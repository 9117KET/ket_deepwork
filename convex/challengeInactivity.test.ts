/**
 * convex/challengeInactivity.test.ts
 *
 * The sweep's inactivity rule end to end, against a mocked nodemailer: three
 * full local days without a lock-in or check-in warn both members, an act
 * clears it, a fourth closes the challenge. Also: one plan email for a
 * member who owes the same lock-in in two challenges.
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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
const SITE = 'https://ket-deepwork.vercel.app'
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
type Mail = { to: string; subject: string; text: string }

async function signUp(t: T, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

/** Kin (Berlin) and Sam (New York) both join on 18 Oct. */
async function pair(t: T) {
  vi.setSystemTime(at('2026-10-18', '12:00', BERLIN))
  const kin = await signUp(t, 'kin@example.com')
  const sam = await signUp(t, 'sam@example.com')
  const { challengeId } = await kin.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId })
  await sam.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
  return { kin, sam, challengeId }
}

/** Kin locks in every day from the 18th to `last`, so only Sam is ever quiet. */
async function kinActsThrough(t: T, challengeId: Id<'challenges'>, kinId: string, last: number) {
  await t.run(async (ctx) => {
    for (let day = 18; day <= last; day++) {
      await ctx.db.insert('challengeDays', {
        challengeId,
        userId: kinId,
        date: `2026-10-${day}`,
        summary: emptySummary(),
        summaryUpdatedAt: 0,
        planSetAt: at(`2026-10-${day}`, '09:00', BERLIN),
        dontsBroken: [],
        remindersSent: { plan: 0, checkin: 0 },
      })
    }
  })
}

/** Runs the cron's sweep at `nowMs` and returns the mails it sent. */
async function sweepAt(t: T, nowMs: number): Promise<Mail[]> {
  sendMail.mockClear()
  vi.setSystemTime(nowMs)
  await t.action(internal.reminders.sweep, {})
  return sendMail.mock.calls.map((c) => (c as unknown as [Mail])[0])
}

const words = (s: string) => s.replace(/\s+/g, ' ').trim()

const challengeRow = async (t: T) => (await t.run(async (ctx) => ctx.db.query('challenges').take(1)))[0]!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = SITE
  sendMail.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('inactivity', () => {
  test('three quiet days warn both members; a lock-in the next day clears it', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, challengeId } = await pair(t)
    await kinActsThrough(t, challengeId, kin.id, 21)
    const link = `${SITE}/challenge/${challengeId}`

    // 08:00 New York on the 21st: Sam's 18th, 19th and 20th have no row at all.
    const mails = await sweepAt(t, at('2026-10-21', '08:00', NY))
    expect(mails.map((m) => m.to).sort()).toEqual(['kin@example.com', 'sam@example.com'])
    expect(mails.every((m) => m.subject === 'Three days without a lock-in or check-in — Q4 push')).toBe(true)
    const toKin = mails.find((m) => m.to === 'kin@example.com')!
    expect(words(toKin.text)).toBe(
      words(
        `Hi Kin, Sam has not locked in a plan or checked in for 3 days in "Q4 push". If that stays the same through tomorrow, the challenge closes on its own and the reminders stop. One lock-in or check-in keeps it open. ${link}`,
      ),
    )
    const toSam = mails.find((m) => m.to === 'sam@example.com')!
    expect(words(toSam.text)).toBe(
      words(
        `Hi Sam, you have not locked in a plan or checked in for 3 days in "Q4 push". If you lock in or check in today, it stays open. ${link}`,
      ),
    )
    expect((await challengeRow(t)).warning).toEqual({ userId: sam.id, missedSince: '2026-10-18', issuedAt: at('2026-10-21', '08:00', NY) })

    // Each member sees the warning as "me" or "not me", never a user id.
    const samView = (await sam.as.query(api.challenges.myChallenges, {}))[0]!.challenge
    const kinView = (await kin.as.query(api.challenges.myChallenges, {}))[0]!.challenge
    expect(samView.warning).toEqual({ forMe: true, missedSince: '2026-10-18', issuedAt: at('2026-10-21', '08:00', NY) })
    expect(kinView.warning?.forMe).toBe(false)
    expect(JSON.stringify(kinView)).not.toContain(sam.id)

    // The next sweep does not warn again; past Sam's plan deadline, no plan reminder either.
    expect(await sweepAt(t, at('2026-10-21', '08:15', NY))).toEqual([])
    expect(await sweepAt(t, at('2026-10-21', '11:00', NY))).toEqual([])
    expect(await sweepAt(t, at('2026-10-21', '13:05', NY))).toEqual([])

    // Sam locks in on the 22nd: the warning goes in the same mutation.
    vi.setSystemTime(at('2026-10-22', '07:00', NY))
    await sam.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect((await challengeRow(t)).warning).toBeUndefined()
    expect((await challengeRow(t)).status).toBe('active')
  })

  test('without an act, the sweep on the fifth day closes it, one closed email each', async () => {
    const t = convexTest(schema, modules)
    const { kin, sam, challengeId } = await pair(t)
    await kinActsThrough(t, challengeId, kin.id, 22)
    // An empty row (a planner sync, a nudge) counts as a missed day like no row at all.
    await t.run(async (ctx) => {
      await ctx.db.insert('challengeDays', {
        challengeId,
        userId: sam.id,
        date: '2026-10-19',
        summary: emptySummary(),
        summaryUpdatedAt: 0,
        dontsBroken: [],
        remindersSent: { plan: 0, checkin: 0 },
      })
    })

    expect((await sweepAt(t, at('2026-10-21', '08:00', NY))).map((m) => m.subject)).toEqual([
      'Three days without a lock-in or check-in — Q4 push',
      'Three days without a lock-in or check-in — Q4 push',
    ])
    // Through the 21st Sam is warned, so the plan reminders stay away.
    for (const hhmm of ['10:05', '12:10', '14:15', '21:40']) {
      expect(await sweepAt(t, at('2026-10-21', hhmm, NY))).toEqual([])
    }

    // 08:00 New York on the 22nd: the 18th to the 21st are four quiet days.
    const mails = await sweepAt(t, at('2026-10-22', '08:00', NY))
    expect(mails.map((m) => m.to).sort()).toEqual(['kin@example.com', 'sam@example.com'])
    expect(mails.every((m) => m.subject === 'Q4 push has closed')).toBe(true)
    const link = `${SITE}/challenge/${challengeId}`
    expect(words(mails.find((m) => m.to === 'kin@example.com')!.text)).toBe(
      words(
        `Hi Kin, "Q4 push" closed after 4 days without a lock-in or check-in from Sam. The season stays readable at ${link}. You can start a new one any time.`,
      ),
    )
    const row = await challengeRow(t)
    expect(row).toMatchObject({ status: 'ended', endedReason: 'inactive', endedAt: at('2026-10-22', '08:00', NY) })
    expect(row.warning).toMatchObject({ userId: sam.id, missedSince: '2026-10-18' })

    // Closed means quiet: nothing more, not even Kin's own plan reminder.
    expect(await sweepAt(t, at('2026-10-22', '10:05', NY))).toEqual([])
    const kinSees = (await kin.as.query(api.challenges.myChallenges, {}))[0]!.challenge
    expect(kinSees).toMatchObject({ status: 'ended', endedReason: 'inactive' })
  })

  test('a quiet member seen first with a four-day run is warned, then given a day', async () => {
    const t = convexTest(schema, modules)
    const { kin, challengeId } = await pair(t)
    await kinActsThrough(t, challengeId, kin.id, 23)
    // First sweep on the 23rd: Sam's 19th to 22nd are all quiet. Warn, do not close.
    expect((await sweepAt(t, at('2026-10-23', '08:00', NY))).map((m) => m.subject)[0]).toMatch(/^Three days/)
    expect(await sweepAt(t, at('2026-10-23', '08:15', NY))).toEqual([])
    expect((await challengeRow(t)).status).toBe('active')
    expect((await sweepAt(t, at('2026-10-24', '08:00', NY))).map((m) => m.subject)[0]).toBe('Q4 push has closed')
  })
})

describe('one missed act, one email', () => {
  test('a member in two challenges who misses the plan gets one email naming both; both rows record it', async () => {
    const t = convexTest(schema, modules)
    vi.setSystemTime(at('2026-10-22', '08:00', BERLIN))
    const kin = await signUp(t, 'kin@example.com')
    const sam = await signUp(t, 'sam@example.com')
    const ana = await signUp(t, 'ana@example.com')
    const q4 = (await kin.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })).challengeId
    const thesis = (await kin.as.mutation(api.challenges.createChallenge, { ...setup, name: 'Thesis sprint', timezone: BERLIN, displayName: 'Kin' }))
      .challengeId
    for (const [id, guest, name] of [
      [q4, sam, 'Sam'],
      [thesis, ana, 'Ana'],
    ] as const) {
      const { token } = await kin.as.mutation(api.challenges.createInvite, { challengeId: id })
      await guest.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: name })
    }

    // 10:05 Berlin is 04:05 New York: only Kin is past the plan deadline.
    const mails = await sweepAt(t, at('2026-10-22', '10:05', BERLIN))
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toBe('kin@example.com')
    expect(mails[0]!.subject).toBe("Lock in today's plan — Q4 push, Thesis sprint")
    expect(mails[0]!.text).toContain(`${SITE}/challenge/${q4}`)
    const rows = await t.run(async (ctx) => ctx.db.query('challengeDays').take(10))
    expect(rows.map((r) => [r.challengeId, r.userId, r.date, r.remindersSent.plan])).toEqual([
      [q4, kin.id, '2026-10-22', 1],
      [thesis, kin.id, '2026-10-22', 1],
    ])

    // One lock-in covers both: the next slot sends nothing.
    vi.setSystemTime(at('2026-10-22', '11:00', BERLIN))
    await kin.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect(await sweepAt(t, at('2026-10-22', '12:10', BERLIN))).toEqual([])
  })
})
