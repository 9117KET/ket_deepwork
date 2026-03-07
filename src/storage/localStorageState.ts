/**
 * storage/localStorageState.ts
 *
 * Persistence layer: when signed in, Supabase is the single source of truth;
 * localStorage is backup only (e.g. before first fetch or when offline).
 * For guests, state lives only in localStorage.
 */

import { useEffect, useRef, useState } from 'react'
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

  // When signed in, Supabase is source of truth: always load from DB and replace local state.
  // If fetch fails (e.g. offline), keep localStorage as backup.
  useEffect(() => {
    let cancelled = false

    if (!user || authLoading) {
      Promise.resolve().then(() => {
        if (!cancelled) setReadyToSync(false)
      })
      return () => {
        cancelled = true
      }
    }

    const loadFromSupabase = async () => {
      const remote = await fetchPlannerState(user.id)
      if (cancelled) return

      if (remote !== null) {
        setState(remote)
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

  // Refs so we can flush pending sync on tab hide/close and always read latest state.
  const stateRef = useRef(state)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When logged in and initial remote load finished, push changes to Supabase with debounce.
  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    stateRef.current = state
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      void upsertPlannerDays(user.id, stateRef.current.days, stateRef.current.timeOffsetMinutes)
    }, 800)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }
  }, [state, user, readyToSync])

  // Flush pending sync when tab is hidden or page unloads so other devices see changes.
  // Refetch from Supabase when tab becomes visible so this device shows latest (e.g. after editing on phone).
  useEffect(() => {
    if (!user || typeof document === 'undefined') return

    const flushSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
        void upsertPlannerDays(user.id, stateRef.current.days, stateRef.current.timeOffsetMinutes)
      }
    }

    let refetchCancelled = false

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync()
        return
      }
      if (document.visibilityState === 'visible') {
        refetchCancelled = false
        fetchPlannerState(user.id).then((remote) => {
          if (refetchCancelled) return
          if (remote !== null) {
            setState(remote)
          }
        })
      }
    }

    const handleBeforeUnload = () => {
      flushSync()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      refetchCancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user])

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

