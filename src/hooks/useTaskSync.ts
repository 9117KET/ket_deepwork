/**
 * hooks/useTaskSync.ts
 *
 * Keeps the open day's tasks and Google Tasks in agreement, both ways.
 *
 * Every change to the day's tasks (a new one, a tick, a rename) is sent after
 * a short pause, so typing a title does not fire a request per keystroke. The
 * same request brings back what changed in Google since — a task ticked off
 * on the phone's calendar — and hands it to `onPulled` to apply. Like the
 * timeline, it also re-checks when the app comes back to the foreground and
 * every couple of minutes while it stays open, which is how a tick made in
 * Google reaches the planner without anyone touching it.
 *
 * The server never deletes from a sync. A planner delete is sent on its own
 * once it can no longer be undone (DayPlanner does that); a Google delete
 * leaves the planner task alone.
 *
 * `enabled` must be false while the planner is still hydrating from the
 * server: an empty, half-loaded day is not an empty day, and mirroring it
 * would be wrong in both directions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Task } from "../domain/types"
import {
  calendarErrorMessage,
  isReconnectError,
  syncDayTasksWithGoogle,
  type RemoteTaskChange,
  type SyncTaskInput,
} from "../services/calendarSyncService"

/** Quiet time after the last edit before it is sent. */
const DEBOUNCE_MS = 1_200
const REFRESH_MS = 2 * 60_000

export type TaskSyncStatus = "idle" | "syncing" | "ready" | "error" | "reconnect"

/** The mirrored fields only: editing a duration or a schedule costs no round trip. */
export function toSyncPayload(tasks: Task[]): SyncTaskInput[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    isDone: t.isDone,
    ...(t.parentId ? { parentId: t.parentId } : {}),
  }))
}

export function useTaskSync(params: {
  date: string
  tasks: Task[]
  enabled: boolean
  onPulled: (date: string, changes: RemoteTaskChange[]) => void
}) {
  const { date, tasks, enabled, onPulled } = params
  const [status, setStatus] = useState<TaskSyncStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const payload = useMemo(() => toSyncPayload(tasks), [tasks])
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload])

  // Refs, so one in-flight request always finishes with the latest of
  // everything and a follow-up run (for edits made meanwhile) needs no closure.
  const onPulledRef = useRef(onPulled)
  onPulledRef.current = onPulled
  const payloadRef = useRef(payload)
  payloadRef.current = payload
  const dateRef = useRef(date)
  dateRef.current = date
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const inFlight = useRef(false)
  /** An edit arrived while a request was out: go again when it lands. */
  const dirty = useRef(false)
  const lastSyncedDate = useRef<string | null>(null)
  /** Google wants the user to reconnect; stop asking until something changes. */
  const halted = useRef(false)

  const run = useCallback(async () => {
    if (!enabledRef.current || halted.current) return
    if (inFlight.current) {
      dirty.current = true
      return
    }
    inFlight.current = true
    dirty.current = false
    const forDate = dateRef.current
    setStatus("syncing")
    try {
      const result = await syncDayTasksWithGoogle(forDate, payloadRef.current)
      lastSyncedDate.current = forDate
      if (!mounted.current) return
      // A pull for a day no longer on screen is dropped; the day will sync
      // again, and pull again, when it is next opened.
      if (result.pulls.length > 0 && forDate === dateRef.current) {
        onPulledRef.current(forDate, result.pulls)
      }
      setError(null)
      setStatus("ready")
    } catch (e) {
      if (!mounted.current) return
      const reconnect = isReconnectError(e)
      if (reconnect) halted.current = true
      setError(calendarErrorMessage(e))
      setStatus(reconnect ? "reconnect" : "error")
      console.warn("[task-sync] could not sync tasks", e)
    } finally {
      inFlight.current = false
      if (mounted.current && dirty.current) void run()
    }
  }, [])

  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    // A freshly opened day syncs at once; an edit waits for the typing to stop.
    const delay = lastSyncedDate.current === date ? DEBOUNCE_MS : 0
    const timer = window.setTimeout(() => void run(), delay)
    return () => window.clearTimeout(timer)
  }, [enabled, date, payloadKey, tick, run])

  useEffect(() => {
    if (!enabled) return
    // Coming back (or reconnecting) is the moment to try again after a halt.
    halted.current = false
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      halted.current = false
      setTick((t) => t + 1)
    }
    document.addEventListener("visibilitychange", onVisible)
    const id = window.setInterval(onVisible, REFRESH_MS)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(id)
    }
  }, [enabled])

  return { status, error }
}
