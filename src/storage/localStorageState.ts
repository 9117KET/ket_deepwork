// @refresh reset

import { useEffect, useRef, useState } from "react"
import { useQuery, useMutation, useConvexAuth } from "convex/react"
import type { AppState, DayState, AbandonedTask, BlockDurations, NotDoingItem } from "../domain/types"
import { todayIso, deriveActiveDaysFromDays } from "../domain/dateUtils"
import { api } from "../../convex/_generated/api"

const STORAGE_KEY = "deepblock_state_v1"
const LEGACY_STORAGE_KEY = "ket_deepwork_state_v1"
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
    if (typeof parsed.version !== "number" || typeof parsed.state !== "object") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function migrate(persisted: PersistedStateV1 | null): AppState {
  if (!persisted) return EMPTY_STATE
  if (persisted.version === SCHEMA_VERSION) return persisted.state
  return persisted.state ?? EMPTY_STATE
}

function migrateLegacyStreak(state: AppState): AppState {
  const legacy = state as AppState & { lastOpenDate?: string }
  const baseDays = state.days ?? {}
  const activeDays = deriveActiveDaysFromDays(baseDays)
  if (activeDays.length === 0 && legacy.lastOpenDate) {
    const legacyDay = baseDays[legacy.lastOpenDate]
    if (legacyDay && legacyDay.tasks?.some((t) => t.isDone)) {
      return { ...state, activeDays: [legacy.lastOpenDate] }
    }
  }
  return { ...state, activeDays }
}

const DEFAULT_MONTHLY_REVIEW_QUESTIONS = [
  "Did I protect the deep-work block every weekday this month?",
  "How many quality actions toward my ONE thing did I take? What was the result?",
  "Is my key skill improving measurably? Am I on track for my 3-month goal?",
  "What financial or administrative blocker did I resolve this month?",
  "What is the ONE thing for next month that makes everything else easier or unnecessary?",
  "What did I park that I need to make sure stays parked?",
  "What did I almost say yes to that I should have said no to?",
]

function seedOneThingDefaults(state: AppState): AppState {
  if (state.monthlyReviewQuestions !== undefined) return state
  return { ...state, monthlyReviewQuestions: DEFAULT_MONTHLY_REVIEW_QUESTIONS }
}

function readInitialState(): AppState {
  if (typeof window === "undefined") return EMPTY_STATE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  let state = migrate(parsed)
  state = migrateLegacyStreak(state)

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
      const wrapped: PersistedStateV1 = { version: SCHEMA_VERSION, state }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        // ignore quota/private mode errors
      }
    }
  }

  return seedOneThingDefaults(migrateLegacyStreak(state))
}

function writeState(next: AppState) {
  if (typeof window === "undefined") return
  const wrapped: PersistedStateV1 = { version: SCHEMA_VERSION, state: next }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
  } catch {
    // ignore quota/private mode errors
  }
}

// ─── Map Convex doc to DayState ───────────────────────────────────────────────

function docToDayState(doc: Record<string, unknown>): DayState {
  const tasks = (doc.tasks as DayState["tasks"] | null) ?? []
  const deepWorkSessions = (doc.deepWorkSessions as DayState["deepWorkSessions"] | null) ?? []
  const habitCompletions = (doc.habitCompletions as DayState["habitCompletions"] | null) ?? {}
  const blockDurations = doc.blockDurations as BlockDurations | null | undefined
  const notDoingItems = (doc.notDoingItems as NotDoingItem[] | null) ?? undefined
  const abandonedTasks = (doc.abandonedTasks as AbandonedTask[] | null) ?? undefined
  return {
    date: doc.date as string,
    tasks,
    deepWorkSessions,
    habitCompletions: Object.keys(habitCompletions).length > 0 ? habitCompletions : undefined,
    sleepHours: (doc.sleepHours as number | null) ?? undefined,
    mood: (doc.mood as string | null) ?? undefined,
    bedTime: (doc.bedTime as string | null) ?? undefined,
    wakeTime: (doc.wakeTime as string | null) ?? undefined,
    sleepTarget: (doc.sleepTarget as string | null) ?? undefined,
    blockDurations: blockDurations ?? undefined,
    notDoingItems: notDoingItems && notDoingItems.length > 0 ? notDoingItems : undefined,
    abandonedTasks: abandonedTasks && abandonedTasks.length > 0 ? abandonedTasks : undefined,
  }
}

// ─── Merge remote day into local ──────────────────────────────────────────────

/**
 * Merges remote DayState into local. Remote is authoritative for most fields,
 * but we keep local values for scheduling fields when remote is null/undefined
 * (prevents stale server row from wiping out times the user just set), and
 * we preserve local tasks the server hasn't seen yet.
 */
export function mergeRemoteDayState(local: DayState, remote: DayState): DayState {
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

// ─── usePersistentState ───────────────────────────────────────────────────────

export function usePersistentState(): [AppState, (updater: (prev: AppState) => AppState) => void] {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const [state, setState] = useState<AppState>(() => readInitialState())
  const [readyToSync, setReadyToSync] = useState(false)

  useEffect(() => {
    writeState(state)
  }, [state])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Per-date write-generation counter for dirty tracking
  const dirtyGenerations = useRef<Map<string, number>>(new Map())
  // Echo-suppression window: ignore reactive updates for 3s after we clear a dirty flag
  const echoSuppressUntil = useRef<Map<string, number>>(new Map())
  const ECHO_SUPPRESS_MS = 3000

  // Convex reactive queries - undefined while loading, null/array when ready
  const remoteDays = useQuery(api.plannerDays.getAll, isAuthenticated ? {} : "skip")
  const remoteSettings = useQuery(api.userSettings.get, isAuthenticated ? {} : "skip")

  // Convex mutations
  const upsertManyDays = useMutation(api.plannerDays.upsertMany)
  const upsertSettings = useMutation(api.userSettings.upsert)

  // Mark ready once the initial data arrives from Convex
  useEffect(() => {
    if (!isAuthenticated) {
      setReadyToSync(false)
      return
    }
    if (remoteDays !== undefined) {
      setReadyToSync(true)
    }
  }, [isAuthenticated, remoteDays])

  // Apply remote data reactively (covers both initial load and multi-device updates)
  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    if (remoteDays === undefined) return

    const remoteDayList = remoteDays ?? []
    const settingsDoc = remoteSettings

    setState((prev) => {
      const base = { ...(prev.days ?? {}) }
      for (const doc of remoteDayList) {
        const date = doc.date as string
        if (dirtyGenerations.current.has(date)) continue
        const suppressUntil = echoSuppressUntil.current.get(date)
        if (suppressUntil && Date.now() < suppressUntil) continue
        const dayState = docToDayState(doc as Record<string, unknown>)
        const local = base[date]
        base[date] = local ? mergeRemoteDayState(local, dayState) : dayState
      }

      const activeDays = deriveActiveDaysFromDays(base)

      if (settingsDoc) {
        const ot = (settingsDoc.oneThingData ?? {}) as Record<string, unknown>
        return {
          days: base,
          activeDays,
          timeOffsetMinutes: prev.timeOffsetMinutes,
          habitDefinitions: settingsDoc.habitDefinitions ?? prev.habitDefinitions,
          monthTitles: (settingsDoc.monthTitles as Record<string, string> | undefined) ?? prev.monthTitles,
          blockDurationRatios: settingsDoc.blockDurationRatios ?? prev.blockDurationRatios,
          notDoingList: settingsDoc.notDoingList ?? prev.notDoingList,
          identityStatement: settingsDoc.identityStatement ?? prev.identityStatement,
          depthPhilosophy: (settingsDoc.depthPhilosophy as AppState["depthPhilosophy"]) ?? prev.depthPhilosophy,
          deepWorkGoalHoursPerWeek: (settingsDoc.deepWorkGoalHours as number | undefined) ?? prev.deepWorkGoalHoursPerWeek,
          northStar: (ot.northStar as string | undefined) ?? prev.northStar,
          goalCascade: (ot.goalCascade as AppState["goalCascade"] | undefined) ?? prev.goalCascade,
          dayOneThings: (ot.dayOneThings as Record<string, string> | undefined) ?? prev.dayOneThings,
          weekOneThings: (ot.weekOneThings as Record<string, string> | undefined) ?? prev.weekOneThings,
          monthOneThings: (ot.monthOneThings as Record<string, string> | undefined) ?? prev.monthOneThings,
          monthlyReviews: (ot.monthlyReviews as AppState["monthlyReviews"] | undefined) ?? prev.monthlyReviews,
          monthlyReviewQuestions: (ot.monthlyReviewQuestions as string[] | undefined) ?? prev.monthlyReviewQuestions,
        }
      }

      return { ...prev, days: base, activeDays }
    })
  }, [remoteDays, remoteSettings, isAuthenticated, authLoading])

  // Debounced sync of planner days to Convex
  useEffect(() => {
    if (!isAuthenticated || !readyToSync) return
    if (typeof window === "undefined") return

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      const daysSnapshot = { ...stateRef.current.days }
      const genSnapshot = new Map(dirtyGenerations.current)
      const payload = Object.values(daysSnapshot)
        .filter((day): day is DayState => Boolean(day))
        .map((day) => ({
          date: day.date,
          tasks: day.tasks ?? [],
          deepWorkSessions: day.deepWorkSessions ?? [],
          habitCompletions: day.habitCompletions,
          sleepHours: day.sleepHours,
          mood: day.mood,
          bedTime: day.bedTime,
          wakeTime: day.wakeTime,
          sleepTarget: day.sleepTarget,
          blockDurations: day.blockDurations,
          notDoingItems: day.notDoingItems,
          abandonedTasks: day.abandonedTasks,
          timeOffsetMinutes: stateRef.current.timeOffsetMinutes,
        }))
      if (payload.length === 0) return
      void upsertManyDays({ days: payload }).then(() => {
        const now = Date.now()
        for (const [date, gen] of genSnapshot) {
          if (dirtyGenerations.current.get(date) === gen) {
            dirtyGenerations.current.delete(date)
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
  }, [state, isAuthenticated, readyToSync, upsertManyDays])

  // Debounced sync of user settings to Convex
  useEffect(() => {
    if (!isAuthenticated || !readyToSync) return
    if (typeof window === "undefined") return

    if (settingsSyncTimeoutRef.current) clearTimeout(settingsSyncTimeoutRef.current)
    settingsSyncTimeoutRef.current = setTimeout(() => {
      settingsSyncTimeoutRef.current = null
      const s = stateRef.current
      void upsertSettings({
        habitDefinitions: s.habitDefinitions ?? [],
        monthTitles: s.monthTitles ?? {},
        activeDays: s.activeDays ?? [],
        blockDurationRatios: s.blockDurationRatios ?? null,
        notDoingList: s.notDoingList ?? [],
        identityStatement: s.identityStatement ?? "",
        depthPhilosophy: s.depthPhilosophy,
        deepWorkGoalHours: s.deepWorkGoalHoursPerWeek ?? undefined,
        oneThingData: {
          northStar: s.northStar ?? "",
          goalCascade: s.goalCascade ?? null,
          dayOneThings: s.dayOneThings ?? {},
          weekOneThings: s.weekOneThings ?? {},
          monthOneThings: s.monthOneThings ?? {},
          monthlyReviews: s.monthlyReviews ?? {},
          monthlyReviewQuestions: s.monthlyReviewQuestions ?? [],
        },
      })
    }, 800)

    return () => {
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
      }
    }
  }, [
    state.habitDefinitions,
    state.monthTitles,
    state.activeDays,
    state.blockDurationRatios,
    state.notDoingList,
    state.identityStatement,
    state.depthPhilosophy,
    state.deepWorkGoalHoursPerWeek,
    state.northStar,
    state.goalCascade,
    state.dayOneThings,
    state.weekOneThings,
    state.monthOneThings,
    state.monthlyReviews,
    state.monthlyReviewQuestions,
    isAuthenticated,
    readyToSync,
    upsertSettings,
  ])

  // Flush pending sync when tab hides or page unloads
  useEffect(() => {
    if (!isAuthenticated || typeof document === "undefined") return

    const flushSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
        const daysSnapshot = { ...stateRef.current.days }
        const genSnapshot = new Map(dirtyGenerations.current)
        const payload = Object.values(daysSnapshot)
          .filter((day): day is DayState => Boolean(day))
          .map((day) => ({
            date: day.date,
            tasks: day.tasks ?? [],
            deepWorkSessions: day.deepWorkSessions ?? [],
            habitCompletions: day.habitCompletions,
            sleepHours: day.sleepHours,
            mood: day.mood,
            bedTime: day.bedTime,
            wakeTime: day.wakeTime,
            sleepTarget: day.sleepTarget,
            blockDurations: day.blockDurations,
            notDoingItems: day.notDoingItems,
            abandonedTasks: day.abandonedTasks,
            timeOffsetMinutes: stateRef.current.timeOffsetMinutes,
          }))
        if (payload.length > 0) {
          void upsertManyDays({ days: payload }).then(() => {
            for (const [date, gen] of genSnapshot) {
              if (dirtyGenerations.current.get(date) === gen) {
                dirtyGenerations.current.delete(date)
              }
            }
          })
        }
      }
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
        const s = stateRef.current
        void upsertSettings({
          habitDefinitions: s.habitDefinitions ?? [],
          monthTitles: s.monthTitles ?? {},
          activeDays: s.activeDays ?? [],
          blockDurationRatios: s.blockDurationRatios ?? null,
          notDoingList: s.notDoingList ?? [],
          identityStatement: s.identityStatement ?? "",
          depthPhilosophy: s.depthPhilosophy,
          deepWorkGoalHours: s.deepWorkGoalHoursPerWeek ?? undefined,
          oneThingData: {
            northStar: s.northStar ?? "",
            goalCascade: s.goalCascade ?? null,
            dayOneThings: s.dayOneThings ?? {},
            weekOneThings: s.weekOneThings ?? {},
            monthOneThings: s.monthOneThings ?? {},
            monthlyReviews: s.monthlyReviews ?? {},
            monthlyReviewQuestions: s.monthlyReviewQuestions ?? [],
          },
        })
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSync()
      }
      // No manual refetch needed - Convex reconnects and reactive queries update automatically
    }

    const handleBeforeUnload = () => {
      flushSync()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isAuthenticated, upsertManyDays, upsertSettings])

  const update = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
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
  return {
    date: isoDay,
    tasks: [],
    deepWorkSessions: [],
  }
}
