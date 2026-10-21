/**
 * convex/tasks.test.ts
 *
 * Planner tasks ↔ Google Tasks, run with convex-test against a mocked Google
 * (the server-side `fetch`), the same way convex/calendar.test.ts does.
 *
 * Run with: npm run test:convex
 */
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { ConvexError } from 'convex/values'
import { GOOGLE_CALENDAR_SCOPE, GOOGLE_RECONNECT, GOOGLE_TASKS_SCOPE } from './_shared/google'

const modules = import.meta.glob('./**/*.*s')

const ORIGIN = 'http://localhost:5173'
const USER = { subject: 'testuser123|session-abc' }
const DATE = '2026-10-21'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TASKS = 'https://tasks.googleapis.com/tasks/v1'

type GTask = { id: string; title: string; status: string; due?: string; parent?: string; deleted?: boolean }

/** An in-memory Google Tasks: one list, created on demand. */
let store: Map<string, GTask>
let listId: string | null
let nextId: number
let tokenScope: string
let fetchCalls: Array<{ url: string; method: string; body?: string }>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function installFetchMock() {
  fetchCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = (init?.method ?? 'GET').toUpperCase()
      const bodyText = typeof init?.body === 'string' ? init.body : undefined
      fetchCalls.push({ url: url.toString(), method, body: bodyText })
      const body = bodyText ? JSON.parse(bodyText) : {}

      if (url.toString().startsWith(TOKEN_URL)) {
        return json({ refresh_token: 'rt_test', access_token: 'at_test', expires_in: 3600, scope: tokenScope })
      }
      if (!url.toString().startsWith(TASKS)) return json({}, 404)
      if (!tokenScope.includes(GOOGLE_TASKS_SCOPE)) return json({ error: { code: 403 } }, 403)

      if (url.pathname.endsWith('/users/@me/lists') && method === 'POST') {
        listId = `list_${++nextId}`
        store = new Map()
        return json({ id: listId, title: body.title })
      }
      const m = url.pathname.match(/\/lists\/([^/]+)\/tasks(?:\/([^/]+))?$/)
      if (!m) return json({}, 404)
      const [, list, taskId] = m
      if (list !== listId) return json({}, 404)

      if (!taskId && method === 'GET') {
        const due = url.searchParams.get('dueMin')
        const items = [...store.values()].filter((t) => !t.deleted && (!due || t.due === due))
        return json({ items })
      }
      if (!taskId && method === 'POST') {
        const task: GTask = { id: `g_${++nextId}`, title: body.title, status: body.status ?? 'needsAction', due: body.due }
        const parent = url.searchParams.get('parent')
        if (parent) task.parent = parent
        store.set(task.id, task)
        return json(task)
      }
      const existing = taskId ? store.get(taskId) : undefined
      if (!existing || existing.deleted) return json({}, 404)
      if (method === 'GET') return json(existing)
      if (method === 'PATCH') {
        Object.assign(existing, body)
        return json(existing)
      }
      if (method === 'DELETE') {
        existing.deleted = true
        return new Response(null, { status: 204 })
      }
      return json({}, 404)
    }),
  )
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_B64 = '5LZtH2waT20KViaxZHVkd4Pt31jRx9XunERpUYTJmHM='
  store = new Map()
  listId = null
  nextId = 0
  tokenScope = `${GOOGLE_CALENDAR_SCOPE} ${GOOGLE_TASKS_SCOPE}`
  installFetchMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function connect(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(USER)
  await asUser.action(api.calendar.googleOauthCallback, { code: 'auth_code_xyz', origin: ORIGIN })
  return asUser
}

const calls = (method: string, re: RegExp) => fetchCalls.filter((c) => c.method === method && re.test(c.url))
const writes = () => fetchCalls.filter((c) => c.method !== 'GET' && c.url.startsWith(TASKS))

const write = { id: 't1', title: 'Write chapter 2', isDone: false }
const review = { id: 't2', title: 'Review notes', isDone: true }

describe('connection status', () => {
  test('a grant with the tasks scope enables task sync; one without does not', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    expect(await asUser.query(api.calendar.connectionStatus, {})).toMatchObject({ connected: true, tasksEnabled: true })

    tokenScope = GOOGLE_CALENDAR_SCOPE
    const t2 = convexTest(schema, modules)
    const older = await connect(t2)
    expect(await older.query(api.calendar.connectionStatus, {})).toMatchObject({ connected: true, tasksEnabled: false })
    await expect(older.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })).rejects.toSatisfy(
      (e: unknown) => e instanceof ConvexError && (e.data as { code: string }).code === GOOGLE_RECONNECT,
    )
    expect(writes()).toHaveLength(0)
  })
})

describe('syncDayTasks', () => {
  test('first sync creates the "Deepblock" list once and mirrors every task, due on its day', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)

    const r1 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write, review] })
    expect(r1).toEqual({ pulls: [], inserted: 2, pushed: 0 })
    expect(calls('POST', /\/users\/@me\/lists$/)).toHaveLength(1)
    const mirrored = [...store.values()]
    expect(mirrored.map((g) => [g.title, g.status, g.due])).toEqual([
      ['Write chapter 2', 'needsAction', `${DATE}T00:00:00.000Z`],
      ['Review notes', 'completed', `${DATE}T00:00:00.000Z`],
    ])

    // Nothing changed: the second pass reads, and writes nothing.
    const before = writes().length
    const r2 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write, review] })
    expect(r2).toEqual({ pulls: [], inserted: 0, pushed: 0 })
    expect(writes().length).toBe(before)
    expect(calls('POST', /\/users\/@me\/lists$/)).toHaveLength(1)
  })

  test('a subtask is created under its parent', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    const child = { id: 'c1', title: 'Outline', isDone: false, parentId: 't1' }
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [child, write] })
    const parent = [...store.values()].find((g) => g.title === 'Write chapter 2')!
    const sub = [...store.values()].find((g) => g.title === 'Outline')!
    expect(sub.parent).toBe(parent.id)
  })

  test('ticked in the planner → completed in Google', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })

    const r = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [{ ...write, isDone: true }] })
    expect(r).toEqual({ pulls: [], inserted: 0, pushed: 1 })
    expect([...store.values()][0]!.status).toBe('completed')
    expect(JSON.parse(calls('PATCH', /\/tasks\/g_/)[0]!.body!)).toEqual({ status: 'completed' })
  })

  test('un-ticked in the planner → needsAction in Google, with the completion cleared', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [review] })
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [{ ...review, isDone: false }] })
    expect(JSON.parse(calls('PATCH', /\/tasks\/g_/)[0]!.body!)).toEqual({ status: 'needsAction', completed: null })
  })

  test('ticked in Google → pulled into the planner, and not pushed back', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    const g = [...store.values()][0]!
    g.status = 'completed'

    // The planner still says not done: Google's tick wins, nothing is written.
    const r1 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r1.pulls).toEqual([{ taskId: 't1', isDone: true }])
    expect(calls('PATCH', /./)).toHaveLength(0)
    expect(g.status).toBe('completed')

    // Until the planner has applied it, it keeps being offered…
    const r2 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r2.pulls).toEqual([{ taskId: 't1', isDone: true }])

    // …and once applied, both sides agree and it stops.
    const r3 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [{ ...write, isDone: true }] })
    expect(r3).toEqual({ pulls: [], inserted: 0, pushed: 0 })
    // Un-ticking in the planner now goes back to Google rather than being
    // mistaken for a stale planner state.
    const r4 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r4).toEqual({ pulls: [], inserted: 0, pushed: 1 })
    expect(g.status).toBe('needsAction')
  })

  test('renamed in Google → the new title comes back; renamed in both → the planner wins', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    const g = [...store.values()][0]!
    g.title = 'Write chapter two'

    const r1 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r1.pulls).toEqual([{ taskId: 't1', title: 'Write chapter two' }])

    const r2 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [{ ...write, title: 'Ch. 2' }] })
    expect(r2.pulls).toEqual([])
    expect(g.title).toBe('Ch. 2')
  })

  test('deleted in Google → the planner task is left alone and never mirrored again', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    store.clear()

    const r1 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r1).toEqual({ pulls: [], inserted: 0, pushed: 0 })
    const r2 = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [{ ...write, isDone: true }] })
    expect(r2).toEqual({ pulls: [], inserted: 0, pushed: 0 })
    expect(store.size).toBe(0)
  })

  test('a task missing from the sync (deleted, or mid-undo) is not deleted in Google', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write, review] })
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [review] })
    expect(calls('DELETE', /./)).toHaveLength(0)
    expect(store.size).toBe(2)
  })

  test('the whole list deleted in Google → a new list, tasks mirrored again', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    listId = 'list_deleted_by_user'

    const r = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    expect(r.inserted).toBe(1)
    expect(calls('POST', /\/users\/@me\/lists$/)).toHaveLength(2)
    expect([...store.values()].map((g) => g.title)).toEqual(['Write chapter 2'])
  })

  test('a connection whose grant lost the tasks scope is told to reconnect', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    // Granted at connect time, then revoked by the user in their Google account.
    tokenScope = GOOGLE_CALENDAR_SCOPE
    await expect(asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })).rejects.toSatisfy(
      (e: unknown) => e instanceof ConvexError && (e.data as { code: string }).code === GOOGLE_RECONNECT,
    )
  })
})

describe('removeTask', () => {
  test('deletes the Google Task and its link; a later sync does not bring it back', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write, review] })

    expect(await asUser.action(api.tasks.removeTask, { taskId: 't1', taskDate: DATE })).toEqual({ removed: true })
    expect([...store.values()].filter((g) => !g.deleted).map((g) => g.title)).toEqual(['Review notes'])

    const r = await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [review] })
    expect(r).toEqual({ pulls: [], inserted: 0, pushed: 0 })
    // Unknown task: nothing to do, no error.
    expect(await asUser.action(api.tasks.removeTask, { taskId: 'nope', taskDate: DATE })).toEqual({ removed: false })
  })

  test('disconnecting drops the task links', async () => {
    const t = convexTest(schema, modules)
    const asUser = await connect(t)
    await asUser.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [write] })
    await asUser.action(api.calendar.disconnectGoogle, {})
    expect(await t.run(async (ctx) => await ctx.db.query('googleTaskLinks').collect())).toHaveLength(0)
  })
})

describe('auth guards', () => {
  test('task entry points reject unauthenticated callers', async () => {
    const t = convexTest(schema, modules)
    await expect(t.action(api.tasks.syncDayTasks, { taskDate: DATE, tasks: [] })).rejects.toThrow(/not authenticated/i)
    await expect(t.action(api.tasks.removeTask, { taskId: 't', taskDate: DATE })).rejects.toThrow(/not authenticated/i)
  })
})
