/**
 * storage/localStorageState.ts
 *
 * Persistence layer: when signed in, Supabase is the single source of truth;
 * localStorage is backup only (e.g. before first fetch or when offline).
 * For guests, state lives only in localStorage.
 */

import { useEffect, useRef, useState } from 'react'
import type { AppState, DayState } from '../domain/types'
import { todayIso, deriveActiveDaysFromDays } from '../domain/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchPlannerState,
  plannerDayRowToDayState,
  upsertPlannerDays,
  type PlannerDayRow,
} from './supabasePlanner'
import {
  fetchUserSettings,
  upsertUserSettings,
  userSettingsRowToAppStatePatch,
  type UserSettingsRow,
} from './supabaseUserSettings'

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

/** Recompute activeDays from tasks completion; migrate legacy lastOpenDate. */
function migrateLegacyStreak(state: AppState): AppState {
  const legacy = state as AppState & { lastOpenDate?: string }
  // Keep legacy date only as a hint; the derived rule (completed tasks) still applies.
  const baseDays = state.days ?? {}
  const activeDays = deriveActiveDaysFromDays(baseDays)
  // If we have no derived days but legacy exists *and* that legacy day has a completed task,
  // allow it to count.
  if (activeDays.length === 0 && legacy.lastOpenDate) {
    const legacyDay = baseDays[legacy.lastOpenDate]
    if (legacyDay && legacyDay.tasks?.some((t) => t.isDone)) {
      return { ...state, activeDays: [legacy.lastOpenDate] }
    }
  }
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

      const plannerOk = remote !== null
      const settingsOk = settings !== null

      // Only merge what we successfully fetched. If both fail, keep local cache and do not push upstream.
      if (plannerOk || settingsOk) {
        setState((prev) => {
          const mergedDays = plannerOk
            ? { ...(prev.days ?? {}), ...remote!.days }
            : (prev.days ?? {})
          const activeDays = deriveActiveDaysFromDays(mergedDays)
          return {
            days: mergedDays,
            timeOffsetMinutes: plannerOk ? remote!.timeOffsetMinutes ?? prev.timeOffsetMinutes : prev.timeOffsetMinutes,
            habitDefinitions: settingsOk ? settings!.habitDefinitions : prev.habitDefinitions,
            monthTitles: settingsOk ? settings!.monthTitles : prev.monthTitles,
            blockDurationRatios: settingsOk ? settings!.blockDurationRatios : prev.blockDurationRatios,
            activeDays,
          }
        })
      }

      if (!cancelled) {
        setReadyToSync(plannerOk || settingsOk)
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
  /** Dates currently being upserted; realtime echoes for these are ignored to prevent
   *  them from clobbering newer optimistic updates made while the upsert was in-flight. */
  const syncingDatesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    stateRef.current = state
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      const daysSnapshot = { ...stateRef.current.days }
      const syncedDates = Object.keys(daysSnapshot).filter(d => Boolean(daysSnapshot[d]))
      for (const date of syncedDates) syncingDatesRef.current.add(date)
      void upsertPlannerDays(user.id, daysSnapshot).finally(() => {
        // Hold the block for 500 ms after the upsert so the realtime echo
        // (which arrives shortly after) is still suppressed.
        setTimeout(() => {
          for (const date of syncedDates) syncingDatesRef.current.delete(date)
        }, 500)
      })
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
        blockDurationRatios: stateRef.current.blockDurationRatios ?? null,
      })
    }, 800)

    return () => {
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
      }
    }
  }, [state.habitDefinitions, state.monthTitles, state.activeDays, state.blockDurationRatios, user, readyToSync])

  // Realtime: apply Supabase writes from other devices/tabs immediately (Postgres Changes).
  useEffect(() => {
    if (!user || !readyToSync) return

    const filter = `user_id=eq.${user.id}`
    const channel = supabase
      .channel(`planner-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planner_days', filter },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { date?: string } | null
            const date = oldRow?.date
            if (!date) return
            if (syncingDatesRef.current.has(date)) return
            setState((prev) => {
              const nextDays = { ...prev.days }
              delete nextDays[date]
              return {
                ...prev,
                days: nextDays,
                activeDays: deriveActiveDaysFromDays(nextDays),
              }
            })
            return
          }
          const row = payload.new as PlannerDayRow
          if (!row?.date) return
          if (syncingDatesRef.current.has(row.date)) return
          const dayState = plannerDayRowToDayState(row)
          setState((prev) => {
            const nextDays = { ...prev.days, [row.date]: dayState }
            return {
              ...prev,
              days: nextDays,
              activeDays: deriveActiveDaysFromDays(nextDays),
            }
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new as UserSettingsRow
          if (!row?.user_id) return
          const patch = userSettingsRowToAppStatePatch(row)
          setState((prev) => ({
            ...prev,
            ...patch,
          }))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, readyToSync])

  // Flush pending sync when tab is hidden or page unloads so other devices see changes.
  // Refetch from Supabase when tab becomes visible so this device shows latest (e.g. after editing on phone).
  useEffect(() => {
    if (!user || typeof document === 'undefined') return

    const flushSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
        const daysSnapshot = { ...stateRef.current.days }
        const syncedDates = Object.keys(daysSnapshot).filter(d => Boolean(daysSnapshot[d]))
        for (const date of syncedDates) syncingDatesRef.current.add(date)
        void upsertPlannerDays(user.id, daysSnapshot).finally(() => {
          setTimeout(() => {
            for (const date of syncedDates) syncingDatesRef.current.delete(date)
          }, 500)
        })
      }
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
        void upsertUserSettings(user.id, {
          habitDefinitions: stateRef.current.habitDefinitions ?? [],
          monthTitles: stateRef.current.monthTitles ?? {},
          activeDays: stateRef.current.activeDays ?? [],
          blockDurationRatios: stateRef.current.blockDurationRatios ?? null,
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
            const plannerOk = remote !== null
            const settingsOk = settings !== null
            if (plannerOk || settingsOk) {
              setState((prev) => {
                const mergedDays = plannerOk
                  ? (() => {
                      const base = { ...(prev.days ?? {}) }
                      for (const [date, ds] of Object.entries(remote!.days)) {
                        if (!syncingDatesRef.current.has(date)) base[date] = ds
                      }
                      return base
                    })()
                  : (prev.days ?? {})
                const activeDays = deriveActiveDaysFromDays(mergedDays)
                return {
                  ...prev,
                  days: mergedDays,
                  timeOffsetMinutes: plannerOk
                    ? remote!.timeOffsetMinutes ?? prev.timeOffsetMinutes
                    : prev.timeOffsetMinutes,
                  habitDefinitions: settingsOk ? settings!.habitDefinitions : prev.habitDefinitions,
                  monthTitles: settingsOk ? settings!.monthTitles : prev.monthTitles,
                  blockDurationRatios: settingsOk ? settings!.blockDurationRatios : prev.blockDurationRatios,
                  activeDays,
                }
              })
            }
          },
        ).catch((err) => {
          console.error('[sync] Failed to refetch on visibility change', err)
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

