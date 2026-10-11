/**
 * domain/dateUtils.ts
 *
 * Centralised date helpers so that all date logic is easy to adjust later.
 */

import type { DayState } from './types'

export function toLocalDayIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toLocalDayIso(new Date())
}

/**
 * Streak rule:
 * A day counts only if it has at least one task AND at least one task is completed.
 * This avoids \"gaming\" by opening/skipping days without completing anything.
 */
export function dayCountsForStreak(day: DayState | undefined): boolean {
  const tasks = day?.tasks ?? []
  return tasks.length > 0 && tasks.some((t) => t.isDone)
}

export function deriveActiveDaysFromDays(days: Record<string, DayState | undefined>): string[] {
  return Object.keys(days)
    .filter(Boolean)
    .filter((iso) => dayCountsForStreak(days[iso]))
    .sort()
}

export interface AccountabilityStats {
  /** Consecutive active days ending on the most recent active day (current streak). */
  streak: number
  /** Longest consecutive run of active days ever in history. */
  bestStreak: number
  /** Total calendar days from first use to today (inclusive). */
  totalDays: number
  /** Days you were active (unique entries in activeDays). */
  daysActive: number
  /** Calendar days between first use and today that you were NOT active. */
  daysMissed: number
  /** ISO date of the earliest recorded active day, or null if none. */
  firstActiveDate: string | null
}

/**
 * Full accountability picture from the activeDays history.
 * Pass the full `days` record for accurate missed-day counting:
 * a "missed" day is one where the user had tasks but completed none.
 * Without `days`, falls back to calendar-based estimation.
 */
export function computeAccountabilityStats(
  activeDays: string[],
  days?: Record<string, DayState | undefined>,
): AccountabilityStats {
  const today = todayIso()

  if (activeDays.length === 0 && !days) {
    return { streak: 0, bestStreak: 0, totalDays: 0, daysActive: 0, daysMissed: 0, firstActiveDate: null }
  }

  const sorted = [...new Set(activeDays)].sort()
  const daysActive = sorted.length
  const first = sorted[0] ?? null

  // Total calendar days from first active day to today, inclusive.
  let totalDays = 0
  if (first) {
    let cur = first
    while (cur <= today) { totalDays++; cur = addDays(cur, 1) }
  }

  // Missed = days where the user had tasks but completed none (past days only).
  // This matches the monthly tracker's definition and avoids penalising days
  // the user never opened the planner.
  let daysMissed: number
  if (days) {
    daysMissed = Object.keys(days)
      .filter((iso) => iso < today)
      .filter((iso) => {
        const day = days[iso]
        return day && (day.tasks?.length ?? 0) > 0 && !dayCountsForStreak(day)
      }).length
  } else {
    // Fallback: calendar-based, excluding today-not-yet-active
    const todayIsActive = sorted.includes(today)
    daysMissed = Math.max(0, totalDays - daysActive - (todayIsActive ? 0 : 1))
  }

  return {
    streak: computeStreak(sorted),
    bestStreak: computeBestStreak(activeDays),
    totalDays,
    daysActive,
    daysMissed,
    firstActiveDate: first,
  }
}

/**
 * Longest consecutive run of active days ending at the most recent date.
 * Used for streak display so all historical opens are counted.
 */
export function computeStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0
  const sorted = [...new Set(activeDays)].sort()
  const end = sorted[sorted.length - 1]!
  let count = 1
  let current = end
  for (let i = sorted.length - 2; i >= 0; i--) {
    const prev = sorted[i]!
    const expectedPrev = addDays(current, -1)
    if (prev !== expectedPrev) break
    count += 1
    current = prev
  }
  return count
}

/**
 * Longest consecutive run of active days anywhere in history (same inputs as computeStreak).
 */
export function computeBestStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0
  const sorted = [...new Set(activeDays)].sort()
  let maxRun = 1
  let currentRun = 1
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    if (cur === addDays(prev, 1)) {
      currentRun += 1
    } else {
      maxRun = Math.max(maxRun, currentRun)
      currentRun = 1
    }
  }
  return Math.max(maxRun, currentRun)
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

