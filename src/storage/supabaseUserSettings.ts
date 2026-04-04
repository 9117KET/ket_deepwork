/**
 * storage/supabaseUserSettings.ts
 *
 * Supabase persistence for user-level tracking settings: habit definitions and month titles.
 * Used when signed in; guests rely on localStorage only.
 */

import type { BlockDurationRatios, HabitDefinition } from '../domain/types'
import { supabase } from '../lib/supabase'

export interface UserSettingsRow {
  user_id: string
  habit_definitions: unknown
  month_titles: unknown
  streak?: number
  last_open_date?: string | null
  active_days?: unknown
  block_duration_ratios?: unknown
}

export interface UserSettings {
  habitDefinitions: HabitDefinition[]
  monthTitles: Record<string, string>
  /** All ISO dates when the app was opened; streak is computed from this. */
  activeDays: string[]
  /** Global default block split (scaled per day to wake/sleep window). */
  blockDurationRatios: BlockDurationRatios | null
}

/** Map a `user_settings` row to app fields (fetch + Realtime). */
export function userSettingsRowToAppStatePatch(row: UserSettingsRow): UserSettings {
  const habitDefinitions = (row.habit_definitions as HabitDefinition[] | null) ?? []
  const monthTitles = (row.month_titles as Record<string, string> | null) ?? {}
  let activeDays = (row.active_days as string[] | null) ?? []
  if (activeDays.length === 0 && row.last_open_date) {
    activeDays = [row.last_open_date]
  }
  const blockDurationRatios = (row.block_duration_ratios as BlockDurationRatios | null) ?? null
  return { habitDefinitions, monthTitles, activeDays, blockDurationRatios }
}

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('habit_definitions, month_titles, streak, last_open_date, active_days, block_duration_ratios')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[user_settings] Failed to fetch from Supabase', error)
    return null
  }

  const row = data as UserSettingsRow | null
  if (!row) return null

  return userSettingsRowToAppStatePatch(row)
}

export async function upsertUserSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      habit_definitions: settings.habitDefinitions,
      month_titles: settings.monthTitles,
      active_days: settings.activeDays,
      block_duration_ratios: settings.blockDurationRatios,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('[user_settings] Failed to upsert to Supabase', error)
  }
}
