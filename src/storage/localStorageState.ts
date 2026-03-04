/**
 * storage/localStorageState.ts
 *
 * Persistence layer that keeps the app's state in localStorage for guests
 * and syncs to Supabase when a user is signed in.
 * This isolates browser APIs and backend APIs from the rest of the app.
 */

import { useEffect, useState } from 'react'
import type { AppState, DayState } from '../domain/types'
import { todayIso } from '../domain/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { fetchPlannerState, upsertPlannerDays } from './supabasePlanner'

const STORAGE_KEY = 'deepblock_state_v1'
/** Legacy key from before the Deepblock rename; used once to migrate existing data. */
const LEGACY_STORAGE_KEY = 'ket_deepwork_state_v1'
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
  let state = migrate(parsed)

  // One-time migration from ket_deepwork → Deepblock rename.
  // Note: localStorage is per-origin. Data on localhost never exists on production (different origin).
  // If legacy key exists here and has data, merge it in so no progress is lost on this browser.
  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  const legacyParsed = safeParse(legacyRaw)
  const legacyState = migrate(legacyParsed)
  const legacyHasDays = legacyState.days && Object.keys(legacyState.days).length > 0
  if (legacyHasDays) {
    const currentDays = state.days ?? {}
    const legacyDays = legacyState.days ?? {}
    let merged = false
    const mergedDays = { ...currentDays }
    for (const [date, dayState] of Object.entries(legacyDays)) {
      if (!dayState) continue
      if (!mergedDays[date] || (dayState.tasks?.length ?? 0) > (mergedDays[date].tasks?.length ?? 0)) {
        mergedDays[date] = dayState
        merged = true
      }
    }
    if (merged || Object.keys(currentDays).length === 0) {
      state = { ...state, days: mergedDays }
      const wrapped: PersistedStateV1 = {
        version: SCHEMA_VERSION,
        state,
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        // If write fails, we still return merged state; next load will retry.
      }
    }
  }

  return state
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
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<AppState>(() => readInitialState())
  const [readyToSync, setReadyToSync] = useState(false)

  useEffect(() => {
    writeState(state)
  }, [state])

  // When a user is signed in, hydrate from Supabase and decide whether remote or local wins.
  useEffect(() => {
    let cancelled = false

    if (!user || authLoading) {
      // Defer reset to a microtask so we don't synchronously set state
      // inside the effect body, which can trigger the lint rule about
      // cascading renders.
      Promise.resolve().then(() => {
        if (!cancelled) {
          setReadyToSync(false)
        }
      })
      return () => {
        cancelled = true
      }
    }

    const loadFromSupabase = async () => {
      const remote = await fetchPlannerState(user.id)
      if (cancelled) return

      if (remote) {
        setState((prev) => {
          const prevHasDays = Object.keys(prev.days ?? {}).length > 0
          const remoteHasDays = Object.keys(remote.days ?? {}).length > 0

          if (!prevHasDays && remoteHasDays) {
            return remote
          }
          if (prevHasDays && !remoteHasDays) {
            return prev
          }
          if (!prevHasDays && !remoteHasDays) {
            return prev
          }
          // Both have data; prefer the remote snapshot for now.
          return remote
        })
      }

      if (!cancelled) {
        setReadyToSync(true)
      }
    }

    void loadFromSupabase()

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  // When logged in and initial remote load finished, push changes to Supabase with debounce.
  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    const handle = window.setTimeout(() => {
      void upsertPlannerDays(user.id, state.days)
    }, 800)

    return () => {
      window.clearTimeout(handle)
    }
  }, [state, user, readyToSync])

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

