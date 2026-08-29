/**
 * components/planner/TaskProgressSheet.tsx
 *
 * The actions behind a task's progress row: start the next block, log time by
 * hand, take hand-logged time back.
 *
 * Starting a block is now the chips' own job, so the sheet is mostly the honest
 * escape hatch for work the timer never saw - a block done on paper, a meeting
 * that ran. It still leads with the timer, because minutes earned that way are
 * real and the sheet is the moment that choice gets made.
 */

import { useEffect } from 'react'
import { Clock, Minus, Timer, X } from 'lucide-react'
import type { TaskProgress } from '../../domain/taskProgress'
import { describeTaskProgress, formatMinutes } from '../../domain/taskProgress'
import { TaskProgressBoxes } from './TaskProgressBoxes'
import { useFocusBlocks } from './focusBlockContext'

interface TaskProgressSheetProps {
  taskId: string
  taskTitle: string
  progress: TaskProgress
  /** Log hand-tracked minutes against the task. */
  onLogManual: (minutes: number) => void
  /** Take back the last hand-tracked minutes. Earned time is never removable here. */
  onUndoManual: (minutes: number) => void
  /** Start the next block on the timer. Omitted where no timer is in reach. */
  onStartBlock?: (minutes: number) => void
  onClose: () => void
}

export function TaskProgressSheet({
  taskId,
  taskTitle,
  progress,
  onLogManual,
  onUndoManual,
  onStartBlock,
  onClose,
}: TaskProgressSheetProps) {
  const { activeBlock } = useFocusBlocks()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // The next block to fill, and the last hand-logged one that can be taken back.
  const nextSlot = progress.slots.find(
    (slot) => slot.timerMinutes + slot.manualMinutes < slot.capacityMinutes,
  )
  const logMinutes = nextSlot
    ? nextSlot.capacityMinutes - nextSlot.timerMinutes - nextSlot.manualMinutes
    : progress.blockMinutes
  const undoSlot = [...progress.slots].reverse().find((slot) => slot.manualMinutes > 0)
  const isTimerBusy = activeBlock != null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-share-bg/80 sm:items-center sm:px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Log time on ${taskTitle}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-4 pb-6 shadow-2xl sm:max-w-sm sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-share-onBg">{taskTitle}</h3>
            <p className="mt-0.5 text-xs text-share-onSurfaceVariant">{describeTaskProgress(progress)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 shrink-0 rounded p-1 text-share-onSurfaceVariant hover:bg-share-surfaceContainerHighest hover:text-share-onSurface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex justify-center rounded-lg border border-share-outlineVariant/25 bg-share-surfaceContainerLow py-3">
          <TaskProgressBoxes progress={progress} taskId={taskId} />
        </div>

        <div className="mt-4 space-y-2">
          {onStartBlock && nextSlot && (
            <button
              type="button"
              disabled={isTimerBusy}
              onClick={() => {
                onStartBlock(logMinutes)
                onClose()
              }}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                isTimerBusy
                  ? 'cursor-not-allowed border-share-outlineVariant/40 bg-share-surfaceContainer opacity-60'
                  : 'border-teal-500/50 bg-teal-500/10 hover:bg-teal-500/20'
              }`}
            >
              <Timer className={`h-4 w-4 shrink-0 ${isTimerBusy ? 'text-share-onSurfaceVariant' : 'text-teal-300'}`} />
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${isTimerBusy ? 'text-share-onSurface' : 'text-teal-200'}`}>
                  Start a {formatMinutes(logMinutes)} block
                </span>
                <span className={`block text-xs ${isTimerBusy ? 'text-share-onSurfaceVariant/70' : 'text-teal-400/70'}`}>
                  {isTimerBusy ? 'A block is already running' : 'Finished blocks fill in solid'}
                </span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onLogManual(logMinutes)}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-left hover:bg-share-surfaceContainerHighest"
          >
            <Clock className="h-4 w-4 shrink-0 text-share-onSurfaceVariant" />
            <span className="min-w-0">
              <span className="block text-sm text-share-onSurface">
                Log {formatMinutes(logMinutes)} by hand
              </span>
              <span className="block text-xs text-share-onSurfaceVariant/70">Fills in faded, not solid</span>
            </span>
          </button>

          {undoSlot && (
            <button
              type="button"
              onClick={() => onUndoManual(undoSlot.manualMinutes)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-share-onSurfaceVariant hover:bg-share-surfaceContainerHighest"
            >
              <Minus className="h-4 w-4 shrink-0" />
              <span className="text-sm">
                Undo {formatMinutes(undoSlot.manualMinutes)} logged by hand
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
