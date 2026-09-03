/**
 * hooks/useReviewHandlers.ts
 *
 * The writes the month-scale views need: the day journal, and the tracking
 * dashboard's per-day and settings updates.
 *
 * Extracted from `DayPlanner` because Review is its own destination now (see
 * `docs/design/README.md`) and both surfaces need the same four updaters.
 * Sharing them keeps the two from drifting into subtly different writes against
 * the same fields.
 */

import { useCallback } from 'react'
import type {
  AppState,
  DayState,
  FocusHijacker,
  HabitDefinition,
} from '../domain/types'
import { getOrCreateDay } from '../storage/localStorageState'

/** The settings slice the tracking dashboard is allowed to patch. */
export interface TrackingSettingsPatch {
  habitDefinitions?: HabitDefinition[]
  monthTitles?: Record<string, string>
  depthPhilosophy?: AppState['depthPhilosophy']
  deepWorkGoalHoursPerWeek?: number
  focusBlockMinutes?: number
  focusBreakMinutes?: number
  goalCascade?: AppState['goalCascade']
  monthlyReviews?: AppState['monthlyReviews']
  weeklyReviews?: AppState['weeklyReviews']
  weeklyReviewDay?: AppState['weeklyReviewDay']
  weeklyReviewQuestions?: AppState['weeklyReviewQuestions']
}

export function useReviewHandlers(
  updateAppState: (updater: (prev: AppState) => AppState) => void,
  selectedDay: string,
) {
  const handleSaveDayJournal = useCallback(
    (note: string) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay)
        return { ...prev, days: { ...prev.days, [selectedDay]: { ...day, dayNote: note } } }
      })
    },
    [updateAppState, selectedDay],
  )

  const handleSaveFocusHijacker = useCallback(
    (hijacker: FocusHijacker) => {
      updateAppState((prev) => {
        const day = getOrCreateDay(prev, selectedDay)
        return {
          ...prev,
          days: { ...prev.days, [selectedDay]: { ...day, focusHijacker: hijacker } },
        }
      })
    },
    [updateAppState, selectedDay],
  )

  /**
   * The dashboard edits days other than the one on screen (a mood two weeks
   * back), so this takes its own date rather than closing over `selectedDay`.
   */
  const handleTrackingUpdateDay = useCallback(
    (isoDate: string, updatedDay: DayState) => {
      updateAppState((prev) => {
        const existing = getOrCreateDay(prev, isoDate)
        return { ...prev, days: { ...prev.days, [isoDate]: { ...existing, ...updatedDay } } }
      })
    },
    [updateAppState],
  )

  /**
   * Applies only the keys the caller actually set. A plain `{...prev, ...patch}`
   * would write `undefined` over a live setting whenever the patch object
   * carried the key without a value, which is how these are usually built.
   */
  const handleTrackingUpdateSettings = useCallback(
    (patch: TrackingSettingsPatch) => {
      updateAppState((prev) => {
        const set = Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        ) as Partial<AppState>
        return { ...prev, ...set }
      })
    },
    [updateAppState],
  )

  return {
    handleSaveDayJournal,
    handleSaveFocusHijacker,
    handleTrackingUpdateDay,
    handleTrackingUpdateSettings,
  }
}
