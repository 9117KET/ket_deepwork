/**
 * convex/calendar.test.ts
 *
 * Full-flow integration tests for the Google Calendar integration, run with
 * `convex-test` (the real actions/mutations/queries from convex/calendar.ts
 * execute in-process). Google itself is mocked at the only layer where it can
 * be: the server-side global `fetch` that the Convex actions call. This is
 * NOT a browser test — Playwright's page.route() cannot intercept these calls
 * because they run inside the Convex deployment, not the page.
 *
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { ConvexError } from 'convex/values'
import { GOOGLE_RECONNECT } from './_shared/google'

// Load every Convex module so convex-test can resolve internal.* references.
const modules = import.meta.glob('./**/*.*s')

const ORIGIN = 'http://localhost:5173'
const USER = { subject: 'testuser123|session-abc' } // getUserId() strips at "|"
const CAL_ID = 'primary'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ── Google fetch mock ──────────────────────────────────────────────────────
// One router stands in for every Google endpoint the actions touch. Tests
// override fields of `mock` before invoking an action.
type MockState = {
  eventsList: unknown[]
  calendarList: Array<{ id: string; summary: string; primary?: boolean }>
  createdEvent: { id: string; etag?: string }
  createdCalendar: { id: string }
  /** Status for event POSTs, unless `postStatusQueue` has one queued. */
  postStatus: number
  postStatusQueue: number[]
  patchStatus: number
}

let mock: MockState
let fetchCalls: Array<{ url: string; method: string; body?: string }>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function installFetchMock() {
  fetchCalls = []
  const handler = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    fetchCalls.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined })

    if (url.startsWith('https://oauth2.googleapis.com/revoke')) return json({})
    if (url.startsWith(TOKEN_URL)) {
      // Serves both the auth-code exchange (reads refresh_token) and the
      // refresh-token grant (reads access_token).
      return json({ refresh_token: 'rt_test', access_token: 'at_test', expires_in: 3600 })
    }
    if (url.includes('/users/me/calendarList')) return json({ items: mock.calendarList })
    if (url.endsWith('/calendars') && method === 'POST') return json(mock.createdCalendar)
    if (url.includes('/events')) {
      if (method === 'GET') return json({ items: mock.eventsList })
      if (method === 'POST') {
        const status = mock.postStatusQueue.length > 0 ? mock.postStatusQueue.shift()! : mock.postStatus
        return status === 200 ? json(mock.createdEvent) : json({}, status)
      }
      if (method === 'PATCH') {
        return mock.patchStatus === 200 ? json(mock.createdEvent) : json({}, mock.patchStatus)
      }
      if (method === 'DELETE') return new Response(null, { status: 204 })
    }
    return json({}, 404)
  })
  vi.stubGlobal('fetch', handler)
}

/** The parsed JSON body of the most recent call matching method + URL suffix. */
function lastBody(method: string, urlSuffix: string) {
  const call = [...fetchCalls].reverse().find((c) => c.method === method && c.url.endsWith(urlSuffix))
  if (!call?.body) throw new Error(`no ${method} …${urlSuffix} call`)
  return JSON.parse(call.body)
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_B64 = '5LZtH2waT20KViaxZHVkd4Pt31jRx9XunERpUYTJmHM='
  mock = {
    eventsList: [],
    calendarList: [{ id: 'primary', summary: 'Personal', primary: true }],
    createdEvent: { id: 'gevent_new', etag: 'etag_1' },
    createdCalendar: { id: 'log_cal' },
    postStatus: 200,
    postStatusQueue: [],
    patchStatus: 200,
  }
  installFetchMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Connect a user by running the OAuth callback against the mocked token endpoint. */
async function connect(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(USER)
  await asUser.action(api.calendar.googleOauthCallback, { code: 'auth_code_xyz', origin: ORIGIN })
  return asUser
}

// ── OAuth + connection status ───────────────────────────────────────────────

describe('OAuth connect', () => {
  test('googleOauthStart builds a valid Google consent URL', async () => {
    const t = convexTest(schema, modules)
    const { url, state } = await t
      .withIdentity(USER)
      .action(api.calendar.googleOauthStart, { origin: ORIGIN })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/calendar/callback`)
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('scope')).toContain('calendar')
    expect(state).toBeTruthy()
  })

  test('callback exchanges the code, stores an (encrypted) connection', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)

    const status = await asUser.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(true)

    // The stored refresh token must be an AES-GCM envelope, never plaintext.
    await t.run(async (ctx) => {
      const conn = await ctx.db.query('googleCalendarConnections').first()
      expect(conn).not.toBeNull()
      const env = JSON.parse(conn!.encryptedRefreshToken)
      expect(env.v).toBe(1)
      expect(env.ct).not.toContain('rt_test')
      expect(conn!.encryptedRefreshToken).not.toContain('rt_test')
    })
  })

  test('callback throws when Google returns no refresh token', async () => {
    const t = convexTest(schema, modules)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ access_token: 'at_only' }), { status: 200 })),
    )
    await expect(
      t.withIdentity(USER).action(api.calendar.googleOauthCallback, { code: 'c', origin: ORIGIN }),
    ).rejects.toThrow(/refresh token/i)
  })
})

// ── Calendar list + select ────────────────────────────────────────────────

describe('list & select calendar', () => {
  test('listCalendars returns the mapped Google calendar list', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    mock.calendarList = [
      { id: 'primary', summary: 'Personal', primary: true },
      { id: 'work@x.com', summary: 'Work' },
    ]
    const list = await asUser.action(api.calendar.listCalendars, {})
    expect(list).toEqual([
      { id: 'primary', summary: 'Personal', primary: true },
      { id: 'work@x.com', summary: 'Work', primary: false },
    ])
  })

  test('a revoked or expired refresh token surfaces as a reconnect ConvexError', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'invalid_grant' }, 400)))
    const err = await asUser.action(api.calendar.listCalendars, {}).catch((e) => e)
    expect(err).toBeInstanceOf(ConvexError)
    expect((err as ConvexError<{ code: string }>).data.code).toBe(GOOGLE_RECONNECT)
  })

  test('selectCalendar persists the choice into connectionStatus', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.mutation(api.calendar.selectCalendar, {
      calendarId: CAL_ID,
      calendarSummary: 'Personal',
    })
    const status = await asUser.query(api.calendar.connectionStatus, {})
    expect(status.connected && status.selectedCalendarId).toBe(CAL_ID)
    expect(status.connected && status.selectedCalendarSummary).toBe('Personal')
  })
})

// ── Today's events (read-only) ───────────────────────────────────────────────

const TZ = 'Europe/Berlin'
const DAY = '2026-10-12'

describe('listEvents (read-only timeline)', () => {
  test('returns timed and all-day events without writing anything to the planner', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    mock.eventsList = [
      {
        id: 'e1', summary: 'Standup', htmlLink: 'https://cal/e1',
        start: { dateTime: '2026-10-12T09:00:00+02:00' }, end: { dateTime: '2026-10-12T09:15:00+02:00' },
      },
      { id: 'e2', summary: 'Holiday', start: { date: '2026-10-12' }, end: { date: '2026-10-13' } },
      { id: 'e3', status: 'cancelled' },
      {
        id: 'e4', summary: 'Thesis', start: { dateTime: '2026-10-12T10:00:00+02:00' },
        end: { dateTime: '2026-10-12T11:00:00+02:00' },
        extendedProperties: { private: { deepblockTaskId: 'task-9' } },
      },
    ]

    const events = await asUser.action(api.calendar.listEvents, { date: DAY, timezone: TZ })

    expect(events).toEqual([
      { id: 'e1', title: 'Standup', allDay: false, start: '2026-10-12T09:00:00+02:00', end: '2026-10-12T09:15:00+02:00', htmlLink: 'https://cal/e1', taskId: null },
      { id: 'e2', title: 'Holiday', allDay: true, start: null, end: null, htmlLink: null, taskId: null },
      { id: 'e4', title: 'Thesis', allDay: false, start: '2026-10-12T10:00:00+02:00', end: '2026-10-12T11:00:00+02:00', htmlLink: null, taskId: 'task-9' },
    ])
    await t.run(async (ctx) => {
      expect(await ctx.db.query('plannerDays').collect()).toHaveLength(0)
    })
  })

  test('queries the local day in the user timezone, on primary when none is selected', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.listEvents, { date: DAY, timezone: TZ })
    const list = fetchCalls.find((c) => c.url.includes('/events?'))!
    const url = new URL(list.url)
    expect(url.pathname).toContain('/calendars/primary/events')
    // Berlin is UTC+2 in October: local midnight is 22:00Z the evening before.
    expect(url.searchParams.get('timeMin')).toBe('2026-10-11T22:00:00.000Z')
  })
})

// ── Schedule a task ──────────────────────────────────────────────────────────

describe('scheduleTask', () => {
  const FUTURE = '2030-03-04' // far enough ahead that "now" never clips the window
  const base = { taskId: 'task-1', taskDate: FUTURE, title: 'Call', durationMinutes: 30, timezone: TZ }

  test('drops the task into the first free gap with a popup reminder and links it', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    // Busy 08:00–09:30 local (UTC+1 in March) → a 60m task lands at 09:30.
    mock.eventsList = [
      { start: { dateTime: '2030-03-04T07:00:00Z' }, end: { dateTime: '2030-03-04T08:30:00Z' } },
      // An all-day event must not make the whole day look full.
      { start: { date: '2030-03-04' }, end: { date: '2030-03-05' } },
    ]

    const result = await asUser.action(api.calendar.scheduleTask, {
      ...base, title: 'Write chapter 2', durationMinutes: 60,
    })

    expect(result).toMatchObject({ eventId: 'gevent_new', date: FUTURE, startTime: '09:30' })
    const body = lastBody('POST', '/events')
    expect(body.summary).toBe('Write chapter 2')
    expect(body.start.dateTime).toBe('2030-03-04T08:30:00.000Z')
    expect(body.end.dateTime).toBe('2030-03-04T09:30:00.000Z')
    expect(body.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] })
    expect(body.extendedProperties.private.deepblockTaskId).toBe('task-1')
    await t.run(async (ctx) => {
      const links = await ctx.db.query('calendarEventLinks').collect()
      expect(links).toMatchObject([{ taskId: 'task-1', taskDate: FUTURE, googleEventId: 'gevent_new' }])
    })
  })

  test('an explicit start time skips reading the calendar and goes exactly there', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    const result = await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '14:15' })
    expect(result.startTime).toBe('14:15')
    expect(fetchCalls.some((c) => c.method === 'GET' && c.url.includes('/events?'))).toBe(false)
  })

  test('scheduling an already-scheduled task moves its event instead of duplicating it', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '10:00' })
    fetchCalls = []
    await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '15:00' })

    expect(fetchCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/events'))).toHaveLength(0)
    expect(fetchCalls.filter((c) => c.method === 'PATCH')).toHaveLength(1)
    await t.run(async (ctx) => {
      expect(await ctx.db.query('calendarEventLinks').collect()).toHaveLength(1)
    })
  })

  test('re-creates the event when it was deleted in Google since', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '10:00' })
    mock.patchStatus = 404
    mock.createdEvent = { id: 'gevent_second', etag: 'e' }
    const result = await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '11:00' })
    expect(result.eventId).toBe('gevent_second')
  })

  test('says so when the day has no gap long enough', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    mock.eventsList = [{ start: { dateTime: '2030-03-04T06:00:00Z' }, end: { dateTime: '2030-03-04T21:00:00Z' } }]
    await expect(
      asUser.action(api.calendar.scheduleTask, { ...base, durationMinutes: 60 }),
    ).rejects.toThrow(/no free 60-minute slot/i)
  })

  test('unscheduleTask deletes the event and its link', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.scheduleTask, { ...base, startTime: '10:00' })
    const result = await asUser.action(api.calendar.unscheduleTask, { taskId: 'task-1', taskDate: FUTURE })
    expect(result.removed).toBe(true)
    expect(fetchCalls.some((c) => c.method === 'DELETE' && c.url.includes('/events/gevent_new'))).toBe(true)
    await t.run(async (ctx) => {
      expect(await ctx.db.query('calendarEventLinks').collect()).toHaveLength(0)
    })
  })
})

// ── Worked time → log calendar ───────────────────────────────────────────────

describe('logWorkBlock', () => {
  const block = {
    sessionId: 'session-abc',
    title: 'Write chapter 2',
    startedAt: '2030-03-04T09:00:00.000Z',
    finishedAt: '2030-03-04T10:30:00.000Z',
    timezone: TZ,
  }

  test('creates the "Deepblock log" calendar once, then writes the block to it', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)

    await asUser.action(api.calendar.logWorkBlock, block)
    await asUser.action(api.calendar.logWorkBlock, { ...block, sessionId: 'session-def' })

    expect(fetchCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/calendars'))).toHaveLength(1)
    const body = lastBody('POST', '/calendars/log_cal/events')
    expect(body.summary).toBe('✓ 90m · Write chapter 2')
    expect(body.transparency).toBe('transparent')
    expect(body.id).toMatch(/^[a-v0-9]+$/)
  })

  test('logging the same session twice is a no-op, not a duplicate', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.logWorkBlock, block)
    mock.postStatus = 409
    const again = await asUser.action(api.calendar.logWorkBlock, block)
    expect(again).toEqual({ logged: true, alreadyLogged: true })
  })

  test('recreates the log calendar if the user deleted it', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.calendar.logWorkBlock, block)
    mock.postStatusQueue = [404]
    mock.createdCalendar = { id: 'log_cal_2' }
    await asUser.action(api.calendar.logWorkBlock, { ...block, sessionId: 'session-2' })
    await t.run(async (ctx) => {
      const conn = await ctx.db.query('googleCalendarConnections').first()
      expect(conn!.logCalendarId).toBe('log_cal_2')
    })
  })

  test('rejects a block that ends before it starts', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await expect(
      asUser.action(api.calendar.logWorkBlock, { ...block, finishedAt: block.startedAt }),
    ).rejects.toThrow(/start before its finish/)
  })
})

// ── Disconnect ───────────────────────────────────────────────────────────────

describe('disconnect', () => {
  test('revokes the token at Google and removes the connection and all event links', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })
    await t.run(async (ctx) => {
      await ctx.db.insert('calendarEventLinks', {
        userId: 'testuser123', taskId: 'task1', taskDate: '2026-06-20', googleCalendarId: CAL_ID, googleEventId: 'g1',
      })
    })

    fetchCalls = []
    await asUser.action(api.calendar.disconnectGoogle, {})

    // The refresh token must be revoked at Google, not just deleted locally.
    const revokes = fetchCalls.filter((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke'))
    expect(revokes).toHaveLength(1)
    expect(revokes[0].method).toBe('POST')

    const status = await asUser.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(false)
    await t.run(async (ctx) => {
      expect(await ctx.db.query('googleCalendarConnections').collect()).toHaveLength(0)
      expect(await ctx.db.query('calendarEventLinks').collect()).toHaveLength(0)
    })
  })

  test('still disconnects when the revoke call fails', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
        throw new Error('network down')
      }
      return realFetch(input, init)
    }))

    await asUser.action(api.calendar.disconnectGoogle, {})

    const status = await asUser.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(false)
  })
})

// ── Auth guards (every entry point must reject anonymous callers) ─────────────

describe('auth guards', () => {
  test('all calendar entry points reject unauthenticated callers', async () => {
    const t = convexTest(schema, modules)
    await expect(t.action(api.calendar.googleOauthStart, { origin: ORIGIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.googleOauthCallback, { code: 'c', origin: ORIGIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.listCalendars, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.listEvents, { date: '2026-10-12', timezone: 'UTC' })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.scheduleTask, { taskId: 't', taskDate: '2026-10-12', title: 'x', durationMinutes: 30, timezone: 'UTC' })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.unscheduleTask, { taskId: 't', taskDate: '2026-10-12' })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.logWorkBlock, { sessionId: 's', title: 'x', startedAt: 'a', finishedAt: 'b', timezone: 'UTC' })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.disconnectGoogle, {})).rejects.toThrow(/not authenticated/i)

    // The public connection-status query must not leak: anonymous = not connected.
    const status = await t.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(false)
  })
})
