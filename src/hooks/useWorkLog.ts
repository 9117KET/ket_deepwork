/**
 * hooks/useWorkLog.ts
 *
 * Copies finished focus blocks to the "Deepblock log" calendar.
 *
 * Driven by the recorded sessions rather than by the timer's completion
 * callback, so every path that records earned work — a countdown ending, a
 * block claimed after the app was closed, a block finished on another device
 * — reaches the calendar the same way. The server derives the event id from
 * the session id, so re-sending is harmless; the local set only saves calls.
 *
 * Only earned work is logged. Hand-logged minutes are self-report and stay
 * out of the calendar for the same reason they stay out of the deep work
 * total: the log is a record of what the timer saw.
 */

import { useEffect, useRef } from "react"
import type { AppState } from "../domain/types"
import { addDays, todayIso } from "../domain/dateUtils"
import { logWorkBlockToCalendar } from "../services/calendarSyncService"

const LOGGED_KEY = "deepblock_logged_sessions_v1"
/** Older blocks are history from before logging existed; never backfill them. */
const MAX_AGE_MS = 36 * 3_600_000
const MAX_REMEMBERED = 200

function readLogged(): string[] {
  try {
    const raw = localStorage.getItem(LOGGED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function rememberLogged(id: string) {
  try {
    const next = [...readLogged().filter((x) => x !== id), id].slice(-MAX_REMEMBERED)
    localStorage.setItem(LOGGED_KEY, JSON.stringify(next))
  } catch {
    // Unavailable storage only costs a repeat (idempotent) call later.
  }
}

export interface PendingLog {
  sessionId: string
  title: string
  startedAt: string
  finishedAt: string
}

/** Earned, finished, recent blocks not yet sent. Pure, for testing. */
export function pendingWorkLogs(
  state: AppState,
  logged: ReadonlySet<string>,
  now: number,
  today: string = todayIso(),
): PendingLog[] {
  const out: PendingLog[] = []
  for (const date of [addDays(today, -1), today]) {
    const day = state.days[date]
    if (!day) continue
    for (const s of day.deepWorkSessions ?? []) {
      if (s.source === "manual" || s.cancelledAt || !s.finishedAt) continue
      if (logged.has(s.id)) continue
      const end = Date.parse(s.finishedAt)
      const minutes = Math.round(s.durationMinutes)
      if (!Number.isFinite(end) || minutes <= 0 || now - end > MAX_AGE_MS) continue
      const title = (s.taskId && day.tasks.find((t) => t.id === s.taskId)?.title) || s.label || "Deep work"
      // A paused block spans more wall time than it counted. Log the minutes it
      // counted, ending when it ended, rather than the stretched interval.
      out.push({
        sessionId: s.id,
        title,
        startedAt: new Date(end - minutes * 60_000).toISOString(),
        finishedAt: new Date(end).toISOString(),
      })
    }
  }
  return out
}

export function useWorkLog(state: AppState, connected: boolean) {
  const inFlight = useRef(false)

  useEffect(() => {
    if (!connected || inFlight.current) return
    const pending = pendingWorkLogs(state, new Set(readLogged()), Date.now())
    if (pending.length === 0) return

    inFlight.current = true
    void (async () => {
      for (const log of pending) {
        try {
          await logWorkBlockToCalendar(log)
          rememberLogged(log.sessionId)
        } catch (e) {
          // Leave it unmarked: the next change to state retries it.
          console.warn("[work-log] could not log block", e)
          break
        }
      }
      inFlight.current = false
    })()
  }, [state, connected])
}
