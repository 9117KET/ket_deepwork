/**
 * hooks/useCalendarDay.ts
 *
 * The selected day as Google Calendar sees it — read-only, for the timeline
 * beside the task list.
 *
 * "Connect once and forget" means there is no sync button: events load when
 * the day opens, again whenever the app comes back to the foreground, and
 * every few minutes while it stays open. The last answer per day is cached on
 * the device so Today paints instantly (and offline) and refreshes underneath.
 */

import { useCallback, useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { useAuth } from "../contexts/AuthContext"
import {
  calendarErrorMessage,
  isReconnectError,
  listCalendarEvents,
  type CalendarEvent,
} from "../services/calendarSyncService"

const CACHE_KEY = "deepblock_calendar_cache_v1"
const CACHE_DAYS = 7
const REFRESH_MS = 5 * 60_000

export type CalendarDayStatus =
  /** Guests have no calendar; the timeline stays out of the way. */
  | "signedOut"
  | "checking"
  | "disconnected"
  | "loading"
  | "ready"
  | "error"
  /** Google no longer accepts the stored token; only reconnecting fixes it. */
  | "reconnect"

type Cache = Record<string, { at: number; events: CalendarEvent[] }>

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cache) : {}
  } catch {
    return {}
  }
}

function writeCache(date: string, events: CalendarEvent[]) {
  try {
    const cache = readCache()
    cache[date] = { at: Date.now(), events }
    // Keep only the most recently fetched days; this is a paint cache, not a store.
    const kept = Object.entries(cache)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, CACHE_DAYS)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // Storage full or unavailable: the live fetch still works.
  }
}

export function useCalendarDay(date: string) {
  const { user } = useAuth()
  const status = useQuery(api.calendar.connectionStatus, user ? {} : "skip")
  const connected = status?.connected === true
  const tasksEnabled = status?.connected === true && status.tasksEnabled === true

  const [events, setEvents] = useState<CalendarEvent[]>(() => readCache()[date]?.events ?? [])
  const [loadState, setLoadState] = useState<"idle" | "ready" | "error" | "reconnect">("idle")
  const [error, setError] = useState<string | null>(null)
  /** Bumped to ask for a fresh fetch (after scheduling, for instance). */
  const [refreshTick, setRefreshTick] = useState(0)
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  // A new day shows its cached events at once, then the live ones.
  const [shownDate, setShownDate] = useState(date)
  if (shownDate !== date) {
    setShownDate(date)
    setEvents(readCache()[date]?.events ?? [])
    setLoadState("idle")
  }

  useEffect(() => {
    if (!connected) return
    let latest = 0
    const load = () => {
      const request = ++latest
      listCalendarEvents(date).then(
        (fresh) => {
          if (request !== latest) return
          setEvents(fresh)
          setError(null)
          setLoadState("ready")
          writeCache(date, fresh)
        },
        (e: unknown) => {
          if (request !== latest) return
          setError(calendarErrorMessage(e))
          setLoadState(isReconnectError(e) ? "reconnect" : "error")
        },
      )
    }
    load()
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    const id = window.setInterval(onVisible, REFRESH_MS)
    return () => {
      // A late answer for a day no longer shown must not overwrite the new one.
      latest = -1
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(id)
    }
  }, [connected, date, refreshTick])

  const dayStatus: CalendarDayStatus = !user
    ? "signedOut"
    : status === undefined
      ? "checking"
      : !connected
        ? "disconnected"
        : loadState === "error" || loadState === "reconnect"
          ? loadState
          : loadState === "ready"
            ? "ready"
            : "loading"

  return { status: dayStatus, connected, tasksEnabled, events, error, refresh }
}
