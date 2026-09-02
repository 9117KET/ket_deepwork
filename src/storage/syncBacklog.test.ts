/**
 * storage/syncBacklog.test.ts
 *
 * The two pieces that decide what a device sends to the server, and how much of
 * it at once.
 *
 * Both exist because of the same incident: the first-sign-in migration pushed
 * every day in one mutation, overran the Convex I/O quota mid-upload, and left
 * the server holding a partial history that no later edit would ever repair -
 * the write path only uploads days the user has just touched. So a day could
 * sit on one machine, look perfectly healthy there, and not exist anywhere else.
 */

import { describe, it, expect } from 'vitest'
import { buildDaysSyncPayload, isEmptyDay, MAX_DAYS_PER_SYNC } from './localStorageState'
import type { AppState, DayState, Task } from '../domain/types'

function task(id: string): Task {
  return { id, title: id, sectionId: 'highPriority', date: '2026-09-01', isDone: false }
}

function dayWith(date: string, tasks: Task[] = []): DayState {
  return { date, tasks, deepWorkSessions: [] }
}

function stateWithDays(dates: string[]): AppState {
  const days: Record<string, DayState> = {}
  for (const date of dates) days[date] = dayWith(date, [task(`t-${date}`)])
  return { days }
}

describe('buildDaysSyncPayload', () => {
  it('sends only the days that are queued', () => {
    const state = stateWithDays(['2026-09-01', '2026-09-02', '2026-09-03'])
    const payload = buildDaysSyncPayload(state, new Map(), new Set(['2026-09-02']))
    expect(payload.map((d) => d.date)).toEqual(['2026-09-02'])
  })

  it('caps the batch so a large backlog cannot arrive as one spike', () => {
    const dates = Array.from({ length: 60 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)
    const payload = buildDaysSyncPayload(stateWithDays(dates), new Map(), new Set(dates))
    expect(payload).toHaveLength(MAX_DAYS_PER_SYNC)
  })

  it('sends the newest days first, so a draining backlog reaches other devices in a useful order', () => {
    const dates = ['2026-07-01', '2026-08-15', '2026-09-02', '2026-06-10']
    const payload = buildDaysSyncPayload(stateWithDays(dates), new Map(), new Set(dates))
    expect(payload.map((d) => d.date)).toEqual(['2026-09-02', '2026-08-15', '2026-07-01', '2026-06-10'])
  })

  it('stamps the local edit time so the server staleness guard accepts the write', () => {
    const lastModified = new Map([['2026-09-02', 1_700_000]])
    const payload = buildDaysSyncPayload(
      stateWithDays(['2026-09-02']),
      lastModified,
      new Set(['2026-09-02']),
    )
    expect(payload[0]!.updatedAt).toBe(1_700_000)
  })
})

describe('isEmptyDay', () => {
  // The planner materialises a day the moment one is viewed, so without this
  // the reconcile would upload a row for every date the user ever clicked past.
  it('treats a day the user only looked at as empty', () => {
    expect(isEmptyDay(dayWith('2026-09-02'))).toBe(true)
  })

  it('does not discard a day that holds anything at all', () => {
    expect(isEmptyDay(dayWith('2026-09-02', [task('t1')]))).toBe(false)
    expect(isEmptyDay({ ...dayWith('2026-09-02'), mood: '🙂' })).toBe(false)
    expect(isEmptyDay({ ...dayWith('2026-09-02'), dayNote: 'shipped it' })).toBe(false)
    expect(isEmptyDay({ ...dayWith('2026-09-02'), sleepHours: 7 })).toBe(false)
    expect(isEmptyDay({
      ...dayWith('2026-09-02'),
      deepWorkSessions: [{ id: 's1', label: 'block', durationMinutes: 45, startedAt: '2026-09-02T07:00:00Z' }],
    })).toBe(false)
  })

  it('ignores habit rows that record only misses', () => {
    expect(isEmptyDay({ ...dayWith('2026-09-02'), habitCompletions: { h1: false } })).toBe(true)
    expect(isEmptyDay({ ...dayWith('2026-09-02'), habitCompletions: { h1: true } })).toBe(false)
  })
})
