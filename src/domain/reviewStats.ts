/**
 * domain/reviewStats.ts
 *
 * The three numbers at the top of the Review screen.
 *
 * Each one answers a question you would otherwise have to read a whole grid to
 * answer: am I doing the deep work I said I would, am I finishing the blocks I
 * plan, am I keeping the habits I set. The grids underneath stay — these are
 * the summary you glance at before deciding whether the detail is worth
 * reading. See `docs/design/desktop/DesktopReview.dc.html`.
 *
 * Two rules run through all three:
 *
 * 1. **A day with nothing in it is not a failure.** Days you never planned are
 *    excluded from the denominator rather than counted as zeroes, because a
 *    month that starts on the 28th should not report 7%. Only days that were
 *    actually lived and planned can be scored.
 * 2. **Nothing counts the future.** A month in progress is measured against the
 *    days elapsed, not its full 30. Otherwise every month reads as a failure
 *    until its last day, which is the sort of scoreboard people stop opening.
 */

import type { AppState, DayState, TaskSectionId } from './types'

/** The six blocks a day is scored across. Side quests are optional by design. */
const SCORED_SECTIONS: TaskSectionId[] = [
  'mustDo',
  'morningRoutine',
  'highPriority',
  'mediumPriority',
  'lowPriority',
  'nightRoutine',
]

export interface BlockCompletion {
  /** 0-1, or null when the month holds no planned block at all. */
  ratio: number | null
  /** Blocks that had tasks and had all of them done. */
  fullBlocks: number
  /** Blocks that had tasks and some of them done. */
  partialBlocks: number
  /** Blocks that had tasks and none of them done. */
  missedBlocks: number
}

/**
 * How much of what was planned actually got finished, scored per block rather
 * than per task, so a day with one section of twelve tasks does not outweigh a
 * day with six sections of two. A block with no tasks in it is not scored: you
 * cannot fail to complete work you never planned.
 */
export function computeBlockCompletion(
  days: Record<string, DayState | undefined>,
  monthIso: string,
): BlockCompletion {
  let sum = 0
  let full = 0
  let partial = 0
  let missed = 0
  let scored = 0

  for (const iso of Object.keys(days)) {
    if (!iso.startsWith(monthIso)) continue
    const tasks = days[iso]?.tasks ?? []
    for (const sectionId of SCORED_SECTIONS) {
      const inSection = tasks.filter((t) => t.sectionId === sectionId && !t.parentId)
      if (inSection.length === 0) continue
      const done = inSection.filter((t) => t.isDone).length
      const ratio = done / inSection.length
      sum += ratio
      scored += 1
      if (ratio >= 1) full += 1
      else if (ratio > 0) partial += 1
      else missed += 1
    }
  }

  return {
    ratio: scored === 0 ? null : sum / scored,
    fullBlocks: full,
    partialBlocks: partial,
    missedBlocks: missed,
  }
}

/**
 * The share of habit checks actually ticked this month.
 *
 * The denominator is every habit on every day elapsed, not every day in the
 * month — measured mid-month, an unfinished month must not be scored against
 * days that have not happened. `todayIso` bounds it; a month entirely in the
 * past is measured over all its days.
 */
export function computeHabitConsistency(
  days: Record<string, DayState | undefined>,
  habitIds: string[],
  monthIso: string,
  todayIso: string,
): number | null {
  if (habitIds.length === 0) return null

  const [year, month] = monthIso.split('-').map(Number)
  if (!year || !month) return null
  const daysInMonth = new Date(year, month, 0).getDate()

  // Stop at today when the month is the one being lived through.
  const isCurrentMonth = todayIso.startsWith(monthIso)
  const lastDay = isCurrentMonth ? Number(todayIso.slice(8, 10)) : daysInMonth
  if (!Number.isFinite(lastDay) || lastDay <= 0) return null
  // A month still in the future has nothing to score.
  if (monthIso > todayIso.slice(0, 7)) return null

  let checked = 0
  for (let d = 1; d <= lastDay; d += 1) {
    const iso = `${monthIso}-${String(d).padStart(2, '0')}`
    const completions = days[iso]?.habitCompletions ?? {}
    for (const habitId of habitIds) {
      if (completions[habitId] === true) checked += 1
    }
  }

  return checked / (lastDay * habitIds.length)
}

/** The ISO dates of the week (Mon-Sun) containing `iso`. */
export function weekDatesFor(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1)
  // getDay(): 0 = Sunday. Shift so Monday starts the week.
  const offset = (date.getDay() + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  })
}

/** Habit ids in play, falling back to the defaults when none are configured. */
export function habitIdsOf(state: AppState, fallback: { id: string }[]): string[] {
  const defs = state.habitDefinitions ?? fallback
  return defs.map((h) => h.id)
}
