/**
 * components/planner/focusBlockContext.ts
 *
 * The block length and the running block, made available to any task row that
 * draws a progress chip.
 *
 * A context rather than props: the chips sit five components deep (DayPlanner →
 * SectionColumn → TaskItem → TaskProgressBoxes) and none of the intermediates
 * care about focus blocks. Threading three more props through each of them
 * would be noise in files that have nothing to do with the feature.
 *
 * The default is a working one, not a throw, so a progress row still renders
 * outside the planner - in share mode, and in tests.
 */

import { createContext, useContext } from 'react'
import { DEFAULT_FOCUS_BLOCK_MINUTES, suggestedBreakMinutes } from '../../domain/focusBlocks'
import type { ActiveBlock, StartBlockResult } from '../timer/useDeepWorkTimer'

export interface FocusBlockContextValue {
  blockMinutes: number
  breakMinutes: number
  /** The block currently running or paused, wherever it was started from. */
  activeBlock: ActiveBlock | null
  /**
   * Start a block against a task. Absent where no timer is in reach (share
   * mode), in which case chips fall back to hand-logging only.
   */
  startBlock?: (request: { taskId: string; minutes: number; label: string }) => StartBlockResult
}

const fallback: FocusBlockContextValue = {
  blockMinutes: DEFAULT_FOCUS_BLOCK_MINUTES,
  breakMinutes: suggestedBreakMinutes(DEFAULT_FOCUS_BLOCK_MINUTES),
  activeBlock: null,
}

export const FocusBlockContext = createContext<FocusBlockContextValue>(fallback)

export function useFocusBlocks(): FocusBlockContextValue {
  return useContext(FocusBlockContext)
}

/** The active block, but only if it belongs to this task. */
export function useActiveBlockForTask(taskId: string): ActiveBlock | null {
  const { activeBlock } = useFocusBlocks()
  return activeBlock && activeBlock.taskId === taskId ? activeBlock : null
}
