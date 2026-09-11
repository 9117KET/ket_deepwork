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
  /** All hand-logged minutes affected, whichever record holds them. */
  manualMinutes: number
  /**
   * The subset of those that would be destroyed outright: minutes held in the
   * legacy per-task total, which goes with the task and exists nowhere else.
   * Hand-logged entries recorded as sessions are detached like timed ones.
   */
  irrecoverableMinutes: number
  /** True when anything at all would be affected. */
  hasRecordedWork: boolean
  /** True when something would be destroyed rather than merely detached. */
  hasIrrecoverableWork: boolean
}

const EMPTY_SUMMARY: TaskWorkSummary = {
  sessionMinutes: 0,
  sessionCount: 0,
  manualMinutes: 0,
  irrecoverableMinutes: 0,
  hasRecordedWork: false,
  hasIrrecoverableWork: false,
}

/**
 * What removing these tasks would cost.
 *
 * The kinds of minutes are counted separately because they have different
 * fates. A `DeepWorkSession` is stored on the day, so it survives the task and
 * only loses the label saying what it was for — true of a timed block and now
 * equally true of a stretch logged by hand, which is a session as well. What
 * still dies with the task is the legacy `manualLoggedMinutes` total from
 * before that was so, and it is the only thing that justifies stopping someone.
 */
export function summarizeTaskWork(
  day: Pick<DayState, 'tasks' | 'deepWorkSessions'> | undefined,
  taskIds: readonly string[],
): TaskWorkSummary {
  if (!day || taskIds.length === 0) return { ...EMPTY_SUMMARY }
  const ids = new Set(taskIds)

  let irrecoverableMinutes = 0
  for (const task of day.tasks ?? []) {
    if (ids.has(task.id)) irrecoverableMinutes += Math.max(0, task.manualLoggedMinutes ?? 0)
  }

  let sessionMinutes = 0
  let sessionCount = 0
  let manualSessionMinutes = 0
  for (const session of day.deepWorkSessions ?? []) {
    if (!session.taskId || !ids.has(session.taskId)) continue
    if (session.cancelledAt) continue
    const minutes = Math.max(0, session.durationMinutes ?? 0)
    if (session.source === 'manual') {
      manualSessionMinutes += minutes
      continue
    }
    sessionMinutes += minutes
    sessionCount += 1
  }

  const manualMinutes = manualSessionMinutes + irrecoverableMinutes
  return {
    sessionMinutes,
    sessionCount,
    manualMinutes,
    irrecoverableMinutes,
    hasRecordedWork: sessionMinutes > 0 || manualMinutes > 0,
    hasIrrecoverableWork: irrecoverableMinutes > 0,
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

  if (summary.irrecoverableMinutes > 0) {
    parts.push(`${formatMinutes(summary.irrecoverableMinutes)} you logged by hand will be lost`)
  }
  const survivingManual = summary.manualMinutes - summary.irrecoverableMinutes
  if (survivingManual > 0) {
    parts.push(
      `${formatMinutes(survivingManual)} logged by hand stays on the day but loses its label`,
    )
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

/**
 * Point a session at a different task, or at none.
 *
 * The gap this closes: pick the wrong task in "Working on", run ninety minutes,
 * and those minutes were stuck on the wrong row for good. Nothing in the app
 * could move them, and the only lever that touched them at all was deleting the
 * task - which is to say the only remedy for a mislabelled record was to
 * destroy the label entirely.
 *
 * Re-attribution is not destruction, so it needs no confirmation and no undo of
 * its own: the minutes, the instants and the duration are untouched, and only
 * the answer to "what was this for" changes. That is also why this refuses to
 * do anything else - a function that could quietly adjust `durationMinutes`
 * while renaming would be a way to launder invented work into the ledger.
 *
 * A hand-logged entry takes the new task's title, since its label was only ever
 * a copy of it. A timed block keeps the label the person gave the block.
 */
export function reattributeSession(
  sessions: readonly DeepWorkSession[],
  sessionId: string,
  toTaskId: string | undefined,
  tasks: readonly Task[],
): DeepWorkSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session
    if (!toTaskId) {
      const { taskId: _dropped, ...rest } = session
      return rest
    }
    const target = tasks.find((task) => task.id === toTaskId)
    if (!target) return session
    return {
      ...session,
      taskId: toTaskId,
      label: session.source === 'manual' ? target.title : session.label,
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
