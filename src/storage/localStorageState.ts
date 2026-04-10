// @refresh reset
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

/**
 * Merge a remote DayState into a local one.
 * Remote is authoritative for tasks/sessions/mood/sleepHours/habitCompletions,
 * but we keep local values for scheduling fields (bedTime, wakeTime, sleepTarget,
 * blockDurations) when remote is null/undefined — this prevents a stale Supabase
 * row (not yet updated due to a pre-refresh sync race) from wiping out times the
 * user just set.
 *
 * We also preserve local tasks when local has task IDs that remote doesn't know
 * about yet. This covers the case where the user carries forward tasks (or adds
 * any tasks) and refreshes before the 800 ms Supabase debounce fires — without
 * this guard, the stale remote state would wipe out the locally-added tasks.
 * Once Supabase syncs, remote and local task IDs match, so remote takes over.
 */
function mergeRemoteDayState(local: DayState, remote: DayState): DayState {
  const remoteTaskIds = new Set((remote.tasks ?? []).map((t) => t.id))
  const localHasUnsyncedTasks = (local.tasks ?? []).some((t) => !remoteTaskIds.has(t.id))
  return {
    ...remote,
    tasks: localHasUnsyncedTasks ? local.tasks : remote.tasks,
    bedTime: remote.bedTime ?? local.bedTime,
    wakeTime: remote.wakeTime ?? local.wakeTime,
    sleepTarget: remote.sleepTarget ?? local.sleepTarget,
    blockDurations: remote.blockDurations ?? local.blockDurations,
  }
}

export function usePersistentState(): [AppState, (updater: (prev: AppState) => AppState) => void] {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<AppState>(() => readInitialState())
  const [readyToSync, setReadyToSync] = useState(false)

  useEffect(() => {
    writeState(state)
  }, [state])

  // Refs so we can flush pending sync on tab hide/close and always read latest state.
  const stateRef = useRef(state)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When logged in and initial remote load finished, push changes to Supabase with debounce.
  const settingsSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Per-date write-generation counter.
   *
   * Every time `update()` modifies a date, its generation number is incremented.
   * Every upsert snapshots the current generation for each date it will write.
   * The `.finally()` handler only removes a date's dirty flag when the generation
   * at snapshot time still matches the current generation — meaning no further
   * local edit has happened since the upsert was dispatched.  This prevents the
   * race where a slow `.finally()` clears a generation that was already bumped
   * by a new user interaction.
   *
   * A date is considered "dirty" (i.e. remote data must not overwrite it) when
   * its generation value is > 0 (any positive number means a local edit is
   * pending or in-flight).  Callers check `dirtyGenerations.current.has(date)`
   * (Map#has) rather than checking the value, so the guard reads naturally.
   */
  const dirtyGenerations = useRef<Map<string, number>>(new Map())

  /**
   * Post-write echo suppression window.
   *
   * After .finally() clears a date's dirty flag the realtime channel may
   * still deliver delayed echoes (e.g. from an earlier upsert in the same
   * session, or catch-up events after a WebSocket reconnect).  Those echoes
   * carry stale data and must not overwrite the current local state.
   *
   * When dirty is cleared for a date we record an expiry timestamp
   * (Date.now() + ECHO_SUPPRESS_MS).  The realtime setState updater rejects
   * any incoming event for that date until the window expires.
   * 3 s is generous; realistic WebSocket round-trip is < 500 ms.
   */
  const echoSuppressUntil = useRef<Map<string, number>>(new Map())
  const ECHO_SUPPRESS_MS = 3000

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
            ? (() => {
                // Prefer local state for any date the user modified while Supabase was loading.
                const base = { ...(prev.days ?? {}) }
                for (const [date, ds] of Object.entries(remote!.days)) {
                  if (!ds || dirtyGenerations.current.has(date)) continue
                  const local = base[date]
                  base[date] = local ? mergeRemoteDayState(local, ds) : ds
                }
                return base
              })()
            : (prev.days ?? {})
          const activeDays = deriveActiveDaysFromDays(mergedDays)
          return {
            days: mergedDays,
            timeOffsetMinutes: plannerOk ? remote!.timeOffsetMinutes ?? prev.timeOffsetMinutes : prev.timeOffsetMinutes,
            habitDefinitions: settingsOk ? settings!.habitDefinitions : prev.habitDefinitions,
            monthTitles: settingsOk ? settings!.monthTitles : prev.monthTitles,
            blockDurationRatios: settingsOk ? settings!.blockDurationRatios : prev.blockDurationRatios,
            notDoingList: settingsOk ? settings!.notDoingList : prev.notDoingList,
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

  useEffect(() => {
    if (!user || !readyToSync) return
    if (typeof window === 'undefined') return

    stateRef.current = state
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      const daysSnapshot = { ...stateRef.current.days }
      // Snapshot the current generation for every dirty date.  Only dates that
      // are in dirtyGenerations are included (i.e. have a pending local edit).
      // We also upsert all days (to keep server in sync), but we only clear
      // the dirty flag for dates whose generation hasn't changed by the time
      // the upsert resolves — ensuring a new edit that fires between the upsert
      // dispatch and its completion keeps its dirty flag intact.
      const genSnapshot = new Map(dirtyGenerations.current)
      void upsertPlannerDays(user.id, daysSnapshot).finally(() => {
        const now = Date.now()
        for (const [date, gen] of genSnapshot) {
          if (dirtyGenerations.current.get(date) === gen) {
            dirtyGenerations.current.delete(date)
            // Start the echo-suppression window so delayed realtime events
            // from this upsert (or earlier upserts) can't overwrite the
            // current local state after the dirty flag is cleared.
            echoSuppressUntil.current.set(date, now + ECHO_SUPPRESS_MS)
          }
        }
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
        notDoingList: stateRef.current.notDoingList ?? [],
      })
    }, 800)

    return () => {
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
      }
    }
  }, [state.habitDefinitions, state.monthTitles, state.activeDays, state.blockDurationRatios, state.notDoingList, user, readyToSync])

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
            // Guard is checked inside the updater so it runs after any
            // in-flight toggle updaters have already set the dirty flag.
            setState((prev) => {
              if (dirtyGenerations.current.has(date)) return prev
              const suppressUntil = echoSuppressUntil.current.get(date)
              if (suppressUntil && Date.now() < suppressUntil) return prev
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
          // Compute the new day state outside the updater (pure transform of
          // immutable WebSocket data) but perform the dirty check inside the
          // updater.  This ensures the guard executes after any preceding
          // toggle updater has run and stamped dirtyGenerations, closing the
          // race window where the check ran before React flushed the toggle.
          // The echo-suppression window provides a second layer of defence
          // against delayed or out-of-order events arriving after dirty clears.
          const dayState = plannerDayRowToDayState(row)
          setState((prev) => {
            if (dirtyGenerations.current.has(row.date)) return prev
            const suppressUntil = echoSuppressUntil.current.get(row.date)
            if (suppressUntil && Date.now() < suppressUntil) return prev
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
        const genSnapshot = new Map(dirtyGenerations.current)
        void upsertPlannerDays(user.id, daysSnapshot).finally(() => {
          for (const [date, gen] of genSnapshot) {
            if (dirtyGenerations.current.get(date) === gen) {
              dirtyGenerations.current.delete(date)
            }
          }
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
          notDoingList: stateRef.current.notDoingList ?? [],
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
                        if (!ds || dirtyGenerations.current.has(date)) continue
                        const local = base[date]
                        base[date] = local ? mergeRemoteDayState(local, ds) : ds
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
                  notDoingList: settingsOk ? settings!.notDoingList : prev.notDoingList,
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
    setState((prev) => {
      const next = updater(prev)
      // Increment the write-generation for every date whose DayState reference
      // changed.  The upsert's .finally() will only clear a date's dirty flag
      // when the generation it captured at dispatch time still matches the
      // current generation — so any subsequent edit keeps its protection.
      for (const date of Object.keys(next.days)) {
        if (next.days[date] !== prev.days[date]) {
          dirtyGenerations.current.set(date, (dirtyGenerations.current.get(date) ?? 0) + 1)
        }
      }
      return next
    })
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
