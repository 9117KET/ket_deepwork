/**
 * domain/dateUtils.ts
 *
 * Centralised date helpers so that all date logic is easy to adjust later.
 */

export function toLocalDayIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toLocalDayIso(new Date())
}

export function addDays(isoDay: string, delta: number): string {
  const [year, month, day] = isoDay.split('-').map((part) => Number(part))
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + delta)
  return toLocalDayIso(date)
}

export interface WeekRange {
  start: string
  end: string
  days: string[]
}

/**
 * Returns Monday–Sunday week (ISO-like) for the given day.
 */
export function weekForDay(isoDay: string): WeekRange {
  const [year, month, day] = isoDay.split('-').map((part) => Number(part))
  const date = new Date(year, month - 1, day)

  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const startDate = new Date(date)
  startDate.setDate(date.getDate() + mondayOffset)

  const days: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push(toLocalDayIso(d))
  }

  return {
    start: days[0]!,
    end: days[6]!,
    days,
  }
}

/**
 * Same weekday in the previous week (e.g. last Thursday from this Thursday).
 * Used to replicate a weekly template.
 */
export function sameWeekdayLastWeek(isoDay: string): string {
  return addDays(isoDay, -7)
}

/**
 * Normalize time string to HH:mm for storage and comparison.
 * Handles "9:0" -> "09:00" so persistence and due-now checks are consistent.
 */
export function normalizeHhmm(value: string): string {
  const parts = value.trim().split(':').map((p) => p.replace(/\D/g, ''))
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

