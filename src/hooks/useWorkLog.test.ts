import { describe, expect, test } from 'vitest'
import { pendingWorkLogs } from './useWorkLog'
import type { AppState, DeepWorkSession } from '../domain/types'

const TODAY = '2026-10-12'
const NOW = Date.parse('2026-10-12T15:00:00Z')

function stateWith(sessions: DeepWorkSession[], date = TODAY): AppState {
  return {
    days: {
      [date]: {
        date,
        tasks: [{ id: 't1', title: 'Thesis', isDone: false, sectionId: 'highPriority', date }],
        deepWorkSessions: sessions,
      },
    },
  }
}

const earned: DeepWorkSession = {
  id: 's1',
  label: 'Deep work block',
  durationMinutes: 50,
  startedAt: '2026-10-12T12:00:00Z',
  finishedAt: '2026-10-12T13:00:00Z',
  taskId: 't1',
}

describe('pendingWorkLogs', () => {
  test('logs an earned block under its task title, for the minutes it counted', () => {
    expect(pendingWorkLogs(stateWith([earned]), new Set(), NOW, TODAY)).toEqual([
      {
        sessionId: 's1',
        title: 'Thesis',
        startedAt: '2026-10-12T12:10:00.000Z',
        finishedAt: '2026-10-12T13:00:00.000Z',
      },
    ])
  })

  test('never logs hand-logged, cancelled or unfinished blocks', () => {
    const sessions: DeepWorkSession[] = [
      { ...earned, id: 'm', source: 'manual' },
      { ...earned, id: 'c', cancelledAt: '2026-10-12T12:30:00Z' },
      { ...earned, id: 'u', finishedAt: undefined },
    ]
    expect(pendingWorkLogs(stateWith(sessions), new Set(), NOW, TODAY)).toEqual([])
  })

  test('skips blocks already sent', () => {
    expect(pendingWorkLogs(stateWith([earned]), new Set(['s1']), NOW, TODAY)).toEqual([])
  })

  test('does not backfill old history', () => {
    const old = { ...earned, finishedAt: '2026-10-10T13:00:00Z' }
    expect(pendingWorkLogs(stateWith([old], '2026-10-11'), new Set(), NOW, TODAY)).toEqual([])
  })

  test('falls back to the session label when the task is gone', () => {
    const detached = { ...earned, taskId: 'deleted' }
    expect(pendingWorkLogs(stateWith([detached]), new Set(), NOW, TODAY)[0]!.title).toBe('Deep work block')
  })
})
