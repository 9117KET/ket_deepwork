/**
 * domain/habitWeek.ts
 *
 * The seven dots under each habit on the mobile Habits screen.
 *
 * The month grid answers "how has this year gone". That is a different question
 * from the one you have standing in the kitchen at 7am, which is "am I about to
 * break something". Seven days is the span where that question has an answer,
 * and it is the most that fits under a habit row on a phone without becoming a
 * table. The full grid stays in Review — see `docs/design/mobile/Habits.dc.html`.
 *
 * A dot has three states, and the third is the point of the whole row. `done`
 * and `missed` are the obvious two. `broke` marks a day you missed *directly
 * after* a day you kept — the never-miss-twice rule from Atomic Habits, and the
 * only thing on this screen that earns amber. A run of grey dots is a habit you
 * have not started; one amber dot at the end of a teal run is a habit about to
 * be lost, and those two should never look alike.
 */

import { addDays } from './dateUtils'

export type HabitDayState = 'done' | 'missed' | 'broke'

export interface HabitWeekDay {
  iso: string
  state: HabitDayState
}

/**
 * The last `length` days ending at `untilIso` (inclusive), oldest first.
 *
 * Today is included and counts as `missed` until it is ticked, which is
 * deliberate: an unticked today is the thing the screen exists to nag about.
 * It can never be `broke` though — you have not missed a day that has not
 * finished yet.
 */
export function computeHabitWeek(
  days: Record<string, { habitCompletions?: Record<string, boolean> } | undefined>,
  habitId: string,
  untilIso: string,
  length = 7,
): HabitWeekDay[] {
  const isDone = (iso: string) => days[iso]?.habitCompletions?.[habitId] === true

  const out: HabitWeekDay[] = []
  for (let i = length - 1; i >= 0; i -= 1) {
    const iso = addDays(untilIso, -i)
    if (isDone(iso)) {
      out.push({ iso, state: 'done' })
      continue
    }
    // Missing today is not yet a broken chain: the day is still going.
    const isToday = iso === untilIso
    const keptYesterday = isDone(addDays(iso, -1))
    out.push({ iso, state: !isToday && keptYesterday ? 'broke' : 'missed' })
  }
  return out
}

/** How many of the last `length` days were kept. */
export function countHabitWeekDone(week: HabitWeekDay[]): number {
  return week.filter((d) => d.state === 'done').length
}
