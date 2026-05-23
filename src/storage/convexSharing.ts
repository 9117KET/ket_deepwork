/**
 * storage/convexSharing.ts
 *
 * Client-side helpers for planner sharing, backed by Convex.
 * Convex-backed implementation for planner sharing.
 */

import type { AppState, DayState } from "../domain/types"
import { convex } from "../lib/convex"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export interface ShareToken {
  id: string
  token: string
  permission: "view" | "edit"
  label: string | null
  createdAt: string
}

export interface SharedPlannerMeta {
  permission: "view" | "edit"
}

// ─── Owner: manage tokens ─────────────────────────────────────────────────────

type ShareTokenRow = {
  _id: string
  _creationTime: number
  token: string
  permission: "view" | "edit"
  label?: string
  ownerUserId: string
}

export async function fetchShareTokens(): Promise<ShareToken[]> {
  const rows = await convex.query(api.sharing.listTokens, {})
  return (rows ?? []).map((r: ShareTokenRow) => ({
    id: r._id as string,
    token: r.token,
    permission: r.permission,
    label: r.label ?? null,
    createdAt: new Date(r._creationTime).toISOString(),
  }))
}

export async function createShareToken(
  _userId: string,
  permission: "view" | "edit",
  label?: string,
): Promise<ShareToken | null> {
  const result = await convex.mutation(api.sharing.createToken, {
    permission,
    label: label ?? undefined,
  })
  return {
    id: result.id as string,
    token: result.token,
    permission: result.permission,
    label: result.label ?? null,
    createdAt: new Date().toISOString(),
  }
}

export async function deleteShareToken(tokenId: string): Promise<void> {
  await convex.mutation(api.sharing.deleteToken, { tokenId: tokenId as Id<"shareTokens"> })
}

// ─── Visitor: load shared planner ─────────────────────────────────────────────

export async function validateShareToken(token: string): Promise<SharedPlannerMeta | null> {
  const result = await convex.query(api.sharing.validateToken, { token })
  if (!result) return null
  return { permission: result.permission }
}

export async function fetchSharedPlannerState(token: string): Promise<AppState | null> {
  const rows = await convex.query(api.sharing.getSharedPlanner, { token })
  if (!rows) return null

  const days: AppState["days"] = {}
  for (const row of rows) {
    const habitCompletions = row.habitCompletions as Record<string, boolean> | null | undefined
    days[row.date] = {
      date: row.date,
      tasks: (row.tasks as DayState["tasks"]) ?? [],
      deepWorkSessions: (row.deepWorkSessions as DayState["deepWorkSessions"]) ?? [],
      habitCompletions:
        habitCompletions && Object.keys(habitCompletions).length > 0 ? habitCompletions : undefined,
      sleepHours: (row.sleepHours as number | undefined) ?? undefined,
      mood: (row.mood as string | undefined) ?? undefined,
    }
  }

  return { days }
}

export async function upsertSharedDay(token: string, date: string, dayState: DayState): Promise<void> {
  await convex.mutation(api.sharing.upsertSharedDay, {
    token,
    date,
    tasks: dayState.tasks,
    deepWorkSessions: dayState.deepWorkSessions ?? [],
  })
}
