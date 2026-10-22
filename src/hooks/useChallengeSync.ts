/**
 * hooks/useChallengeSync.ts
 *
 * Publishes the open day's challenge summary after every edit, the way
 * `useTaskSync` mirrors tasks to Google: a short pause after the last change,
 * one request in flight at a time, and a retry when the app comes back to the
 * foreground. The server drops days outside the challenge, so the hook only
 * has to be quiet while hydrating — a half-loaded day is not the day.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChallengeSummary } from "../domain/challenge"
import { syncChallengeSummary } from "../services/challengeService"

const DEBOUNCE_MS = 1_200
const REFRESH_MS = 2 * 60_000

export function useChallengeSync(params: { date: string; summary: ChallengeSummary | null; enabled: boolean }) {
  const { date, summary, enabled } = params
  const [error, setError] = useState<string | null>(null)
  const payloadKey = useMemo(() => (summary ? JSON.stringify(summary) : ""), [summary])

  const summaryRef = useRef(summary)
  summaryRef.current = summary
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
  const dirty = useRef(false)
  const lastSyncedDate = useRef<string | null>(null)

  const run = useCallback(async () => {
    if (!enabledRef.current || !summaryRef.current) return
    if (inFlight.current) {
      dirty.current = true
      return
    }
    inFlight.current = true
    dirty.current = false
    const forDate = dateRef.current
    try {
      await syncChallengeSummary(forDate, summaryRef.current)
      lastSyncedDate.current = forDate
      if (mounted.current) setError(null)
    } catch (e) {
      if (mounted.current) setError((e as Error).message)
      console.warn("[challenge-sync] could not publish the day", e)
    } finally {
      inFlight.current = false
      if (mounted.current && dirty.current) void run()
    }
  }, [])

  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled || !summary) return
    const delay = lastSyncedDate.current === date ? DEBOUNCE_MS : 0
    const timer = window.setTimeout(() => void run(), delay)
    return () => window.clearTimeout(timer)
    // payloadKey stands in for `summary`, so a re-created but equal object does not re-send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, date, payloadKey, tick, run])

  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      setTick((t) => t + 1)
    }
    document.addEventListener("visibilitychange", onVisible)
    const id = window.setInterval(onVisible, REFRESH_MS)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(id)
    }
  }, [enabled])

  return { error }
}
