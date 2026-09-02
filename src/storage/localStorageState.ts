// @refresh reset

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useConvexAuth } from "convex/react"
import type { AppState, DayState, AbandonedTask, BlockDurations, NotDoingItem, SideQuestDef } from "../domain/types"
import { todayIso, addDays, deriveActiveDaysFromDays } from "../domain/dateUtils"
import { api } from "../../convex/_generated/api"

// TEMP sync-debug instrumentation. Enable in the browser console with:
//   localStorage.setItem('deepblock_sync_debug', '1')   (then reload)
// Disable with localStorage.removeItem('deepblock_sync_debug'). Remove this
// block once the "ticked todo reverts itself" bug is diagnosed.
function syncDebug(...args: unknown[]) {
  if (typeof window === "undefined") return
  if (window.localStorage.getItem("deepblock_sync_debug") !== "1") return
  console.debug(`[sync ${new Date().toISOString().slice(11, 23)}]`, ...args)
}

function doneIds(tasks?: { id: string; isDone?: boolean }[]): string {
  return (tasks ?? []).filter((t) => t.isDone).map((t) => t.id).sort().join(",")
}

const STORAGE_KEY = "deepblock_state_v1"
const LEGACY_STORAGE_KEY = "ket_deepwork_state_v1"
const PENDING_DATES_KEY = "deepblock_pending_dates_v1"
const PENDING_SETTINGS_KEY = "deepblock_pending_settings_v1"
const SYNCED_TASK_IDS_KEY = "deepblock_synced_task_ids_v1"
const LAST_MODIFIED_KEY = "deepblock_last_modified_v1"
const SCHEMA_VERSION = 1

/**
 * How much history the live subscription covers.
 *
 * A Convex query re-runs when anything in its read set changes, so subscribing
 * to the whole history meant every task tick re-read every day the account had
 * ever held. Splitting at this boundary keeps an ordinary edit's cost flat
 * instead of growing with the history behind it - see `plannerDays.getRecent`.
 *
 * A fortnight is chosen so the window comfortably covers the days anyone
 * actually edits (today, yesterday, tomorrow's plan, last week's review) while
 * staying an order of magnitude smaller than a year of use.
 */
const HOT_WINDOW_DAYS = 14

/**
 * Days per `upsertMany` call.
 *
 * The original first-sign-in migration sent every day in one mutation and
 * overran the I/O quota mid-upload, which is how the server ended up with a
 * partial history in the first place. Capping the payload means a large
 * backlog - a restore, or the reconcile below - drains over several ticks
 * instead of arriving as one spike.
 */
export const MAX_DAYS_PER_SYNC = 25

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

const DEFAULT_SIDE_QUEST_DEFS: SideQuestDef[] = [
  { id: 'sq-1', title: 'Piano practice', category: 'fun' },
  { id: 'sq-2', title: "Rubik's cube", category: 'fun' },
  { id: 'sq-3', title: 'Explore a new AI tool', category: 'technical' },
  { id: 'sq-4', title: 'Work on a side project', category: 'technical' },
  { id: 'sq-5', title: 'Scoop - read & curate', category: 'serious' },
  { id: 'sq-6', title: 'Read for 20 minutes', category: 'serious' },
]

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
  if (state.monthlyReviewQuestions === undefined) {
    state = { ...state, monthlyReviewQuestions: DEFAULT_MONTHLY_REVIEW_QUESTIONS }
  }
  if (state.sideQuestDefs === undefined) {
    state = { ...state, sideQuestDefs: DEFAULT_SIDE_QUEST_DEFS }
  }
  return state
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
  const sideQuestCompletions = (doc.sideQuestCompletions as DayState["sideQuestCompletions"] | null) ?? undefined
  const blockDurations = doc.blockDurations as BlockDurations | null | undefined
  const notDoingItems = (doc.notDoingItems as NotDoingItem[] | null) ?? undefined
  const abandonedTasks = (doc.abandonedTasks as AbandonedTask[] | null) ?? undefined
  return {
    date: doc.date as string,
    tasks,
    deepWorkSessions,
    habitCompletions: Object.keys(habitCompletions).length > 0 ? habitCompletions : undefined,
    sideQuestCompletions: sideQuestCompletions && Object.keys(sideQuestCompletions).length > 0 ? sideQuestCompletions : undefined,
    sleepHours: (doc.sleepHours as number | null) ?? undefined,
    mood: (doc.mood as string | null) ?? undefined,
    bedTime: (doc.bedTime as string | null) ?? undefined,
    wakeTime: (doc.wakeTime as string | null) ?? undefined,
    sleepTarget: (doc.sleepTarget as string | null) ?? undefined,
    blockDurations: blockDurations ?? undefined,
    notDoingItems: notDoingItems && notDoingItems.length > 0 ? notDoingItems : undefined,
    abandonedTasks: abandonedTasks && abandonedTasks.length > 0 ? abandonedTasks : undefined,
    dayNote: (doc.dayNote as string | null) ?? undefined,
    focusHijacker: (doc.focusHijacker as DayState["focusHijacker"] | null) ?? undefined,
    shutdownCompletedAt: (doc.shutdownCompletedAt as string | null) ?? undefined,
  }
}

// ─── Merge remote day into local ──────────────────────────────────────────────

/**
 * Merges remote DayState into local. Remote is authoritative for most fields,
 * but we keep local values for scheduling fields when remote is null/undefined
 * (prevents stale server row from wiping out times the user just set), and
 * we preserve local tasks the server hasn't seen yet.
 *
 * `syncedTaskIds` is the set of task IDs that were present the last time this
 * device synced this day with the server. A local task missing from `remote`
 * is only "not-yet-synced" (and thus preserved) if it was never part of that
 * snapshot - otherwise it was deleted on another device and must not be
 * resurrected.
 */
export function mergeRemoteDayState(local: DayState, remote: DayState, syncedTaskIds?: Set<string>): DayState {
  // Per-task merge: remote is authoritative for tasks the server knows about;
  // local-only (not-yet-synced) tasks are appended so they survive the merge.
  const remoteTaskIds = new Set((remote.tasks ?? []).map((t) => t.id))
  const localOnlyTasks = (local.tasks ?? []).filter(
    (t) => !remoteTaskIds.has(t.id) && !syncedTaskIds?.has(t.id),
  )
  return {
    ...remote,
    tasks: [...(remote.tasks ?? []), ...localOnlyTasks],
    bedTime: remote.bedTime ?? local.bedTime,
    wakeTime: remote.wakeTime ?? local.wakeTime,
    sleepTarget: remote.sleepTarget ?? local.sleepTarget,
    blockDurations: remote.blockDurations ?? local.blockDurations,
    habitCompletions: remote.habitCompletions ?? local.habitCompletions,
    sideQuestCompletions: remote.sideQuestCompletions ?? local.sideQuestCompletions,
    notDoingItems: remote.notDoingItems ?? local.notDoingItems,
    abandonedTasks: remote.abandonedTasks ?? local.abandonedTasks,
    dayNote: remote.dayNote ?? local.dayNote,
    focusHijacker: remote.focusHijacker ?? local.focusHijacker,
    shutdownCompletedAt: remote.shutdownCompletedAt ?? local.shutdownCompletedAt,
  }
}

/**
 * Read-side recency guard, mirroring the server-side `isStaleWrite` guard.
 *
 * Returns true when an incoming remote day row must NOT be applied because this
 * device already holds a strictly fresher copy: applying a stale/empty remote
 * row would let `mergeRemoteDayState` delete tasks the user can still see (the
 * "yesterday's todos vanished on refresh" bug). Last-write-wins by edit time,
 * the same policy the server uses on writes.
 *
 * - No local copy → never stale (the remote is all we have, apply it).
 * - Missing timestamps default to 0, so a backend that never stored `updatedAt`
 *   makes local always win — safe: no day is ever wiped.
 */
export function isRemoteDayStale(
  hasLocal: boolean,
  localUpdatedAt: number | undefined,
  remoteUpdatedAt: number | undefined,
): boolean {
  if (!hasLocal) return false
  return (localUpdatedAt ?? 0) > (remoteUpdatedAt ?? 0)
}

// ─── Sync payload builders (shared by debounced sync and hide/unload flush) ──

/**
 * Builds the day upsert payload. Only days in `includeDates` (the dates with
 * unsynced local changes) are sent — pushing untouched days would let a stale
 * snapshot needlessly rewrite rows another write may have just updated. Each
 * day is stamped with `updatedAt` (its last local edit time) so the server can
 * reject a write that races in behind a fresher one.
 */
export function buildDaysSyncPayload(
  state: AppState,
  lastModified: Map<string, number>,
  includeDates: Set<string>,
  limit: number = MAX_DAYS_PER_SYNC,
) {
  return Object.values({ ...state.days })
    .filter((day): day is DayState => Boolean(day))
    .filter((day) => includeDates.has(day.date))
    // Newest first: if a backlog drains over several ticks, the days the user
    // is most likely to be looking at on another device land first.
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map((day) => ({
      date: day.date,
      tasks: day.tasks ?? [],
      deepWorkSessions: day.deepWorkSessions ?? [],
      habitCompletions: day.habitCompletions,
      sleepHours: day.sleepHours ?? undefined,
      mood: day.mood ?? undefined,
      bedTime: day.bedTime ?? undefined,
      wakeTime: day.wakeTime ?? undefined,
      sleepTarget: day.sleepTarget ?? undefined,
      blockDurations: day.blockDurations ?? undefined,
      notDoingItems: day.notDoingItems,
      abandonedTasks: day.abandonedTasks,
      timeOffsetMinutes: state.timeOffsetMinutes,
      sideQuestCompletions: day.sideQuestCompletions,
      dayNote: day.dayNote ?? undefined,
      focusHijacker: day.focusHijacker ?? undefined,
      shutdownCompletedAt: day.shutdownCompletedAt ?? undefined,
      updatedAt: lastModified.get(day.date) ?? Date.now(),
    }))
}

function buildSettingsSyncPayload(s: AppState) {
  return {
    habitDefinitions: s.habitDefinitions ?? [],
    monthTitles: s.monthTitles ?? {},
    activeDays: s.activeDays ?? [],
    blockDurationRatios: s.blockDurationRatios ?? null,
    notDoingList: s.notDoingList ?? [],
    identityStatement: s.identityStatement ?? "",
    depthPhilosophy: s.depthPhilosophy,
    deepWorkGoalHours: s.deepWorkGoalHoursPerWeek ?? undefined,
    focusBlockMinutes: s.focusBlockMinutes ?? undefined,
    focusBreakMinutes: s.focusBreakMinutes ?? undefined,
    oneThingData: {
      northStar: s.northStar ?? "",
      goalCascade: s.goalCascade ?? null,
      dayOneThings: s.dayOneThings ?? {},
      weekOneThings: s.weekOneThings ?? {},
      monthOneThings: s.monthOneThings ?? {},
      monthlyReviews: s.monthlyReviews ?? {},
      monthlyReviewQuestions: s.monthlyReviewQuestions ?? [],
      weeklyReviews: s.weeklyReviews ?? {},
      weeklyReviewQuestions: s.weeklyReviewQuestions ?? [],
      weeklyReviewDay: s.weeklyReviewDay,
    },
    weeklyProjectRotation: s.weeklyProjectRotation ?? [],
    sideQuestDefs: s.sideQuestDefs ?? [],
    sideQuestXp: s.sideQuestXp ?? 0,
    sideQuestStreak: s.sideQuestStreak ?? 0,
    sideQuestLastStreakDate: s.sideQuestLastStreakDate,
  }
}

/**
 * Snapshot the write generation of every pending date. Dates restored from a
 * previous session (after a failed sync + reload) have no in-memory generation
 * and default to 0 — including them lets a successful sync clear their pending
 * flag instead of leaving the date stuck pending forever, which would block
 * remote merges for it. A generation mismatch after the upsert resolves means
 * the date was edited mid-flight and must stay pending.
 */
function snapshotPendingGenerations(
  pending: Set<string>,
  generations: Map<string, number>,
): Map<string, number> {
  const snapshot = new Map<string, number>()
  for (const date of pending) {
    snapshot.set(date, generations.get(date) ?? 0)
  }
  return snapshot
}

// ─── Pending-sync persistence (survives page reloads) ────────────────────────
// Tracks ISO dates / settings that have local changes not yet confirmed synced.
// Without this, a page reload after a failed sync would let stale Convex data
// overwrite local deletions / edits (tasks, completions, sessions, etc.).

function readPendingDates(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const raw = window.localStorage.getItem(PENDING_DATES_KEY)
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw) as unknown
    return new Set(Array.isArray(arr) ? (arr as string[]) : [])
  } catch {
    return new Set()
  }
}

function writePendingDates(dates: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PENDING_DATES_KEY, JSON.stringify([...dates]))
  } catch { /* storage unavailable */ }
}

function readPendingSettings(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(PENDING_SETTINGS_KEY) === "1"
}

function writePendingSettings(pending: boolean) {
  if (typeof window === "undefined") return
  try {
    if (pending) {
      window.localStorage.setItem(PENDING_SETTINGS_KEY, "1")
    } else {
      window.localStorage.removeItem(PENDING_SETTINGS_KEY)
    }
  } catch { /* storage unavailable */ }
}

// ─── Per-day last-modified timestamps (survive reloads) ──────────────────────
// The logical edit time (ms) of each day's last LOCAL change. Persisted so the
// read-merge can tell, after a reload, whether the server's row for a day is
// older than the copy this device already has - mirroring the server-side
// `isStaleWrite` guard on the read side so a stale/empty remote row can't wipe
// fresher local data on hydration. Without this, every refresh re-applied the
// server's version of an already-synced past day with no recency check, which
// could silently delete a full day's tasks if the server row was stale.

function readLastModified(): Map<string, number> {
  if (typeof window === "undefined") return new Map()
  const raw = window.localStorage.getItem(LAST_MODIFIED_KEY)
  if (!raw) return new Map()
  try {
    const obj = JSON.parse(raw) as Record<string, number>
    return new Map(Object.entries(obj).filter(([, ms]) => typeof ms === "number"))
  } catch {
    return new Map()
  }
}

function writeLastModified(map: Map<string, number>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAST_MODIFIED_KEY, JSON.stringify(Object.fromEntries(map)))
  } catch { /* storage unavailable */ }
}

// ─── Synced task ID snapshots (per day) ──────────────────────────────────────
// Tracks which task IDs were present in this day the last time it was
// reconciled with the server, so `mergeRemoteDayState` can tell "task I just
// created locally" (preserve) apart from "task deleted on another device"
// (don't resurrect). Persisted so the distinction survives reloads.

function readSyncedTaskIds(): Map<string, Set<string>> {
  if (typeof window === "undefined") return new Map()
  const raw = window.localStorage.getItem(SYNCED_TASK_IDS_KEY)
  if (!raw) return new Map()
  try {
    const obj = JSON.parse(raw) as Record<string, string[]>
    return new Map(Object.entries(obj).map(([date, ids]) => [date, new Set(ids)]))
  } catch {
    return new Map()
  }
}

function writeSyncedTaskIds(map: Map<string, Set<string>>) {
  if (typeof window === "undefined") return
  try {
    const obj: Record<string, string[]> = {}
    for (const [date, ids] of map) obj[date] = [...ids]
    window.localStorage.setItem(SYNCED_TASK_IDS_KEY, JSON.stringify(obj))
  } catch { /* storage unavailable */ }
}

/**
 * A day carrying nothing worth a server row. The planner creates a day object
 * as soon as one is viewed, so without this the reconcile would upload a row
 * for every date the user ever clicked past.
 */
export function isEmptyDay(day: DayState): boolean {
  if ((day.tasks ?? []).length > 0) return false
  if ((day.deepWorkSessions ?? []).length > 0) return false
  if ((day.notDoingItems ?? []).length > 0) return false
  if ((day.abandonedTasks ?? []).length > 0) return false
  if (day.habitCompletions && Object.values(day.habitCompletions).some(Boolean)) return false
  if (day.sideQuestCompletions && Object.values(day.sideQuestCompletions).some(Boolean)) return false
  return (
    day.sleepHours == null &&
    day.mood == null &&
    !day.bedTime &&
    !day.wakeTime &&
    !day.sleepTarget &&
    !day.dayNote &&
    !day.focusHijacker &&
    !day.shutdownCompletedAt &&
    !day.blockDurations
  )
}

// ─── usePersistentState ───────────────────────────────────────────────────────

export function usePersistentState(): [AppState, (updater: (prev: AppState) => AppState) => void, boolean] {
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

  // Per-date write-generation counter for dirty tracking (in-memory, current session)
  const dirtyGenerations = useRef<Map<string, number>>(new Map())
  // Per-date logical edit time (ms). Stamped onto each synced day so the server
  // can reject a write whose snapshot predates a fresher one that won the race.
  // Persisted across reloads so the read-merge can also reject a stale remote
  // row that would otherwise wipe fresher local data on hydration.
  const lastModified = useRef<Map<string, number>>(readLastModified())
  // Echo-suppression window: ignore reactive updates for 3s after we clear a dirty flag
  const echoSuppressUntil = useRef<Map<string, number>>(new Map())
  const ECHO_SUPPRESS_MS = 3000
  // Persisted pending-sync sets - survive page reloads after a failed sync
  const pendingDates = useRef<Set<string>>(readPendingDates())
  const pendingSettings = useRef(readPendingSettings())
  // Per-day snapshot of task IDs last reconciled with the server - lets the
  // merge below tell new local tasks apart from remotely-deleted ones
  const syncedTaskIds = useRef<Map<string, Set<string>>>(readSyncedTaskIds())

  // The hot/cold boundary. Derived from the calendar day rather than stored, so
  // it moves with midnight; both halves read the same value so no day can fall
  // between them or land in both.
  const hotSince = useMemo(() => addDays(todayIso(), -HOT_WINDOW_DAYS), [])

  // Convex reactive queries - undefined while loading, null/array when ready.
  // Two subscriptions rather than one: an edit to today invalidates only the
  // recent window, leaving the archive's cached result untouched.
  const recentDays = useQuery(
    api.plannerDays.getRecent,
    isAuthenticated ? { since: hotSince } : "skip",
  )
  const archiveDays = useQuery(
    api.plannerDays.getArchive,
    isAuthenticated ? { before: hotSince } : "skip",
  )
  const remoteSettings = useQuery(api.userSettings.get, isAuthenticated ? {} : "skip")

  // Undefined until BOTH halves have arrived, so nothing downstream ever sees a
  // partial history and mistakes a not-yet-loaded day for a missing one - which
  // the reconcile below would otherwise read as "the server lost this".
  const remoteDays = useMemo(() => {
    if (recentDays === undefined || archiveDays === undefined) return undefined
    if (recentDays === null && archiveDays === null) return null
    return [...(archiveDays ?? []), ...(recentDays ?? [])]
  }, [recentDays, archiveDays])

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
      let syncedTaskIdsChanged = false
      for (const doc of remoteDayList) {
        const date = doc.date as string
        if (dirtyGenerations.current.has(date)) {
          syncDebug("apply: SKIP (dirty)", date, "gen=", dirtyGenerations.current.get(date))
          continue
        }
        if (pendingDates.current.has(date)) {
          syncDebug("apply: SKIP (pending)", date)
          continue
        }
        const suppressUntil = echoSuppressUntil.current.get(date)
        if (suppressUntil && Date.now() < suppressUntil) {
          syncDebug("apply: SKIP (echo-suppress)", date, "for", suppressUntil - Date.now(), "ms")
          continue
        }
        // Recency guard (mirrors the server-side isStaleWrite guard on the read
        // side). If this device's persisted last-edit time for the day is newer
        // than the remote row's, the remote is stale - applying it could wipe
        // fresher local tasks. Keep local; our pending sync will reconcile.
        const remoteUpdatedAt = (doc as { updatedAt?: number }).updatedAt ?? 0
        const localUpdatedAt = lastModified.current.get(date) ?? 0
        if (isRemoteDayStale(Boolean(base[date]), localUpdatedAt, remoteUpdatedAt)) {
          syncDebug("apply: SKIP (local fresher)", date, "local=", localUpdatedAt, "remote=", remoteUpdatedAt)
          continue
        }
        const dayState = docToDayState(doc as Record<string, unknown>)
        const local = base[date]
        const merged = local ? mergeRemoteDayState(local, dayState, syncedTaskIds.current.get(date)) : dayState
        if (local && doneIds(local.tasks) !== doneIds(merged.tasks)) {
          syncDebug(
            "apply: ⚠ REMOTE CHANGED done-set", date,
            "\n  local done:  ", doneIds(local.tasks),
            "\n  remote done: ", doneIds(dayState.tasks),
            "\n  merged done: ", doneIds(merged.tasks),
          )
        } else {
          syncDebug("apply: ok (no done-set change)", date)
        }
        base[date] = merged
        syncedTaskIds.current.set(date, new Set((dayState.tasks ?? []).map((t) => t.id)))
        syncedTaskIdsChanged = true
      }
      if (syncedTaskIdsChanged) writeSyncedTaskIds(syncedTaskIds.current)

      const activeDays = deriveActiveDaysFromDays(base)

      if (settingsDoc && !pendingSettings.current) {
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
          focusBlockMinutes: (settingsDoc.focusBlockMinutes as number | undefined) ?? prev.focusBlockMinutes,
          focusBreakMinutes: (settingsDoc.focusBreakMinutes as number | undefined) ?? prev.focusBreakMinutes,
          northStar: (ot.northStar as string | undefined) ?? prev.northStar,
          goalCascade: (ot.goalCascade as AppState["goalCascade"] | undefined) ?? prev.goalCascade,
          dayOneThings: (ot.dayOneThings as Record<string, string> | undefined) ?? prev.dayOneThings,
          weekOneThings: (ot.weekOneThings as Record<string, string> | undefined) ?? prev.weekOneThings,
          monthOneThings: (ot.monthOneThings as Record<string, string> | undefined) ?? prev.monthOneThings,
          monthlyReviews: (ot.monthlyReviews as AppState["monthlyReviews"] | undefined) ?? prev.monthlyReviews,
          monthlyReviewQuestions: (ot.monthlyReviewQuestions as string[] | undefined) ?? prev.monthlyReviewQuestions,
          weeklyReviews: (ot.weeklyReviews as AppState["weeklyReviews"] | undefined) ?? prev.weeklyReviews,
          weeklyReviewQuestions: (ot.weeklyReviewQuestions as string[] | undefined) ?? prev.weeklyReviewQuestions,
          weeklyReviewDay: (ot.weeklyReviewDay as AppState["weeklyReviewDay"] | undefined) ?? prev.weeklyReviewDay,
          weeklyProjectRotation: (settingsDoc.weeklyProjectRotation as AppState["weeklyProjectRotation"] | undefined) ?? prev.weeklyProjectRotation,
          sideQuestDefs: (settingsDoc.sideQuestDefs as AppState["sideQuestDefs"] | undefined) ?? prev.sideQuestDefs,
          sideQuestXp: (settingsDoc.sideQuestXp as number | undefined) ?? prev.sideQuestXp,
          sideQuestStreak: (settingsDoc.sideQuestStreak as number | undefined) ?? prev.sideQuestStreak,
          sideQuestLastStreakDate: (settingsDoc.sideQuestLastStreakDate as string | undefined) ?? prev.sideQuestLastStreakDate,
        }
      }

      return { ...prev, days: base, activeDays }
    })
  }, [remoteDays, remoteSettings, isAuthenticated, authLoading])

  /**
   * Send the queued days. One implementation for all three callers - the
   * debounce, the backlog drain, and the tab-hide flush - which previously
   * carried three copies of this bookkeeping between them.
   *
   * Returns whether anything is still queued afterwards, since the payload is
   * capped and a large backlog needs more than one pass.
   */
  const flushDays = useCallback(async (): Promise<boolean> => {
    const genSnapshot = snapshotPendingGenerations(pendingDates.current, dirtyGenerations.current)
    const payload = buildDaysSyncPayload(stateRef.current, lastModified.current, pendingDates.current)
    if (payload.length === 0) return false
    syncDebug("sync: upserting", payload.length, "days; snapshot gens:", [...genSnapshot.entries()])
    try {
      await upsertManyDays({ days: payload })
    } catch (err) {
      // Pending flags are deliberately left alone: an unsent day must stay
      // queued, or a transient failure becomes permanent data loss on every
      // other device. This is what carried the backlog through the months the
      // server was rejecting writes.
      console.error("[sync] days sync failed:", err)
      return false
    }
    const now = Date.now()
    const sent = new Set(payload.map((day) => day.date))
    for (const [date, gen] of genSnapshot) {
      if (!sent.has(date)) continue
      const liveGen = dirtyGenerations.current.get(date) ?? 0
      if (liveGen === gen) {
        dirtyGenerations.current.delete(date)
        echoSuppressUntil.current.set(date, now + ECHO_SUPPRESS_MS)
        pendingDates.current.delete(date)
        syncDebug("sync: CLEARED dirty/pending", date, "gen=", gen, "-> echo-suppress 3s")
      } else {
        syncDebug("sync: KEPT dirty (edited mid-flight)", date, "snapshot gen=", gen, "live gen=", liveGen)
      }
    }
    writePendingDates(pendingDates.current)
    return pendingDates.current.size > 0
  }, [upsertManyDays])

  /**
   * Drain a backlog larger than one capped batch. Without this a restore or a
   * reconcile would send 25 days and then sit until the user happened to edit
   * something else.
   */
  const drainRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDrainingRef = useRef(false)
  const scheduleDrain = useCallback(() => {
    if (drainRef.current || isDrainingRef.current) return
    drainRef.current = setTimeout(() => {
      drainRef.current = null
      isDrainingRef.current = true
      void (async () => {
        try {
          // Paced rather than tight: the point of the cap is to spread a large
          // backlog out, and hammering upsertMany back to back would just
          // rebuild the spike it exists to prevent. The bound is a safety net -
          // `flushDays` returns false on error, so a failing server stops the
          // loop rather than being retried forever.
          for (let pass = 0; pass < 200; pass += 1) {
            const more = await flushDays()
            if (!more) break
            await new Promise((resolve) => setTimeout(resolve, 1200))
          }
        } finally {
          isDrainingRef.current = false
        }
      })()
    }, 1200)
  }, [flushDays])

  // Debounced sync of planner days to Convex
  useEffect(() => {
    if (!isAuthenticated || !readyToSync) return
    if (typeof window === "undefined") return

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null
      void flushDays().then((more) => {
        if (more) scheduleDrain()
      })
    }, 800)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }
  }, [state, isAuthenticated, readyToSync, flushDays, scheduleDrain])

  useEffect(() => () => {
    if (drainRef.current) clearTimeout(drainRef.current)
  }, [])

  /**
   * Queue any day this device holds that the server has never received.
   *
   * The write path only ever uploads days marked dirty by a local edit, which
   * is what keeps it cheap - but it means a day whose pending flag was lost
   * (storage cleared, a sync that failed on a since-fixed validator, a day
   * created before the flag existed) is stranded on this device forever. It
   * looks fine here and simply does not exist on any other device, which is the
   * worst shape a sync bug can take: silent, and invisible from the machine
   * that still has the data.
   *
   * Days are never deleted server-side, so "local has it, remote does not" is
   * unambiguous - there is no deletion this could be resurrecting. Runs once a
   * session, after both halves of the history have arrived, and only for days
   * that actually hold something. The capped payload drains the result over as
   * many ticks as it takes.
   */
  const hasReconciledRef = useRef(false)
  useEffect(() => {
    if (!isAuthenticated || !readyToSync) return
    if (remoteDays === undefined) return
    if (hasReconciledRef.current) return
    hasReconciledRef.current = true

    const remoteDates = new Set((remoteDays ?? []).map((doc) => doc.date as string))
    const stranded: string[] = []
    for (const [date, day] of Object.entries(stateRef.current.days ?? {})) {
      if (!day || remoteDates.has(date)) continue
      if (isEmptyDay(day)) continue
      stranded.push(date)
    }
    if (stranded.length === 0) return

    console.warn(
      `[sync] ${stranded.length} day(s) exist only on this device and were never uploaded - queueing:`,
      stranded.join(", "),
    )
    for (const date of stranded) {
      pendingDates.current.add(date)
      // Stamp an edit time if the day has none, so the server's staleness guard
      // accepts it rather than silently dropping it as older than nothing.
      if (!lastModified.current.has(date)) lastModified.current.set(date, Date.now())
    }
    writePendingDates(pendingDates.current)
    writeLastModified(lastModified.current)
    scheduleDrain()
  }, [isAuthenticated, readyToSync, remoteDays, scheduleDrain])

  // Debounced sync of user settings to Convex
  useEffect(() => {
    if (!isAuthenticated || !readyToSync) return
    if (typeof window === "undefined") return

    if (settingsSyncTimeoutRef.current) clearTimeout(settingsSyncTimeoutRef.current)
    // Only sync when the user actually changed a setting. `update()` sets
    // pendingSettings on a genuine local edit; the reactive userSettings echo
    // never does. Without this guard, every server push re-armed a write
    // (settingsDoc + derived activeDays come back as fresh references), forming
    // an ~800ms write/read loop that burned the entire Convex I/O quota.
    if (!pendingSettings.current) return
    settingsSyncTimeoutRef.current = setTimeout(() => {
      settingsSyncTimeoutRef.current = null
      void upsertSettings(buildSettingsSyncPayload(stateRef.current)).then(() => {
        pendingSettings.current = false
        writePendingSettings(false)
      }).catch((err: unknown) => console.error("[sync] settings sync failed:", err))
    }, 800)

    return () => {
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
      }
    }
  }, [
    // NB: state.activeDays is intentionally NOT a dependency. It is derived from
    // days on every reactive apply (a fresh array each time) and its server copy
    // is never read back, so triggering a settings sync on it is pure churn.
    state.habitDefinitions,
    state.monthTitles,
    state.blockDurationRatios,
    state.notDoingList,
    state.identityStatement,
    state.depthPhilosophy,
    state.deepWorkGoalHoursPerWeek,
    state.focusBlockMinutes,
    state.focusBreakMinutes,
    state.northStar,
    state.goalCascade,
    state.dayOneThings,
    state.weekOneThings,
    state.monthOneThings,
    state.monthlyReviews,
    state.monthlyReviewQuestions,
    state.weeklyReviews,
    state.weeklyReviewQuestions,
    state.weeklyReviewDay,
    state.weeklyProjectRotation,
    state.sideQuestDefs,
    state.sideQuestXp,
    state.sideQuestStreak,
    state.sideQuestLastStreakDate,
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
        void flushDays()
      }
      if (settingsSyncTimeoutRef.current) {
        clearTimeout(settingsSyncTimeoutRef.current)
        settingsSyncTimeoutRef.current = null
        void upsertSettings(buildSettingsSyncPayload(stateRef.current)).then(() => {
          pendingSettings.current = false
          writePendingSettings(false)
        }).catch((err: unknown) => console.error("[sync] settings flush failed:", err))
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
  }, [isAuthenticated, upsertSettings, flushDays])

  const update = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      let datesChanged = false
      for (const date of Object.keys(next.days)) {
        if (next.days[date] !== prev.days[date]) {
          dirtyGenerations.current.set(date, (dirtyGenerations.current.get(date) ?? 0) + 1)
          pendingDates.current.add(date)
          lastModified.current.set(date, Date.now())
          datesChanged = true
          syncDebug(
            "update: mark dirty", date,
            "gen=", dirtyGenerations.current.get(date),
            "done:", doneIds(prev.days[date]?.tasks), "->", doneIds(next.days[date]?.tasks),
          )
        }
      }
      if (datesChanged) {
        writePendingDates(pendingDates.current)
        writeLastModified(lastModified.current)
      }

      const settingsChanged = (
        next.habitDefinitions !== prev.habitDefinitions ||
        next.monthTitles !== prev.monthTitles ||
        next.blockDurationRatios !== prev.blockDurationRatios ||
        next.notDoingList !== prev.notDoingList ||
        next.identityStatement !== prev.identityStatement ||
        next.depthPhilosophy !== prev.depthPhilosophy ||
        next.deepWorkGoalHoursPerWeek !== prev.deepWorkGoalHoursPerWeek ||
        next.focusBlockMinutes !== prev.focusBlockMinutes ||
        next.focusBreakMinutes !== prev.focusBreakMinutes ||
        next.northStar !== prev.northStar ||
        next.goalCascade !== prev.goalCascade ||
        next.dayOneThings !== prev.dayOneThings ||
        next.weekOneThings !== prev.weekOneThings ||
        next.monthOneThings !== prev.monthOneThings ||
        next.monthlyReviews !== prev.monthlyReviews ||
        next.monthlyReviewQuestions !== prev.monthlyReviewQuestions ||
        next.weeklyReviews !== prev.weeklyReviews ||
        next.weeklyReviewQuestions !== prev.weeklyReviewQuestions ||
        next.weeklyReviewDay !== prev.weeklyReviewDay ||
        next.weeklyProjectRotation !== prev.weeklyProjectRotation ||
        next.sideQuestDefs !== prev.sideQuestDefs ||
        next.sideQuestXp !== prev.sideQuestXp ||
        next.sideQuestStreak !== prev.sideQuestStreak ||
        next.sideQuestLastStreakDate !== prev.sideQuestLastStreakDate
      )
      if (settingsChanged && !pendingSettings.current) {
        pendingSettings.current = true
        writePendingSettings(true)
      }

      return next
    })
  }

  const isHydrating = !authLoading && isAuthenticated && !readyToSync

  return [state, update, isHydrating]
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
