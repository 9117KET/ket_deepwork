/**
 * domain/workSafety.ts
 *
 * The rules that stop an ordinary action from destroying recorded work.
 *
 * Everything here is about one asymmetry: a task can be retyped in five
 * seconds, but the ninety minutes you actually sat and worked cannot be
 * recovered by any means once the record is gone. So the ledger — deep work
 * sessions and hand-logged minutes — gets protections the rest of the planner
 * does not need.
 *
 * Pure functions on purpose. The handlers that call these live inside React
 * state and are awkward to test; these are the parts that must be right.
 */

import type { DayState, DeepWorkSession, Task } from './types'

/**
 * Below this, a partially-elapsed block is not worth interrupting anyone over.
 * A block abandoned twenty seconds in is a misclick, not lost work.
 */
export const MIN_BANKABLE_MINUTES = 1

/**
 * The day a block's minutes belong to: the day it **started**, never the day
 * currently on screen.
 *
 * This exists because the live completion path used to credit `selectedDay`.
 * Start a block, page back to yesterday to check something, let the block land
 * — and ninety minutes of today's work were written onto yesterday, where they
 * silently inflated a day that was already closed. The away-block path already
 * did this correctly by carrying `dayIso`; this makes both paths agree.
 */
export function blockDayIso(
  startedAt: string | null | undefined,
  fallbackDayIso: string,
): string {
  if (!startedAt) return fallbackDayIso
  const parsed = new Date(startedAt)
  if (Number.isNaN(parsed.getTime())) return fallbackDayIso
  // Local date, matching how the planner keys its days everywhere else.
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Minutes worth banking from a block that is being stopped early.
 *
 * Derived from what the countdown has left rather than from wall-clock time
 * since it started, because those differ the moment anyone pauses: a block
 * paused over lunch has burned an hour of clock and none of it was work. The
 * countdown is the only thing that actually measures the interval.
 *
 * Clamped at both ends so a clock jump or a corrupted remainder cannot
 * manufacture credit that was never earned.
 */
export function bankableMinutes(totalMinutes: number, remainingMs: number): number {
  const totalMs = Math.max(0, Math.round(totalMinutes)) * 60_000
  if (totalMs === 0) return 0
  const remaining = Number.isFinite(remainingMs) ? remainingMs : 0
  const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - Math.max(0, remaining)))
  return Math.floor(elapsedMs / 60_000)
}

/** Recorded work that would be affected by removing a set of tasks. */
export interface TaskWorkSummary {
  /** Minutes earned against these tasks by a timer. Survive deletion. */
  sessionMinutes: number
  /** How many sessions are attributed to them. */
  sessionCount: number
  /**
   * Hand-logged minutes. These live ON the task, so deleting it destroys them
   * outright — there is no other record anywhere.
   */
  manualMinutes: number
  /** True when anything at all would be affected. */
  hasRecordedWork: boolean
  /** True when something would be destroyed rather than merely detached. */
  hasIrrecoverableWork: boolean
}

const EMPTY_SUMMARY: TaskWorkSummary = {
  sessionMinutes: 0,
  sessionCount: 0,
  manualMinutes: 0,
  hasRecordedWork: false,
  hasIrrecoverableWork: false,
}

/**
 * What removing these tasks would cost.
 *
 * The two kinds of minutes are counted separately because they have different
 * fates. A `DeepWorkSession` is stored on the day, so it survives the task and
 * keeps counting toward the weekly scoreboard — it only loses the label saying
 * what it was for. `manualLoggedMinutes` is a field on the task itself and goes
 * with it. Only the second kind justifies stopping someone.
 */
export function summarizeTaskWork(
  day: Pick<DayState, 'tasks' | 'deepWorkSessions'> | undefined,
  taskIds: readonly string[],
): TaskWorkSummary {
  if (!day || taskIds.length === 0) return { ...EMPTY_SUMMARY }
  const ids = new Set(taskIds)

  let manualMinutes = 0
  for (const task of day.tasks ?? []) {
    if (ids.has(task.id)) manualMinutes += Math.max(0, task.manualLoggedMinutes ?? 0)
  }

  let sessionMinutes = 0
  let sessionCount = 0
  for (const session of day.deepWorkSessions ?? []) {
    if (session.taskId && ids.has(session.taskId)) {
      sessionMinutes += Math.max(0, session.durationMinutes ?? 0)
      sessionCount += 1
    }
  }

  return {
    sessionMinutes,
    sessionCount,
    manualMinutes,
    hasRecordedWork: sessionMinutes > 0 || manualMinutes > 0,
    hasIrrecoverableWork: manualMinutes > 0,
  }
}

/** All ids in a task tree — the task plus every descendant, at any depth. */
export function taskWithDescendantIds(tasks: readonly Task[], rootId: string): string[] {
  const out = [rootId]
  const queue = [rootId]
  // Breadth-first, guarded against a parentId cycle in corrupted state.
  const seen = new Set(out)
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const task of tasks) {
      if (task.parentId === current && !seen.has(task.id)) {
        seen.add(task.id)
        out.push(task.id)
        queue.push(task.id)
      }
    }
  }
  return out
}

/**
 * One plain sentence for a confirmation, or null when nothing is at stake and
 * the action should just happen.
 *
 * Deliberately says what survives as well as what does not: a warning that
 * overstates the damage trains people to click through it.
 */
export function describeWorkLoss(summary: TaskWorkSummary, taskCount = 1): string | null {
  if (!summary.hasRecordedWork) return null
  const subject = taskCount === 1 ? 'This task' : `These ${taskCount} tasks`
  const parts: string[] = []

  if (summary.manualMinutes > 0) {
    parts.push(`${formatMinutes(summary.manualMinutes)} you logged by hand will be lost`)
  }
  if (summary.sessionMinutes > 0) {
    const blocks = summary.sessionCount === 1 ? 'block' : 'blocks'
    parts.push(
      `${formatMinutes(summary.sessionMinutes)} of timed work ` +
        `(${summary.sessionCount} ${blocks}) stays in your totals but loses its label`,
    )
  }

  return `${subject} has recorded work. ${joinClauses(parts)}.`
}

/**
 * Detach sessions from tasks that no longer exist rather than deleting them.
 *
 * The minutes were really worked, so they keep counting; they simply become
 * unattributed, exactly as if the timer had run with no task selected. The
 * original title is folded into the label so the record still says something.
 */
export function detachSessionsFromTasks(
  sessions: readonly DeepWorkSession[],
  tasks: readonly Task[],
  removedIds: readonly string[],
): DeepWorkSession[] {
  const ids = new Set(removedIds)
  if (ids.size === 0) return [...sessions]
  const titleById = new Map(tasks.map((t) => [t.id, t.title]))

  return sessions.map((session) => {
    if (!session.taskId || !ids.has(session.taskId)) return session
    const title = titleById.get(session.taskId)
    const { taskId: _dropped, ...rest } = session
    return {
      ...rest,
      label: title && !session.label.includes(title) ? `${session.label} — ${title}` : session.label,
    }
  })
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}
