/**
 * storage/restoreFromLocal.ts
 *
 * One-shot recovery utility: re-upload the days held in this device's
 * localStorage to the Convex `plannerDays` table in paced batches.
 *
 * Background: the first-sign-in migration tried to upload every day in a single
 * mutation and overran the Convex free-tier I/O quota mid-upload, so the server
 * is missing recent days. localStorage remains the complete source of truth.
 * This restore pushes those days back in small batches with a delay between
 * each, so it can't spike I/O the way the one-shot upload did.
 *
 * The day payload mirrors `buildDaysSyncPayload` exactly so it passes the same
 * `plannerDays.upsertMany` validator. Each day is stamped with `updatedAt` (its
 * persisted local edit time, or now) so the server-side `isStaleWrite` guard
 * accepts it: the old server rows predate `updatedAt` (treated as 0) and are
 * overwritten by the fresher local copy.
 */

import type { AppState, DayState } from "../domain/types"

const STORAGE_KEY = "deepblock_state_v1"
const LAST_MODIFIED_KEY = "deepblock_last_modified_v1"

/** Day shape accepted by `api.plannerDays.upsertMany`. */
export interface RestoreDayPayload {
  date: string
  tasks: unknown[]
  deepWorkSessions: unknown[]
  habitCompletions?: Record<string, boolean>
  sleepHours?: number
  mood?: string
  bedTime?: string
  wakeTime?: string
  sleepTarget?: string
  blockDurations?: unknown
  notDoingItems?: unknown[]
  abandonedTasks?: unknown[]
  timeOffsetMinutes?: number
  sideQuestCompletions?: Record<string, boolean>
  dayNote?: string
  focusHijacker?: string
  shutdownCompletedAt?: string
  updatedAt?: number
}

/**
 * Build the ordered restore payload from an AppState. Pure (no localStorage) so
 * it can be unit-tested. Field selection matches `buildDaysSyncPayload` so the
 * server validator (which rejects unknown fields) accepts it.
 */
export function buildRestorePayload(
  state: AppState,
  lastModified: Record<string, number> = {},
  now: number = Date.now(),
): RestoreDayPayload[] {
  return Object.values(state.days ?? {})
    .filter((day): day is DayState => Boolean(day))
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
      updatedAt: lastModified[day.date] ?? now,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function readLocalState(): AppState | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: AppState } & Partial<AppState>
    return (parsed.state ?? (parsed as AppState)) ?? null
  } catch {
    return null
  }
}

function readLocalLastModified(): Record<string, number> {
  if (typeof window === "undefined") return {}
  const raw = window.localStorage.getItem(LAST_MODIFIED_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

/** Read this device's days from localStorage as a restore payload. */
export function readLocalDaysForRestore(): RestoreDayPayload[] {
  const state = readLocalState()
  if (!state) return []
  return buildRestorePayload(state, readLocalLastModified())
}

/** Split an array into chunks of at most `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0")
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export interface RestoreProgress {
  batch: number
  batches: number
  done: number
  total: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Upsert `days` to the server in paced batches. Awaits each batch, then waits
 * `delayMs` before the next (no trailing wait after the last batch). `sleepFn`
 * is injectable for tests.
 */
export async function restoreDaysInBatches(
  days: RestoreDayPayload[],
  upsertMany: (args: { days: RestoreDayPayload[] }) => Promise<unknown>,
  opts: {
    batchSize?: number
    delayMs?: number
    onProgress?: (p: RestoreProgress) => void
    sleepFn?: (ms: number) => Promise<void>
  } = {},
): Promise<RestoreProgress> {
  const batchSize = opts.batchSize ?? 8
  const delayMs = opts.delayMs ?? 1500
  const sleepFn = opts.sleepFn ?? sleep
  const batches = chunk(days, batchSize)
  let done = 0
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!
    await upsertMany({ days: batch })
    done += batch.length
    opts.onProgress?.({ batch: i + 1, batches: batches.length, done, total: days.length })
    if (i < batches.length - 1) await sleepFn(delayMs)
  }
  return { batch: batches.length, batches: batches.length, done, total: days.length }
}
