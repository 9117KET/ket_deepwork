/**
 * domain/tripImpact.ts
 *
 * Pure functions for computing the "trip impact summary" - a post-trip report
 * showing how well the user maintained their habits, deep work, and tasks
 * during the trip, computed from existing planner data.
 */

import { computeDailyDeepWorkMinutes } from "./stats"
import type { DayState } from "./types"

export interface TripImpactData {
  durationDays: number
  daysWithData: number
  habits: {
    tracked: number
    averageCompletionRate: number
    bestDay: string | null
    worstDay: string | null
    perHabit: Array<{ habitId: string; label: string; completedDays: number; rate: number }>
  }
  deepWork: {
    totalMinutes: number
    totalHours: number
    sessionsCount: number
    daysWithDeepWork: number
    averageMinutesPerDay: number
  }
  tasks: {
    totalCreated: number
    totalCompleted: number
    completionRate: number
    shallowCount: number
  }
  mood: {
    entries: number
    distribution: Record<string, number>
    mostCommon: string | null
  }
}

// ── Date range helpers ────────────────────────────────────────────────────────

export function getDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  const [sy, sm, sd] = startIso.split("-").map(Number)
  const [ey, em, ed] = endIso.split("-").map(Number)
  const start = Date.UTC(sy!, sm! - 1, sd!)
  const end = Date.UTC(ey!, em! - 1, ed!)
  for (let t = start; t <= end; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10))
  }
  return dates
}

// ── Impact computation ────────────────────────────────────────────────────────

export function computeTripImpact(
  startDate: string,
  endDate: string,
  dayStates: Record<string, DayState | undefined>,
  habitIds: string[],
  habitLabels: Record<string, string>,
): TripImpactData {
  const dates = getDateRange(startDate, endDate)
  const durationDays = dates.length
  const daysWithData = dates.filter((d) => dayStates[d] !== undefined).length

  // Habits
  const perHabitCounts: Record<string, number> = {}
  for (const id of habitIds) perHabitCounts[id] = 0

  let habitTotalRate = 0
  let habitDaysWithCompletions = 0
  let bestDay: { date: string; count: number } | null = null
  let worstDay: { date: string; count: number } | null = null

  for (const date of dates) {
    const day = dayStates[date]
    if (!day) continue
    const completions = day.habitCompletions ?? {}
    const completed = habitIds.filter((id) => completions[id] === true).length
    if (habitIds.length > 0) {
      const rate = completed / habitIds.length
      habitTotalRate += rate
      habitDaysWithCompletions++
      for (const id of habitIds) {
        if (completions[id] === true) perHabitCounts[id] = (perHabitCounts[id] ?? 0) + 1
      }
      if (!bestDay || completed > bestDay.count) bestDay = { date, count: completed }
      if (!worstDay || completed < worstDay.count) worstDay = { date, count: completed }
    }
  }

  const averageHabitRate = habitDaysWithCompletions > 0
    ? habitTotalRate / habitDaysWithCompletions
    : 0

  const perHabit = habitIds.map((id) => ({
    habitId: id,
    label: habitLabels[id] ?? id,
    completedDays: perHabitCounts[id] ?? 0,
    rate: daysWithData > 0 ? (perHabitCounts[id] ?? 0) / daysWithData : 0,
  }))

  // Deep work
  let totalDeepWorkMinutes = 0
  let sessionsCount = 0
  let daysWithDeepWork = 0

  for (const date of dates) {
    const day = dayStates[date]
    if (!day) continue
    const mins = computeDailyDeepWorkMinutes(day)
    if (mins > 0) {
      totalDeepWorkMinutes += mins
      daysWithDeepWork++
    }
    sessionsCount += (day.deepWorkSessions ?? []).filter((s) =>
      s.finishedAt && !s.cancelledAt
    ).length
  }

  // Tasks
  let totalCreated = 0
  let totalCompleted = 0
  let shallowCount = 0

  for (const date of dates) {
    const day = dayStates[date]
    if (!day) continue
    const rootTasks = day.tasks.filter((t) => !t.parentId)
    totalCreated += rootTasks.length
    totalCompleted += rootTasks.filter((t) => t.isDone).length
    shallowCount += rootTasks.filter((t) => t.isShallow === true).length
  }

  // Mood
  const moodDist: Record<string, number> = {}
  for (const date of dates) {
    const mood = dayStates[date]?.mood
    if (mood) moodDist[mood] = (moodDist[mood] ?? 0) + 1
  }
  const moodEntries = Object.values(moodDist).reduce((a, b) => a + b, 0)
  let mostCommonMood: string | null = null
  let maxMoodCount = 0
  for (const [mood, count] of Object.entries(moodDist)) {
    if (count > maxMoodCount) { maxMoodCount = count; mostCommonMood = mood }
  }

  return {
    durationDays,
    daysWithData,
    habits: {
      tracked: habitIds.length,
      averageCompletionRate: averageHabitRate,
      bestDay: bestDay?.date ?? null,
      worstDay: worstDay?.date ?? null,
      perHabit,
    },
    deepWork: {
      totalMinutes: totalDeepWorkMinutes,
      totalHours: parseFloat((totalDeepWorkMinutes / 60).toFixed(1)),
      sessionsCount,
      daysWithDeepWork,
      averageMinutesPerDay: daysWithData > 0
        ? Math.round(totalDeepWorkMinutes / daysWithData) : 0,
    },
    tasks: {
      totalCreated,
      totalCompleted,
      completionRate: totalCreated > 0 ? totalCompleted / totalCreated : 0,
      shallowCount,
    },
    mood: {
      entries: moodEntries,
      distribution: moodDist,
      mostCommon: mostCommonMood,
    },
  }
}
