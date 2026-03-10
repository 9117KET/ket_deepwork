/**
 * storage/localStorageState.ts
 *
 * Persistence layer: when signed in, Supabase is the single source of truth;
 * localStorage is backup only (e.g. before first fetch or when offline).
 * For guests, state lives only in localStorage.
 */

import { useEffect, useRef, useState } from 'react'
import type { AppState, DayState } from '../domain/types'
import { todayIso, mergeActiveDaysWithDayKeys } from '../domain/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { fetchPlannerState, upsertPlannerDays } from './supabasePlanner'
import { fetchUserSettings, upsertUserSettings } from './supabaseUserSettings'

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

/** Merge activeDays with all state.days keys so every day with data counts; migrate legacy lastOpenDate. */
function migrateLegacyStreak(state: AppState): AppState {
  const legacy = state as AppState & { lastOpenDate?: string }
  const dayKeys = Object.keys(state.days ?? {}).filter(Boolean)
  let base = state.activeDays ?? []
  if (legacy.lastOpenDate && !base.length) base = [legacy.lastOpenDate]
  const activeDays = mergeActiveDaysWithDayKeys(base, dayKeys)
  return { ...state, activeDays }
}

function readInitialState(): AppState {
  if (typeof window === 'undefined') {
    return EMPTY_STATE
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  let state = migrate(parsed)
  state = migrateLegacyStreak(state)

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

  return migrateLegacyStreak(state)
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

  // When signed in, Supabase is source of truth for dates it has; local-only dates are kept so we don't lose progress (e.g. days that never synced).
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
      const [remote, settings] = await Promise.all([
        fetchPlannerState(user.id),
        fetchUserSettings(user.id),
      ])
      if (cancelled) return
      if (remote !== null || settings !== null) {
        setState((prev) => {
          const prevLegacy = prev as AppState & { lastOpenDate?: string }
          let activeDays =
            settings?.activeDays ??
            (prevLegacy.lastOpenDate && !prev.activeDays?.length
              ? [prevLegacy.lastOpenDate]
              : prev.activeDays ?? [])
          const dayKeys = Object.keys(remote?.days ? { ...prev.days, ...remote.days } : prev.days ?? {}).filter(Boolean)
          activeDays = mergeActiveDaysWithDayKeys(activeDays, dayKeys)
          return {
            days: remote?.days ? { ...(prev.days ?? {}), ...remote.days } : prev.days,
            timeOffsetMinutes: remote?.timeOffsetMinutes ?? prev.timeOffsetMinutes,
            habitDefinitions: settings?.habitDefinitions ?? prev.habitDefinitions,
            monthTitles: settings?.monthTitles ?? prev.monthTitles,
            activeDays,
          }
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

  // Refs so we can flush pending sync on tab hide/close and always read latest state.
  const stateRef = useRef(state)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When logged in and initial remote load finished, push changes to Supabase with debounce.
  const settingsSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    stateRef.current = state
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      void upsertPlannerDays(user.id, stateRef.current.days)
    }, 800)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }
  }, [state, user, readyToSync])

  // Sync user_settings (habit definitions, month titles, streak) when they change; debounced.
  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    if (settingsSyncTimeoutRef.current) clearTimeout(settingsSyncTimeoutRef.current)
    settingsSyncTimeoutRef.current = setTimeout(() => {
      settingsSyncTimeoutRef.current = null
      void upsertUserSettings(user.id, {
        habitDefinitions: stateRef.current.habitDefinitions ?? [],
        monthTitles: stateRef.current.monthTitles ?? {},
        activeDays: stateRef.current.activeDays ?? [],
      })
    }, 800)

    return () => {
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
      }
    }
  }, [state.habitDefinitions, state.monthTitles, state.activeDays, user, readyToSync])

  // Flush pending sync when tab is hidden or page unloads so other devices see changes.
  // Refetch from Supabase when tab becomes visible so this device shows latest (e.g. after editing on phone).
  useEffect(() => {
    if (!user || typeof document === 'undefined') return

    const flushSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
        void upsertPlannerDays(user.id, stateRef.current.days)
      }
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
        void upsertUserSettings(user.id, {
          habitDefinitions: stateRef.current.habitDefinitions ?? [],
          monthTitles: stateRef.current.monthTitles ?? {},
          activeDays: stateRef.current.activeDays ?? [],
        })
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
        Promise.all([fetchPlannerState(user.id), fetchUserSettings(user.id)]).then(
          ([remote, settings]) => {
            if (refetchCancelled) return
            if (remote !== null || settings !== null) {
              setState((prev) => {
                const mergedDays = remote?.days ? { ...(prev.days ?? {}), ...remote.days } : prev.days ?? {}
                const dayKeys = Object.keys(mergedDays).filter(Boolean)
                const activeDays = mergeActiveDaysWithDayKeys(
                  settings?.activeDays ?? prev.activeDays ?? [],
                  dayKeys,
                )
                return {
                  ...prev,
                  days: remote?.days ? mergedDays : prev.days,
                  timeOffsetMinutes: remote?.timeOffsetMinutes ?? prev.timeOffsetMinutes,
                  habitDefinitions: settings?.habitDefinitions ?? prev.habitDefinitions,
                  monthTitles: settings?.monthTitles ?? prev.monthTitles,
                  activeDays,
                }
              })
            }
          },
        )
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

