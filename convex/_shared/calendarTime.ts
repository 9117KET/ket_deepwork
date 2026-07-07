/**
 * convex/_shared/calendarTime.ts
 *
 * Pure timezone/date helpers for Google Calendar sync. No Convex or DOM deps —
 * only `Intl` and `Date` — so they're unit-testable in isolation (see
 * `e2e/calendar-timezone.spec.ts`).
 */

/** ISO `YYYY-MM-DD` for instant `d` as seen in `timezone`. */
export function toLocalIsoDay(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** `HH:MM` (24h) for instant `d` as seen in `timezone`. */
export function hhmmFromDate(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === "hour")?.value ?? "00"
  const m = parts.find((p) => p.type === "minute")?.value ?? "00"
  return `${h}:${m}`
}

/**
 * Offset (ms) of `timezone` from UTC at instant `at`, i.e.
 * (wall-clock time in timezone) − (UTC time). Positive east of UTC.
 */
export function tzOffsetMs(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0")
  const asWallUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  )
  return asWallUtc - at.getTime()
}

/**
 * UTC instant for a local wall-clock time (`isoDay` + `hms`) in `timezone`.
 * Accounts for the zone's offset (incl. DST) so callers can build a fetch
 * window over the user's actual local days rather than the server's UTC days.
 */
export function zonedWallTimeToUtc(isoDay: string, hms: string, timezone: string): Date {
  const naiveUtc = new Date(`${isoDay}T${hms}Z`)
  // First approximation, then correct again in case the offset differs at the
  // resulting instant (DST boundary safety).
  const firstPass = new Date(naiveUtc.getTime() - tzOffsetMs(naiveUtc, timezone))
  return new Date(naiveUtc.getTime() - tzOffsetMs(firstPass, timezone))
}
