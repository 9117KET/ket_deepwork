/**
 * convex/_shared/freeSlot.ts
 *
 * Where does a task fit in the day? Pure, so it can be tested without Google.
 *
 * Times are epoch milliseconds. Busy intervals may overlap, touch, or arrive
 * unsorted — that is how freeBusy returns them across several calendars.
 */

export interface BusyInterval {
  start: number
  end: number
}

export const SLOT_STEP_MS = 15 * 60_000

/** Round `ms` up to the next multiple of `step` (unchanged if already on one). */
export function ceilToStep(ms: number, step: number = SLOT_STEP_MS): number {
  return Math.ceil(ms / step) * step
}

/**
 * The earliest start in [from, to) where `durationMs` fits without touching a
 * busy interval, on a `step` grid so events land on :00/:15/:30/:45. Returns
 * null when the window has no gap long enough.
 */
export function findFreeSlot(params: {
  busy: BusyInterval[]
  from: number
  to: number
  durationMs: number
  step?: number
}): number | null {
  const { from, to, durationMs } = params
  const step = params.step ?? SLOT_STEP_MS
  if (durationMs <= 0 || to <= from) return null

  const busy = params.busy
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)

  let start = ceilToStep(from, step)
  for (const b of busy) {
    if (start + durationMs > to) return null
    if (b.end <= start) continue
    if (b.start >= start + durationMs) return start
    start = ceilToStep(Math.max(start, b.end), step)
  }
  return start + durationMs <= to ? start : null
}

/**
 * A Google Calendar event id derived from a deep work session id, so logging
 * the same block twice collides (409) instead of duplicating it.
 *
 * Google allows only base32hex (`a-v`, `0-9`), 5–1024 chars. Hex-encoding the
 * session id's UTF-8 bytes always lands inside that alphabet and keeps
 * distinct ids distinct.
 */
export function sessionEventId(sessionId: string): string {
  const bytes = new TextEncoder().encode(sessionId)
  let hex = ""
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0")
  return `deepblock${hex}`.slice(0, 1024)
}
