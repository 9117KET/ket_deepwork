/**
 * convex/reminders.test.ts
 *
 * The cron's sweep and the nudge, end to end against a mocked nodemailer.
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import schema from './schema'
import { api, internal } from './_generated/api'
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
  goals: [],
  donts: ['No doomscrolling'],
  planDeadline: '10:00',
  checkinDeadline: '23:59',
}

async function signUp(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run(async (ctx) => ctx.db.insert('users', { email }))
  return { id, as: t.withIdentity({ subject: `${id}|s1` }) }
}

async function pair(t: ReturnType<typeof convexTest>) {
  const a = await signUp(t, 'a@example.com')
  const b = await signUp(t, 'b@example.com')
  await a.as.mutation(api.challenges.createChallenge, { ...setup, timezone: BERLIN, displayName: 'Kin' })
  const { token } = await a.as.mutation(api.challenges.createInvite, {})
  await b.as.mutation(api.challenges.acceptInvite, { token, timezone: NY, displayName: 'Sam' })
  return { a, b }
}

beforeEach(() => {
  process.env.GMAIL_SMTP_USER = 'sender@example.com'
  process.env.GMAIL_SMTP_APP_PASSWORD = 'app-password'
  process.env.SITE_URL = 'https://ket-deepwork.vercel.app'
  sendMail.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('claimDueReminders', () => {
  test('only the member whose own clock is past the deadline is due; repeats are spaced and capped', async () => {
    const t = convexTest(schema, modules)
    await pair(t)
    const ten05 = at('2026-10-22', '10:05', BERLIN)

    const first = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 })
    expect(first).toEqual([{ to: 'a@example.com', kind: 'plan', displayName: 'Kin', challengeName: 'Q4 push', localDate: '2026-10-22' }])

    const rows = await t.run(async (ctx) => ctx.db.query('challengeDays').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ date: '2026-10-22', remindersSent: { plan: 1, checkin: 0, lastAt: ten05 } })

    expect(await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 + 30 * 60_000 })).toEqual([])
    expect(await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 + 120 * 60_000 })).toHaveLength(1)
    expect(await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 + 240 * 60_000 })).toHaveLength(1)
    // 16:05 Berlin is 10:05 New York: Kin's fourth, Sam's first.
    const fourth = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 + 360 * 60_000 })
    expect(fourth.map((r) => r.displayName).sort()).toEqual(['Kin', 'Sam'])
    // Four is the cap for Kin; two hours on, only Sam is due again.
    const fifth = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: ten05 + 480 * 60_000 })
    expect(fifth).toEqual([{ to: 'b@example.com', kind: 'plan', displayName: 'Sam', challengeName: 'Q4 push', localDate: '2026-10-22' }])
  })

  test('a locked-in plan is left alone; the evening chases the check-in', async () => {
    const t = convexTest(schema, modules)
    // Lock-in takes only the member's own today.
    vi.useFakeTimers({ now: at('2026-10-22', '09:00', BERLIN), toFake: ['Date'] })
    const { a } = await pair(t)
    await a.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    expect(await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '10:05', BERLIN) })).toEqual([])

    const kin = (rows: Array<{ to: string }>) => rows.filter((r) => r.to === 'a@example.com')
    const evening = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '21:35', BERLIN) })
    expect(kin(evening)).toMatchObject([{ kind: 'checkin', localDate: '2026-10-22' }])

    await a.as.mutation(api.challenges.checkIn, { date: '2026-10-22', summary: emptySummary(), dontsBroken: [] })
    const late = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2026-10-22', '23:05', BERLIN) })
    expect(kin(late)).toEqual([])
  })

  test('a challenge everyone has outlived is ended and never emailed', async () => {
    const t = convexTest(schema, modules)
    await pair(t)
    const due = await t.mutation(internal.challengesInternal.claimDueReminders, { nowMs: at('2027-01-02', '12:00', BERLIN) })
    expect(due).toEqual([])
    const [challenge] = await t.run(async (ctx) => ctx.db.query('challenges').collect())
    expect(challenge?.status).toBe('ended')
  })
})

describe('sweep', () => {
  test('sends one email per due member, from the users table, linking to the site', async () => {
    const t = convexTest(schema, modules)
    await pair(t)
    vi.useFakeTimers({ now: at('2026-10-22', '10:05', BERLIN) })
    const result = await t.action(internal.reminders.sweep, {})
    expect(result).toEqual({ due: 1, sent: 1 })
    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = sendMail.mock.calls[0]![0] as unknown as { to: string; subject: string; text: string; from: string }
    expect(mail.to).toBe('a@example.com')
    expect(mail.from).toContain('sender@example.com')
    expect(mail.subject).toMatch(/lock in today's plan/i)
    expect(mail.text).toContain('https://ket-deepwork.vercel.app/challenge')
  })

  test('a failed send is counted, not retried, and does not stop the others', async () => {
    const t = convexTest(schema, modules)
    await pair(t)
    // 18:05 Berlin: Kin is on the fourth reminder slot, Sam (12:05 NY) on the first.
    await t.run(async (ctx) => {
      const [challenge] = await ctx.db.query('challenges').collect()
      const members = await ctx.db.query('challengeMembers').collect()
      const kin = members.find((m) => m.displayName === 'Kin')!
      await ctx.db.insert('challengeDays', {
        challengeId: challenge!._id,
        userId: kin.userId,
        date: '2026-10-22',
        summary: emptySummary(),
        summaryUpdatedAt: 0,
        dontsBroken: [],
        remindersSent: { plan: 3, checkin: 0, lastAt: at('2026-10-22', '14:05', BERLIN) },
      })
    })
    sendMail.mockRejectedValueOnce(new Error('SMTP down'))
    vi.useFakeTimers({ now: at('2026-10-22', '18:05', BERLIN) })
    const result = await t.action(internal.reminders.sweep, {})
    expect(result).toEqual({ due: 2, sent: 1 })
    expect(sendMail).toHaveBeenCalledTimes(2)
  })
})

describe('nudgePartner', () => {
  test('emails the partner, an hour apart, while they still owe the day something', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    vi.useFakeTimers({ now: at('2026-10-22', '11:00', BERLIN) })
    await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = sendMail.mock.calls[0]![0] as unknown as { to: string; subject: string }
    expect(mail.to).toBe('b@example.com')
    expect(mail.subject).toMatch(/Kin is nudging you/)

    vi.setSystemTime(at('2026-10-22', '11:10', BERLIN))
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/again in/i)

    // Sam locks in (on Sam's own date); a nudge from Kin tomorrow is refused for a different reason.
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    vi.setSystemTime(at('2026-10-23', '11:00', BERLIN))
    // 11:00 Berlin on the 23rd is 05:00 New York on the 23rd: Sam's new day, nothing locked in yet.
    await a.as.mutation(api.challenges.nudgePartner, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  test('refused when the partner has already done the thing', async () => {
    const t = convexTest(schema, modules)
    const { a, b } = await pair(t)
    vi.useFakeTimers({ now: at('2026-10-22', '11:00', BERLIN) })
    await b.as.mutation(api.challenges.lockInPlan, { date: '2026-10-22', summary: emptySummary() })
    await expect(a.as.mutation(api.challenges.nudgePartner, {})).rejects.toThrow(/already locked in/i)
    expect(sendMail).not.toHaveBeenCalled()
  })
})
