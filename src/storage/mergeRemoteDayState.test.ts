import { describe, it, expect } from 'vitest'
import { mergeRemoteDayState } from './localStorageState'
import type { DayState, Task } from '../domain/types'

function makeDay(overrides: Partial<DayState> = {}): DayState {
  return {
    date: '2026-05-12',
    tasks: [],
    deepWorkSessions: [],
    ...overrides,
  }
}

function task(id: string): Task {
  return { id, title: id, sectionId: 'highPriority', date: '2026-05-12', isDone: false }
}

describe('mergeRemoteDayState', () => {
  it('uses remote tasks when local and remote have the same task IDs', () => {
    const t = task('t1')
    const local = makeDay({ tasks: [{ ...t, title: 'local title' }] })
    const remote = makeDay({ tasks: [{ ...t, title: 'remote title' }] })
    expect(mergeRemoteDayState(local, remote).tasks[0]!.title).toBe('remote title')
  })

  it('preserves local tasks when local has unsynced IDs not in remote', () => {
    const synced = task('synced')
    const unsynced = task('unsynced')
    const local = makeDay({ tasks: [synced, unsynced] })
    const remote = makeDay({ tasks: [synced] })
    const merged = mergeRemoteDayState(local, remote)
    expect(merged.tasks).toEqual(local.tasks)
  })

  it('uses remote tasks once all local IDs are present in remote', () => {
    const t1 = task('t1')
    const t2 = task('t2')
    const local = makeDay({ tasks: [t1] })
    const remote = makeDay({ tasks: [t1, t2] })
    const merged = mergeRemoteDayState(local, remote)
    expect(merged.tasks).toEqual([t1, t2])
  })

  it('remote fields take precedence for non-task fields', () => {
    const local = makeDay({ wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30' })
    const remote = makeDay({ wakeTime: '06:30', sleepTarget: '22:30' })
    const merged = mergeRemoteDayState(local, remote)
    expect(merged.wakeTime).toBe('06:30')
    expect(merged.sleepTarget).toBe('22:30')
  })

  it('falls back to local value when remote field is null/undefined', () => {
    const local = makeDay({ wakeTime: '07:00', bedTime: '22:30' })
    const remote = makeDay({ wakeTime: undefined, bedTime: null })
    const merged = mergeRemoteDayState(local, remote)
    expect(merged.wakeTime).toBe('07:00')
    expect(merged.bedTime).toBe('22:30')
  })

  it('handles empty local and remote tasks', () => {
    const merged = mergeRemoteDayState(makeDay(), makeDay())
    expect(merged.tasks).toEqual([])
  })
})
