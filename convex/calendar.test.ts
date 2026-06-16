/**
 * convex/calendar.test.ts
 *
 * Full-flow integration tests for the Google Calendar sync engine, run with
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

// Load every Convex module so convex-test can resolve internal.* references.
const modules = import.meta.glob('./**/*.*s')

const ORIGIN = 'http://localhost:5173'
const USER = { subject: 'testuser123|session-abc' } // getUserId() strips at "|"
const CAL_ID = 'primary'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ── Google fetch mock ──────────────────────────────────────────────────────
// One router stands in for every Google endpoint the actions touch. Tests can
// override `eventsList` / `createdEvent` etc. before invoking an action.
type MockState = {
  eventsList: unknown[]
  calendarList: Array<{ id: string; summary: string; primary?: boolean }>
  createdEvent: { id: string; etag?: string }
  updatedEvent: { etag?: string }
  putStatus: number
  postStatus: number
}

let mock: MockState
let fetchCalls: Array<{ url: string; method: string }>

function installFetchMock() {
  fetchCalls = []
  const handler = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    fetchCalls.push({ url, method })

    if (url.startsWith(TOKEN_URL)) {
      // Serves both the auth-code exchange (reads refresh_token) and the
      // refresh-token grant (reads access_token).
      return new Response(
        JSON.stringify({ refresh_token: 'rt_test', access_token: 'at_test', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.includes('/users/me/calendarList')) {
      return new Response(JSON.stringify({ items: mock.calendarList }), { status: 200 })
    }
    // Events: distinguish list (GET .../events?…), create (POST .../events),
    // update (PUT .../events/<id>).
    if (url.includes('/events')) {
      if (method === 'GET') {
        return new Response(JSON.stringify({ items: mock.eventsList }), { status: 200 })
      }
      if (method === 'POST') {
        if (mock.postStatus !== 200) return new Response('{}', { status: mock.postStatus })
        return new Response(JSON.stringify(mock.createdEvent), { status: 200 })
      }
      if (method === 'PUT') {
        if (mock.putStatus !== 200) return new Response('{}', { status: mock.putStatus })
        return new Response(JSON.stringify(mock.updatedEvent), { status: 200 })
      }
    }
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', handler)
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_B64 = '5LZtH2waT20KViaxZHVkd4Pt31jRx9XunERpUYTJmHM='
  mock = {
    eventsList: [],
    calendarList: [{ id: 'primary', summary: 'Personal', primary: true }],
    createdEvent: { id: 'gevent_new', etag: 'etag_1' },
    updatedEvent: { etag: 'etag_2' },
    putStatus: 200,
    postStatus: 200,
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

// ── Import (Google → planner) ────────────────────────────────────────────────

describe('syncFromGoogle (import)', () => {
  async function connectAndSelect(t: ReturnType<typeof convexTest>) {
    const asUser = await connect(t)
    await asUser.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })
    return asUser
  }

  test('imports timed events as highPriority tasks and skips all-day events', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connectAndSelect(t)
    mock.eventsList = [
      {
        id: 'g1',
        summary: 'Deep work block',
        etag: 'e1',
        start: { dateTime: '2026-06-20T09:00:00Z' },
        end: { dateTime: '2026-06-20T10:30:00Z' },
      },
      { id: 'g2', summary: 'All day offsite', start: { date: '2026-06-21' }, end: { date: '2026-06-22' } },
    ]

    const res = await asUser.action(api.calendar.syncFromGoogle, {
      startDate: '2026-06-20',
      endDate: '2026-06-21',
      timezone: 'UTC',
    })
    expect(res.imported).toBe(1)

    await t.run(async (ctx) => {
      const day = await ctx.db
        .query('plannerDays')
        .filter((q) => q.eq(q.field('date'), '2026-06-20'))
        .first()
      expect(day).not.toBeNull()
      const tasks = day!.tasks as Array<Record<string, unknown>>
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Deep work block')
      expect(tasks[0].sectionId).toBe('highPriority')
      expect(tasks[0].scheduledAt).toBe('09:00')
      expect(tasks[0].durationMinutes).toBe(90)
    })
  })

  test('re-importing the same event updates the linked task, not duplicates it', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connectAndSelect(t)
    mock.eventsList = [
      {
        id: 'g1',
        summary: 'Original',
        etag: 'e1',
        start: { dateTime: '2026-06-20T09:00:00Z' },
        end: { dateTime: '2026-06-20T10:00:00Z' },
      },
    ]
    const first = await asUser.action(api.calendar.syncFromGoogle, {
      startDate: '2026-06-20',
      endDate: '2026-06-20',
      timezone: 'UTC',
    })
    expect(first.imported).toBe(1)

    // Same event id, new title — should update, not add a second task.
    mock.eventsList = [
      {
        id: 'g1',
        summary: 'Renamed',
        etag: 'e2',
        start: { dateTime: '2026-06-20T09:00:00Z' },
        end: { dateTime: '2026-06-20T10:00:00Z' },
      },
    ]
    const second = await asUser.action(api.calendar.syncFromGoogle, {
      startDate: '2026-06-20',
      endDate: '2026-06-20',
      timezone: 'UTC',
    })
    expect(second.imported).toBe(0)

    await t.run(async (ctx) => {
      const day = await ctx.db
        .query('plannerDays')
        .filter((q) => q.eq(q.field('date'), '2026-06-20'))
        .first()
      const tasks = day!.tasks as Array<Record<string, unknown>>
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Renamed')
    })
  })

  test('throws when no calendar has been selected', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t) // connected but no selectCalendar
    await expect(
      asUser.action(api.calendar.syncFromGoogle, { timezone: 'UTC' }),
    ).rejects.toThrow(/no calendar selected/i)
  })
})

// ── Push (planner → Google) ───────────────────────────────────────────────

describe('syncToGoogle (push)', () => {
  async function seedSchedulableTask(t: ReturnType<typeof convexTest>) {
    const asUser = await connect(t)
    await asUser.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })
    await t.run(async (ctx) => {
      await ctx.db.insert('plannerDays', {
        userId: 'testuser123',
        date: '2026-06-20',
        deepWorkSessions: [],
        tasks: [
          { id: 'task1', title: 'Write report', sectionId: 'highPriority', date: '2026-06-20', isDone: false, scheduledAt: '14:00', durationMinutes: 60 },
          // No scheduledAt → not schedulable, must be ignored.
          { id: 'task2', title: 'Random idea', sectionId: 'lowPriority', date: '2026-06-20', isDone: false },
          // Has a parent → must be ignored.
          { id: 'task3', title: 'Subtask', sectionId: 'highPriority', date: '2026-06-20', isDone: false, scheduledAt: '15:00', durationMinutes: 30, parentId: 'task1' },
        ],
      })
    })
    return asUser
  }

  test('creates a Google event for a schedulable task and stores the link', async () => {
    const t = convexTest(schema, modules)
    const asUser = await seedSchedulableTask(t)

    const res = await asUser.action(api.calendar.syncToGoogle, {
      startDate: '2026-06-20',
      endDate: '2026-06-20',
      timezone: 'UTC',
    })
    expect(res.created).toBe(1)
    expect(res.updated).toBe(0)

    // Exactly one event create call, and a link row now exists.
    const posts = fetchCalls.filter((c) => c.method === 'POST' && c.url.includes('/events'))
    expect(posts).toHaveLength(1)
    await t.run(async (ctx) => {
      const links = await ctx.db.query('calendarEventLinks').collect()
      expect(links).toHaveLength(1)
      expect(links[0].googleEventId).toBe('gevent_new')
      expect(links[0].taskId).toBe('task1')
    })
  })

  test('updates (PUT) instead of creating when a link already exists', async () => {
    const t = convexTest(schema, modules)
    const asUser = await seedSchedulableTask(t)
    await asUser.action(api.calendar.syncToGoogle, { startDate: '2026-06-20', endDate: '2026-06-20', timezone: 'UTC' })

    fetchCalls = []
    const res = await asUser.action(api.calendar.syncToGoogle, {
      startDate: '2026-06-20',
      endDate: '2026-06-20',
      timezone: 'UTC',
    })
    expect(res.created).toBe(0)
    expect(res.updated).toBe(1)
    const puts = fetchCalls.filter((c) => c.method === 'PUT')
    expect(puts).toHaveLength(1)
  })

  test('counts a task as skipped when Google rejects the create', async () => {
    const t = convexTest(schema, modules)
    const asUser = await seedSchedulableTask(t)
    mock.postStatus = 500
    const res = await asUser.action(api.calendar.syncToGoogle, { startDate: '2026-06-20', endDate: '2026-06-20', timezone: 'UTC' })
    expect(res.created).toBe(0)
    expect(res.skipped).toBe(1)
  })
})

// ── Disconnect ───────────────────────────────────────────────────────────────

describe('disconnect', () => {
  test('removes the connection and all event links', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })
    await t.run(async (ctx) => {
      await ctx.db.insert('calendarEventLinks', {
        userId: 'testuser123', taskId: 'task1', taskDate: '2026-06-20', googleCalendarId: CAL_ID, googleEventId: 'g1',
      })
    })

    await asUser.mutation(api.calendar.disconnectGoogle, {})

    const status = await asUser.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(false)
    await t.run(async (ctx) => {
      expect(await ctx.db.query('googleCalendarConnections').collect()).toHaveLength(0)
      expect(await ctx.db.query('calendarEventLinks').collect()).toHaveLength(0)
    })
  })
})

// ── Auth guards (every entry point must reject anonymous callers) ─────────────

describe('auth guards', () => {
  test('all calendar entry points reject unauthenticated callers', async () => {
    const t = convexTest(schema, modules)
    await expect(t.action(api.calendar.googleOauthStart, { origin: ORIGIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.googleOauthCallback, { code: 'c', origin: ORIGIN })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.listCalendars, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.syncFromGoogle, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.calendar.syncToGoogle, {})).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.calendar.selectCalendar, { calendarId: CAL_ID })).rejects.toThrow(/not authenticated/i)
    await expect(t.mutation(api.calendar.disconnectGoogle, {})).rejects.toThrow(/not authenticated/i)

    // The public connection-status query must not leak: anonymous = not connected.
    const status = await t.query(api.calendar.connectionStatus, {})
    expect(status.connected).toBe(false)
  })
})
