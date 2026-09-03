/**
 * domain/nowFocus.ts
 *
 * The one task the clock says you should be on.
 *
 * The planner already knows which time block is running (`getActiveSectionIds`)
 * and what is in each section. This picks the single task out of that, so the
 * top of the day can name it instead of making you scan six sections and decide
 * again. It is the whole content of the NOW card on both breakpoints — see
 * `docs/design/README.md`.
 *
 * Three outcomes, and the third is the one worth being careful about:
 *
 * - `task`   — you are inside a block and it still has work in it.
 * - `clear`  — you are inside a block and everything in it is done. This is a
 *              result, not an absence: the card says the block is finished
 *              rather than vanishing, because a card that disappears reads as a
 *              bug and hides the fact that you are ahead.
 * - `null`   — no block is running at all (asleep, or between blocks). Only
 *              then does the card have nothing to say.
 *
 * Top 3 folds into High Priority, exactly as `computePlannedMinutesBySection`
 * already folds its minutes: the top three are executed inside the deep work
 * block, so when that block is running they are what "now" means.
 */

import type { Task, TaskSectionId } from './types'

/** Section order used to break ties when a block owns more than one section. */
const SECTION_PRIORITY: TaskSectionId[] = [
  'mustDo',
  'morningRoutine',
  'highPriority',
  'mediumPriority',
  'lowPriority',
  'nightRoutine',
]

export type NowFocus =
  | { kind: 'task'; sectionId: TaskSectionId; task: Task }
  | { kind: 'clear'; sectionId: TaskSectionId }

/**
 * Expand the running block's sections into the sections it actually draws work
 * from, in the order it should draw them. The Top 3 live inside the deep work
 * block, so they come first when High Priority is running.
 */
export function sectionsInPlay(activeSectionIds: TaskSectionId[]): TaskSectionId[] {
  const inPlay = activeSectionIds.includes('highPriority')
    ? ['mustDo' as TaskSectionId, ...activeSectionIds]
    : [...activeSectionIds]

  const seen = new Set<TaskSectionId>()
  return inPlay
    .filter((id) => id !== 'sideQuest' && (seen.has(id) ? false : (seen.add(id), true)))
    .sort((a, b) => SECTION_PRIORITY.indexOf(a) - SECTION_PRIORITY.indexOf(b))
}

/** A task is workable if it is a real, unfinished, top-level task. */
function isWorkable(task: Task): boolean {
  return !task.isDone && !task.parentId
}

/**
 * The task to put in front of the user right now, or null when no block is
 * running. `tasks` should be the selected day's tasks; `activeSectionIds` comes
 * from `useTimeAwareness`, which returns an empty array during sleep.
 *
 * Within a section, the first workable task wins — the order the user put them
 * in is the order they meant, and re-ranking it here would quietly overrule a
 * deliberate drag.
 */
export function selectNowFocus(
  tasks: Task[],
  activeSectionIds: TaskSectionId[],
): NowFocus | null {
  const inPlay = sectionsInPlay(activeSectionIds)
  if (inPlay.length === 0) return null

  for (const sectionId of inPlay) {
    const task = tasks.find((t) => t.sectionId === sectionId && isWorkable(t))
    if (task) return { kind: 'task', sectionId, task }
  }

  // Inside a block with nothing left in it. Name the block that is running,
  // preferring the one the clock actually points at over the folded-in Top 3.
  const running = inPlay.find((id) => activeSectionIds.includes(id)) ?? inPlay[0]
  return { kind: 'clear', sectionId: running }
}

/**
 * How much of a section is left, for the collapsed one-line rows under the NOW
 * card. Counts top-level tasks only: a subtask is part of its parent's work,
 * not a separate line item in the day.
 */
export function summarizeSection(
  tasks: Task[],
  sectionId: TaskSectionId,
): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const task of tasks) {
    if (task.sectionId !== sectionId || task.parentId) continue
    total += 1
    if (task.isDone) done += 1
  }
  return { total, done }
}
