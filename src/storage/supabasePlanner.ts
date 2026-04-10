/**
 * storage/supabasePlanner.ts
 *
 * Supabase-backed persistence for the planner state.
 * Mirrors the AppState shape into the `planner_days` table.
 */

import type { AppState, AbandonedTask, BlockDurations, DayState, NotDoingItem } from '../domain/types'
import { supabase } from '../lib/supabase'

/** Row shape from `planner_days` (API + Realtime payloads). */
export interface PlannerDayRow {
  id: string
  user_id: string
  date: string
  tasks: unknown
  deep_work_sessions: unknown
  habit_completions?: unknown
  sleep_hours?: number | null
  mood?: string | null
  bed_time?: string | null
  wake_time?: string | null
  sleep_target_time?: string | null
  block_durations?: unknown
  not_doing_items?: unknown
  abandoned_tasks?: unknown
}

/** Map a DB row to client `DayState` (fetch + Realtime). */
export function plannerDayRowToDayState(row: PlannerDayRow): DayState {
  const tasks = (row.tasks as DayState['tasks'] | null) ?? []
  const deepWorkSessions = (row.deep_work_sessions as DayState['deepWorkSessions'] | null) ?? []
  const habitCompletions = (row.habit_completions as DayState['habitCompletions'] | null) ?? {}
  const blockDurations = row.block_durations as BlockDurations | null | undefined
  const notDoingItems = (row.not_doing_items as NotDoingItem[] | null) ?? undefined
  const abandonedTasks = (row.abandoned_tasks as AbandonedTask[] | null) ?? undefined
  return {
    date: row.date,
    tasks,
    deepWorkSessions,
    habitCompletions: Object.keys(habitCompletions).length > 0 ? habitCompletions : undefined,
    sleepHours: row.sleep_hours ?? undefined,
    mood: row.mood ?? undefined,
    bedTime: row.bed_time ?? undefined,
    wakeTime: row.wake_time ?? undefined,
    sleepTarget: row.sleep_target_time ?? undefined,
    blockDurations: blockDurations ?? undefined,
    notDoingItems: notDoingItems && notDoingItems.length > 0 ? notDoingItems : undefined,
    abandonedTasks: abandonedTasks && abandonedTasks.length > 0 ? abandonedTasks : undefined,
  }
}

export async function fetchPlannerState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('planner_days')
    .select(
      'id, user_id, date, tasks, deep_work_sessions, habit_completions, sleep_hours, mood, bed_time, wake_time, sleep_target_time, block_durations, not_doing_items, abandoned_tasks',
    )
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) {
    console.error('[planner] Failed to fetch planner_days from Supabase', error)
    return null
  }

  const days: AppState['days'] = {}

  for (const row of (data ?? []) as PlannerDayRow[]) {
    days[row.date] = plannerDayRowToDayState(row)
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
      bed_time: day.bedTime ?? null,
      wake_time: day.wakeTime ?? null,
      sleep_target_time: day.sleepTarget ?? null,
      block_durations: day.blockDurations ?? null,
      not_doing_items: day.notDoingItems ?? [],
      abandoned_tasks: day.abandonedTasks ?? [],
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

