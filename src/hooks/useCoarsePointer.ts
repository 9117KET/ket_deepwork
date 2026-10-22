/**
 * hooks/useCoarsePointer.ts
 *
 * True when the primary input is a finger rather than a cursor, the same test
 * as the `touch:` Tailwind variant and `.touch-target-coarse`. For the few
 * places where a phone needs different behaviour, not just different styling
 * (open a sheet instead of an inline control, for instance).
 *
 * Re-renders when the answer changes: a tablet with a keyboard attached, or a
 * laptop whose touch screen becomes the primary input.
 */

import { useEffect, useState } from 'react'

export const COARSE_POINTER_QUERY = '(pointer: coarse)'

/** The bit of a MediaQueryList this reads; lets the test pass a plain object. */
type MatchesLike = Pick<MediaQueryList, 'matches'>

/** Pure read of a media query list, safe on a missing one. */
export function readCoarse(mql: MatchesLike | null | undefined): boolean {
  return mql?.matches === true
}

/** The live query, or null where there is no window or no matchMedia. */
export function coarsePointerQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(COARSE_POINTER_QUERY)
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => readCoarse(coarsePointerQuery()))

  useEffect(() => {
    const mql = coarsePointerQuery()
    if (!mql) return
    const update = () => setCoarse(readCoarse(mql))
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return coarse
}
