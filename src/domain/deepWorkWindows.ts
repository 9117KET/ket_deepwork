/**
 * domain/deepWorkWindows.ts
 *
 * Pure functions for detecting deep work windows within a travel itinerary.
 * A "window" is a stretch of unstructured time where focused work is realistic.
 * No framework dependencies - fully unit-testable.
 */

export interface Activity {
  time: string
  name: string
  type: string
  durationMinutes: number
  notes?: string
}

export interface DayPlan {
  day: number
  theme: string
  activities: Activity[]
}

export type WindowKind = "transport_leg" | "free_morning" | "free_day"

export interface DeepWorkWindow {
  day: number
  kind: WindowKind
  label: string
  reason: string
  estimatedMinutes: number
  activityIndex?: number
}

// ── Time parsing ──────────────────────────────────────────────────────────────

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  if (h === undefined || isNaN(h)) return 0
  return h * 60 + (m ?? 0)
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// ── Window detection ──────────────────────────────────────────────────────────

const TRANSPORT_KEYWORDS = /flight|train|bus|ferry|coach|transfer|transit|airport|station/i
const REST_KEYWORDS = /rest|free|relax|leisure|nothing|open|flexible|optional/i
const DEEP_WORK_MIN_TRANSPORT = 180

export function detectTransportLegs(day: DayPlan): DeepWorkWindow[] {
  const windows: DeepWorkWindow[] = []
  day.activities.forEach((act, i) => {
    if (
      (act.type === "transport" || TRANSPORT_KEYWORDS.test(act.name)) &&
      act.durationMinutes >= DEEP_WORK_MIN_TRANSPORT
    ) {
      const hours = Math.floor(act.durationMinutes / 60)
      windows.push({
        day: day.day,
        kind: "transport_leg",
        label: `${act.name} (Day ${day.day})`,
        reason: `${hours}h transport leg — ideal for offline deep work`,
        estimatedMinutes: Math.floor(act.durationMinutes * 0.7),
        activityIndex: i,
      })
    }
  })
  return windows
}

export function detectFreeMorning(day: DayPlan): DeepWorkWindow | null {
  if (day.activities.length === 0) return null
  const sorted = [...day.activities].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  )
  const firstActivity = sorted[0]!
  const firstStart = parseTimeToMinutes(firstActivity.time)
  const morningEnd = 10 * 60

  if (firstStart >= morningEnd) {
    const freeMinutes = firstStart - 7 * 60
    if (freeMinutes < 60) return null
    return {
      day: day.day,
      kind: "free_morning",
      label: `Free morning — Day ${day.day}`,
      reason: `No activities until ${firstActivity.time} — ${Math.floor(freeMinutes / 60)}h of quiet morning time`,
      estimatedMinutes: Math.min(freeMinutes, 180),
    }
  }
  return null
}

export function detectFreeDay(day: DayPlan): DeepWorkWindow | null {
  const hasRestTheme = REST_KEYWORDS.test(day.theme)
  const fewActivities = day.activities.length <= 1
  const onlyShallowActivities = day.activities.every(
    (a) => a.type === "logistics" || a.type === "transport"
  )

  if (hasRestTheme || (fewActivities && onlyShallowActivities)) {
    return {
      day: day.day,
      kind: "free_day",
      label: `Flexible day — Day ${day.day}`,
      reason: hasRestTheme
        ? `Day theme "${day.theme}" suggests unstructured time`
        : "Minimal scheduled activities — could protect a deep work block",
      estimatedMinutes: 180,
    }
  }
  return null
}

export function findDeepWorkWindows(dailyPlan: DayPlan[]): DeepWorkWindow[] {
  const windows: DeepWorkWindow[] = []
  for (const day of dailyPlan) {
    windows.push(...detectTransportLegs(day))
    const morning = detectFreeMorning(day)
    if (morning) windows.push(morning)
    const freeDay = detectFreeDay(day)
    if (freeDay) windows.push(freeDay)
  }
  return windows
}

// ── Deep work activity builder ────────────────────────────────────────────────

export function buildDeepWorkActivity(
  window: DeepWorkWindow,
  label = "Deep work block",
): Activity {
  const startTime = window.kind === "free_morning" ? "07:00" : "09:00"
  return {
    time: startTime,
    name: label,
    type: "deep_work",
    durationMinutes: window.estimatedMinutes,
    notes: window.reason,
  }
}
