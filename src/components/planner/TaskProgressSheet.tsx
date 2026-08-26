/**
 * components/planner/TaskProgressSheet.tsx
 *
 * The actions behind a task's progress row on a phone, where the 14px boxes are
 * far too small to tap. Opens as a bottom sheet.
 *
 * Order matters here. Starting the timer is the primary action and sits at the
 * top, because minutes earned that way are real; logging by hand is the
 * secondary one underneath it. The sheet is the moment the choice gets made, so
 * it puts the honest path under the thumb rather than burying it.
 */

import { useEffect } from 'react'
import { Clock, Minus, Timer, X } from 'lucide-react'
import type { TaskProgress } from '../../domain/taskProgress'
import { describeTaskProgress, formatMinutes } from '../../domain/taskProgress'
import { TaskProgressBoxes } from './TaskProgressBoxes'

interface TaskProgressSheetProps {
  taskTitle: string
  progress: TaskProgress
  /** Log hand-tracked minutes against the task. */
  onLogManual: (minutes: number) => void
  /** Take back the last hand-tracked minutes. Earned time is never removable here. */
  onUndoManual: (minutes: number) => void
  /** Point the deep work timer at this task. Omitted where no timer is in reach. */
  onStartTimer?: () => void
  onClose: () => void
}

export function TaskProgressSheet({
  taskTitle,
  progress,
  onLogManual,
  onUndoManual,
  onStartTimer,
  onClose,
}: TaskProgressSheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // The next box to fill, and the last hand-logged one that can be taken back.
  const nextSlot = progress.slots.find(
    (slot) => slot.timerMinutes + slot.manualMinutes < slot.capacityMinutes,
  )
  const logMinutes = nextSlot
    ? nextSlot.capacityMinutes - nextSlot.timerMinutes - nextSlot.manualMinutes
    : 30
  const undoSlot = [...progress.slots].reverse().find((slot) => slot.manualMinutes > 0)

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
          <TaskProgressBoxes progress={progress} />
        </div>

        <div className="mt-4 space-y-2">
          {onStartTimer && (
            <button
              type="button"
              onClick={() => {
                onStartTimer()
                onClose()
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-teal-500/50 bg-teal-500/10 px-3 py-2 text-left hover:bg-teal-500/20"
            >
              <Timer className="h-4 w-4 shrink-0 text-teal-300" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-teal-200">Work on this with the timer</span>
                <span className="block text-xs text-teal-400/70">Finished blocks fill in solid</span>
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
