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
  time_offset_minutes?: number | null
}

export async function fetchPlannerState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('planner_days')
    .select('id, user_id, date, tasks, deep_work_sessions, time_offset_minutes')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) {
    console.error('[planner] Failed to fetch planner_days from Supabase', error)
    return null
  }

  const days: AppState['days'] = {}
  let timeOffsetMinutes: number | undefined

  for (const row of (data ?? []) as PlannerDayRow[]) {
    const tasks = (row.tasks as DayState['tasks'] | null) ?? []
    const deepWorkSessions = (row.deep_work_sessions as DayState['deepWorkSessions'] | null) ?? []
    days[row.date] = {
      date: row.date,
      tasks,
      deepWorkSessions,
    }
    if (timeOffsetMinutes === undefined && typeof row.time_offset_minutes === 'number') {
      timeOffsetMinutes = row.time_offset_minutes
    }
  }

  return { days, timeOffsetMinutes }
}

export async function upsertPlannerDays(
  userId: string,
  days: AppState['days'],
  timeOffsetMinutes?: number,
): Promise<void> {
  const payload = Object.values(days)
    .filter((day): day is DayState => Boolean(day))
    .map((day) => ({
      user_id: userId,
      date: day.date,
      tasks: day.tasks ?? [],
      deep_work_sessions: day.deepWorkSessions ?? [],
      time_offset_minutes: timeOffsetMinutes ?? 0,
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

