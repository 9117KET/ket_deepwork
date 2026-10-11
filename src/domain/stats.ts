/**
 * domain/stats.ts
 *
 * Habit streaks and the daily deep work totals — earned (timer) and
 * self-reported (by hand) kept strictly apart.
 */

import type { DayState } from './types'
import { addDays } from './dateUtils'

/**
 * For each habit id, compute the current consecutive-day streak ending on `untilDate`.
 * A day counts when `habitCompletions[habitId] === true`.
 * Caps lookback at 365 days.
 */
export function computePerHabitStreaks(
  days: Record<string, DayState | undefined>,
  habitIds: string[],
  untilDate: string,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const id of habitIds) {
    let streak = 0
    let date = untilDate
    for (let i = 0; i < 365; i++) {
      const completions = days[date]?.habitCompletions
      if (completions?.[id] === true) {
        streak++
        date = addDays(date, -1)
      } else {
        break
      }
    }
    result[id] = streak
  }
  return result
}

/**
 * Returns habit ids that are "at risk" of being missed twice in a row.
 * A habit is at risk when: it was NOT completed yesterday AND WAS completed the day before.
 * This implements the Atomic Habits "never miss twice" rule.
 */
export function getAtRiskHabitIds(
  days: Record<string, DayState | undefined>,
  habitIds: string[],
  today: string,
): Set<string> {
  const yesterday = addDays(today, -1)
  const dayBeforeYesterday = addDays(today, -2)
  const atRisk = new Set<string>()
  for (const id of habitIds) {
    const missedYesterday = days[yesterday]?.habitCompletions?.[id] !== true
    const doneDayBefore = days[dayBeforeYesterday]?.habitCompletions?.[id] === true
    if (missedYesterday && doneDayBefore) {
      atRisk.add(id)
    }
  }
  return atRisk
}

/**
 * Returns total deep work minutes for a day from completed (not cancelled) sessions.
 */
export function computeDailyDeepWorkMinutes(day: DayState | undefined): number {
  if (!day) return 0
  return day.deepWorkSessions
    // Hand-logged entries share the list but are not earned: a range logged by
    // hand carries a finishedAt like any other, so excluding them by source is
    // the only thing standing between self-report and the deep work total.
    .filter((s) => s.finishedAt && !s.cancelledAt && s.source !== 'manual')
    .reduce((sum, s) => sum + s.durationMinutes, 0)
}

/**
 * Returns hand-logged minutes for a day: time the user reported working on a
 * task without a timer having measured it.
 *
 * Deliberately a separate figure from `computeDailyDeepWorkMinutes` rather than
 * folded into it. Self-reported hours are not evidence of anything and must
 * never inflate a deep work total. But leaving them out of every readout meant
 * an hour honestly logged by hand vanished without explanation, which taught
 * exactly the wrong lesson - that the way to make the scoreboard move is to
 * stop logging honestly. Shown beside the earned figure, never added to it.
 */
export function computeDailySelfReportedMinutes(day: DayState | undefined): number {
  if (!day) return 0
  // Entries logged by hand, plus the legacy per-task totals from before they
  // became entries. Unattributed hand-logged time counts too: it was claimed,
  // whether or not it still points at a task.
  const fromSessions = day.deepWorkSessions.reduce((sum, session) => {
    if (session.source !== 'manual' || session.cancelledAt) return sum
    const minutes = Math.floor(session.durationMinutes)
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum
  }, 0)
  const legacy = day.tasks.reduce((sum, task) => {
    const minutes = Math.floor(task.manualLoggedMinutes ?? 0)
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum
  }, 0)
  return fromSessions + legacy
}
