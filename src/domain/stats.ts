/**
 * domain/stats.ts
 *
 * Functions for computing weekly task completion statistics.
 */

import type { AppState, WeeklyStats, WeeklyStatsDaySummary } from './types'
import { weekForDay } from './dateUtils'

export function computeWeeklyStats(state: AppState, referenceDayIso: string): WeeklyStats {
  const week = weekForDay(referenceDayIso)

  const days: WeeklyStatsDaySummary[] = week.days.map((dayIso) => {
    const dayState = state.days[dayIso]
    const totalCount = dayState?.tasks.length ?? 0
    const completedCount = dayState?.tasks.filter((task) => task.isDone).length ?? 0

    return {
      date: dayIso,
      completedCount,
      totalCount,
    }
  })

  const totalCompleted = days.reduce((sum, day) => sum + day.completedCount, 0)
  const totalTasks = days.reduce((sum, day) => sum + day.totalCount, 0)

  return {
    days,
    totalCompleted,
    totalTasks,
  }
}

export function computeDayCompletion(state: AppState, dayIso: string): WeeklyStatsDaySummary {
  const dayState = state.days[dayIso]
  const totalCount = dayState?.tasks.length ?? 0
  const completedCount = dayState?.tasks.filter((task) => task.isDone).length ?? 0

  return {
    date: dayIso,
    completedCount,
    totalCount,
  }
}

