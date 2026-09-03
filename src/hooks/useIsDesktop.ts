/**
 * hooks/useIsDesktop.ts
 *
 * Whether the viewport is at the `lg` breakpoint, as a value React can branch on.
 *
 * Tailwind's `lg:hidden` is the right tool for showing and hiding, and almost
 * everywhere in this app that is what we use. This hook is for the case CSS
 * cannot cover: not rendering something at all. The Review screen's month-scale
 * content mounts two 31-column grids and five editors; hiding that on a phone
 * still builds every node, still runs every `useMemo`, and still costs the
 * scroll height of a page nobody asked to see.
 *
 * Matches `lg` in `tailwind.config.js` (1024px). If you change that breakpoint,
 * change this one.
 */

import { useEffect, useState } from 'react'

const QUERY = '(min-width: 1024px)'

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    // SSR and older browsers: assume desktop, so the fallback renders more
    // rather than less. Content that is present but unwanted is a layout
    // problem; content that is absent is a missing feature.
    if (typeof window === 'undefined' || !window.matchMedia) return true
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
