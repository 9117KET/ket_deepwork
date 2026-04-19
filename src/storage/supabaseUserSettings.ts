/**
 * storage/supabaseUserSettings.ts
 *
 * Supabase persistence for user-level tracking settings: habit definitions and month titles.
 * Used when signed in; guests rely on localStorage only.
 */

import type { AppState, BlockDurationRatios, GoalCascade, HabitDefinition, MonthlyReview, NotDoingItem } from '../domain/types'
import { supabase } from '../lib/supabase'

export interface UserSettingsRow {
  user_id: string
  habit_definitions: unknown
  month_titles: unknown
  streak?: number
  last_open_date?: string | null
  active_days?: unknown
  block_duration_ratios?: unknown
  not_doing_list?: unknown
  identity_statement?: string | null
  depth_philosophy?: string | null
  deep_work_goal_hours?: number | null
  one_thing_data?: Record<string, unknown> | null
}

export interface UserSettings {
  habitDefinitions: HabitDefinition[]
  monthTitles: Record<string, string>
  /** All ISO dates when the app was opened; streak is computed from this. */
  activeDays: string[]
  /** Global default block split (scaled per day to wake/sleep window). */
  blockDurationRatios: BlockDurationRatios | null
  /** Global persistent not-doing commitments (Drucker). */
  notDoingList: NotDoingItem[]
  /** "I am X" identity declaration (Atomic Habits). */
  identityStatement: string
  /** Cal Newport depth philosophy. */
  depthPhilosophy: AppState['depthPhilosophy']
  /** Weekly deep work goal in hours. */
  deepWorkGoalHoursPerWeek: number | null
  // ── The ONE Thing ──────────────────────────────────────────────
  northStar: string
  goalCascade: GoalCascade | null
  dayOneThings: Record<string, string>
  weekOneThings: Record<string, string>
  monthOneThings: Record<string, string>
  monthlyReviews: Record<string, MonthlyReview>
  monthlyReviewQuestions: string[]
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
  const notDoingList = (row.not_doing_list as NotDoingItem[] | null) ?? []
  const identityStatement = row.identity_statement ?? ''
  const depthPhilosophy = (row.depth_philosophy as AppState['depthPhilosophy']) ?? undefined
  const deepWorkGoalHoursPerWeek = row.deep_work_goal_hours ?? null
  const ot = (row.one_thing_data ?? {}) as Record<string, unknown>
  const northStar = (ot.northStar as string) ?? ''
  const goalCascade = (ot.goalCascade as GoalCascade | null) ?? null
  const dayOneThings = (ot.dayOneThings as Record<string, string>) ?? {}
  const weekOneThings = (ot.weekOneThings as Record<string, string>) ?? {}
  const monthOneThings = (ot.monthOneThings as Record<string, string>) ?? {}
  const monthlyReviews = (ot.monthlyReviews as Record<string, MonthlyReview>) ?? {}
  const monthlyReviewQuestions = (ot.monthlyReviewQuestions as string[]) ?? []
  return { habitDefinitions, monthTitles, activeDays, blockDurationRatios, notDoingList, identityStatement, depthPhilosophy, deepWorkGoalHoursPerWeek, northStar, goalCascade, dayOneThings, weekOneThings, monthOneThings, monthlyReviews, monthlyReviewQuestions }
}

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('habit_definitions, month_titles, streak, last_open_date, active_days, block_duration_ratios, not_doing_list, identity_statement, depth_philosophy, deep_work_goal_hours, one_thing_data')
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
      not_doing_list: settings.notDoingList,
      identity_statement: settings.identityStatement || null,
      depth_philosophy: settings.depthPhilosophy ?? null,
      deep_work_goal_hours: settings.deepWorkGoalHoursPerWeek ?? null,
      one_thing_data: {
        northStar: settings.northStar || null,
        goalCascade: settings.goalCascade ?? null,
        dayOneThings: settings.dayOneThings,
        weekOneThings: settings.weekOneThings,
        monthOneThings: settings.monthOneThings,
        monthlyReviews: settings.monthlyReviews,
        monthlyReviewQuestions: settings.monthlyReviewQuestions,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('[user_settings] Failed to upsert to Supabase', error)
  }
}
