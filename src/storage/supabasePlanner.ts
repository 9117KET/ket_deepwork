/**
 * storage/supabasePlanner.ts
 *
 * Supabase-backed persistence for the planner state.
 * Mirrors the AppState shape into the `planner_days` table.
 */

import type { AppState, DayState } from '../domain/types'
import { supabase } from '../lib/supabase'

interface PlannerDayRow {
  id: string
  user_id: string
  date: string
  tasks: unknown
  deep_work_sessions: unknown
  habit_completions?: unknown
  sleep_hours?: number | null
  mood?: string | null
  wake_time?: string | null
  sleep_target_time?: string | null
}

export async function fetchPlannerState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('planner_days')
    .select('id, user_id, date, tasks, deep_work_sessions, habit_completions, sleep_hours, mood, wake_time, sleep_target_time')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) {
    console.error('[planner] Failed to fetch planner_days from Supabase', error)
    return null
  }

  const days: AppState['days'] = {}

  for (const row of (data ?? []) as PlannerDayRow[]) {
    const tasks = (row.tasks as DayState['tasks'] | null) ?? []
    const deepWorkSessions = (row.deep_work_sessions as DayState['deepWorkSessions'] | null) ?? []
    const habitCompletions = (row.habit_completions as DayState['habitCompletions'] | null) ?? {}
    days[row.date] = {
      date: row.date,
      tasks,
      deepWorkSessions,
      habitCompletions: Object.keys(habitCompletions).length > 0 ? habitCompletions : undefined,
      sleepHours: row.sleep_hours ?? undefined,
      mood: row.mood ?? undefined,
      wakeTime: row.wake_time ?? undefined,
      sleepTarget: row.sleep_target_time ?? undefined,
    }
  }

  return { days, timeOffsetMinutes: undefined }
}

export async function upsertPlannerDays(userId: string, days: AppState['days']): Promise<void> {
  const payload = Object.values(days)
    .filter((day): day is DayState => Boolean(day))
    .map((day) => ({
      user_id: userId,
      date: day.date,
      tasks: day.tasks ?? [],
      deep_work_sessions: day.deepWorkSessions ?? [],
      habit_completions: day.habitCompletions ?? {},
      sleep_hours: day.sleepHours ?? null,
      mood: day.mood ?? null,
      wake_time: day.wakeTime ?? null,
      sleep_target_time: day.sleepTarget ?? null,
    }))

  if (payload.length === 0) {
    return
  }

  const { error } = await supabase.from('planner_days').upsert(payload, {
    onConflict: 'user_id,date',
  })

  if (error) {
    console.error('[planner] Failed to upsert planner_days to Supabase', error)
  }
}

