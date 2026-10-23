/**
 * hooks/useMinuteTick.ts
 *
 * A clock that moves once a minute while the caller is mounted, so dates
 * that depend on "now" (the partner's today, a cool-down) roll over without
 * a reload. `wakeAt`, when given, adds one extra tick at that instant.
 */

import { useEffect, useState } from "react"

export function useMinuteTick(wakeAt: number | null = null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (wakeAt == null) return
    const wait = wakeAt - Date.now()
    if (wait <= 0) return
    const id = window.setTimeout(() => setNow(Date.now()), wait + 50)
    return () => window.clearTimeout(id)
  }, [wakeAt])
  return now
}
