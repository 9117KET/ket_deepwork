/**
 * hooks/useSecondTick.ts
 *
 * A clock that moves on every whole second, but only while `active` and the
 * tab is visible, so a countdown on screen costs nothing when nobody can see
 * it. Coming back to the tab updates at once.
 */

import { useEffect, useState } from 'react'

/** Ms until the next whole second (1000 when exactly on one), so the display changes on the second. */
export function nextTickDelay(nowMs: number): number {
  return 1000 - (((nowMs % 1000) + 1000) % 1000)
}

export function useSecondTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    let timeoutId: number | undefined
    const clear = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = undefined
    }
    // `wait` 0 is the update on activation: from a timer callback, not the
    // effect body, so it never forces a cascading render.
    const arm = (wait: number) => {
      clear()
      timeoutId = window.setTimeout(() => {
        setNow(Date.now())
        arm(nextTickDelay(Date.now()))
      }, wait)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm(0)
      else clear()
    }
    if (document.visibilityState === 'visible') arm(0)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])
  return now
}
