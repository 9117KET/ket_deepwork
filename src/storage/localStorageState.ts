/**
 * storage/localStorageState.ts
 *
 * Small persistence layer that keeps the app's state in localStorage.
 * This isolates browser APIs from the rest of the app and makes it
 * easier to swap in a real backend later.
 */

import { useEffect, useState } from 'react'
import type { AppState, DayState } from '../domain/types'
import { todayIso } from '../domain/dateUtils'

const STORAGE_KEY = 'ket_deepwork_state_v1'
const SCHEMA_VERSION = 1

interface PersistedStateV1 {
  version: number
  state: AppState
}

const EMPTY_STATE: AppState = {
  days: {},
}

function safeParse(raw: string | null): PersistedStateV1 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedStateV1
    if (typeof parsed.version !== 'number' || typeof parsed.state !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function migrate(persisted: PersistedStateV1 | null): AppState {
  if (!persisted) {
    return EMPTY_STATE
  }

  if (persisted.version === SCHEMA_VERSION) {
    return persisted.state
  }

  // For now we only have v1; future versions can add migration logic here.
  return persisted.state ?? EMPTY_STATE
}

function readInitialState(): AppState {
  if (typeof window === 'undefined') {
    return EMPTY_STATE
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  return migrate(parsed)
}

function writeState(next: AppState) {
  if (typeof window === 'undefined') {
    return
  }

  const wrapped: PersistedStateV1 = {
    version: SCHEMA_VERSION,
    state: next,
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
  } catch {
    // If storage fails (quota, private mode, etc.) we silently ignore it.
  }
}

export function usePersistentState(): [AppState, (updater: (prev: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => readInitialState())

  useEffect(() => {
    writeState(state)
  }, [state])

  const update = (updater: (prev: AppState) => AppState) => {
    setState((prev) => updater(prev))
  }

  return [state, update]
}

export function getOrCreateDay(state: AppState, isoDay: string = todayIso()): DayState {
  const existing = state.days[isoDay]
  if (existing) return existing

  const day: DayState = {
    date: isoDay,
    tasks: [],
    deepWorkSessions: [],
  }

  return day
}

