/**
 * storage/supabaseSharing.ts
 *
 * Client functions for planner sharing: managing share tokens (owner)
 * and fetching/mutating a shared planner (visitor with token).
 */

import type { AppState, DayState } from '../domain/types'
import { supabase } from '../lib/supabase'

export interface ShareToken {
  id: string
  token: string
  permission: 'view' | 'edit'
  label: string | null
  createdAt: string
}

interface ShareTokenRow {
  id: string
  token: string
  permission: 'view' | 'edit'
  label: string | null
  created_at: string
}

// ─── Owner: manage tokens ─────────────────────────────────────────────────────

export async function fetchShareTokens(userId: string): Promise<ShareToken[]> {
  const { data, error } = await supabase
    .from('share_tokens')
    .select('id, token, permission, label, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[sharing] Failed to fetch share tokens', error)
    return []
  }

  return ((data ?? []) as ShareTokenRow[]).map((r) => ({
    id: r.id,
    token: r.token,
    permission: r.permission,
    label: r.label,
    createdAt: r.created_at,
  }))
}

export async function createShareToken(
  userId: string,
  permission: 'view' | 'edit',
  label?: string,
): Promise<ShareToken | null> {
  const { data, error } = await supabase
    .from('share_tokens')
    .insert({ owner_user_id: userId, permission, label: label ?? null })
    .select('id, token, permission, label, created_at')
    .single()

  if (error) {
    console.error('[sharing] Failed to create share token:', error.message, error)
    // Re-throw so callers can show the real error to the user.
    throw new Error(error.message ?? 'Failed to create share token')
  }

  const r = data as ShareTokenRow
  return { id: r.id, token: r.token, permission: r.permission, label: r.label, createdAt: r.created_at }
}

export async function deleteShareToken(tokenId: string): Promise<void> {
  const { error } = await supabase.from('share_tokens').delete().eq('id', tokenId)
  if (error) console.error('[sharing] Failed to delete share token', error)
}

// ─── Visitor: load shared planner ─────────────────────────────────────────────

export interface SharedPlannerMeta {
  permission: 'view' | 'edit'
}

/** Validate a share token and return its permission level; null if invalid. */
export async function validateShareToken(token: string): Promise<SharedPlannerMeta | null> {
  const { data, error } = await supabase
    .from('share_tokens')
    .select('permission')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null
  return { permission: (data as { permission: 'view' | 'edit' }).permission }
}

/** Fetch all planner days for the owner of a given share token. */
export async function fetchSharedPlannerState(token: string): Promise<AppState | null> {
  const { data, error } = await supabase.rpc('get_shared_planner', { p_token: token })

  if (error) {
    console.error('[sharing] Failed to fetch shared planner', error)
    return null
  }

  const days: AppState['days'] = {}

  for (const row of (data ?? []) as {
    date: string
    tasks: DayState['tasks']
    deep_work_sessions: DayState['deepWorkSessions']
    habit_completions: Record<string, boolean> | null
    sleep_hours: number | null
    mood: string | null
  }[]) {
    const habitCompletions = row.habit_completions
    days[row.date] = {
      date: row.date,
      tasks: row.tasks ?? [],
      deepWorkSessions: row.deep_work_sessions ?? [],
      habitCompletions:
        habitCompletions && Object.keys(habitCompletions).length > 0
          ? habitCompletions
          : undefined,
      sleepHours: row.sleep_hours ?? undefined,
      mood: row.mood ?? undefined,
    }
  }

  return { days }
}

/** Upsert a day on the owner's planner via an edit-permission share token. */
export async function upsertSharedDay(token: string, date: string, dayState: DayState): Promise<void> {
  const { error } = await supabase.rpc('upsert_shared_day', {
    p_token: token,
    p_date: date,
    p_tasks: dayState.tasks,
    p_deep_work_sessions: dayState.deepWorkSessions,
  })

  if (error) console.error('[sharing] Failed to upsert shared day', error)
}
