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
 *
 * Hand-logging takes a whole stretch at once, in blocks or as the clock times
 * it actually ran between. An hour away from the desk is one thing that
 * happened, not three identical taps, and making the honest record tedious is
 * how you end up with no record at all. What it never does is change what those
 * minutes mean: everything logged here fills faded, and stays out of the
 * earned-hours scoreboard.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Clock, Minus, Plus, Timer, X } from 'lucide-react'
import type { TaskProgress } from '../../domain/taskProgress'
import { describeTaskProgress, formatMinutes, parseClockRangeMinutes } from '../../domain/taskProgress'
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

          <ManualLogPanel progress={progress} minStep={logMinutes} onLogManual={onLogManual} />

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

/**
 * Hand-logging, in one gesture rather than one block at a time.
 *
 * Two ways in, because there are two ways people remember unwatched work. In
 * blocks, when it came in sittings ("that was two blocks"), and as a time
 * range, when it was one continuous stretch whose clock times you know ("out
 * from seven to quarter past nine"). The range is the more precise of the two
 * and the only one that can express a stretch that is not a whole number of
 * blocks.
 *
 * Neither is treated as earned. Both write `manualLoggedMinutes`, which is what
 * the note in the corner is telling you.
 */
function ManualLogPanel({
  progress,
  minStep,
  onLogManual,
}: {
  progress: TaskProgress
  /** Room left in the next block - the smallest amount worth logging. */
  minStep: number
  onLogManual: (minutes: number) => void
}) {
  const [mode, setMode] = useState<'blocks' | 'range'>('blocks')
  const [blocks, setBlocks] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const remaining = Math.max(0, progress.goalMinutes - progress.totalMinutes)
  // Enough steps to finish the task, plus headroom for the estimate having been
  // short - logging past the plan is allowed, and the row draws it amber.
  const remainingBlocks = Math.max(1, Math.ceil(remaining / progress.blockMinutes))
  const maxBlocks = remainingBlocks + 2

  /**
   * The step that finishes the task carries the remainder rather than a whole
   * block, so on a task with 1h20 left "2 blocks" logs 1h20 and does not claim
   * 1h30. Steps past that are full blocks of overflow.
   */
  const minutesForBlocks = (count: number): number => {
    if (remaining <= 0) return count * progress.blockMinutes
    if (count >= remainingBlocks) {
      return remaining + (count - remainingBlocks) * progress.blockMinutes
    }
    return Math.max(minStep, count * progress.blockMinutes)
  }

  const rangeMinutes = useMemo(() => parseClockRangeMinutes(from, to), [from, to])
  const minutes = mode === 'blocks' ? minutesForBlocks(blocks) : rangeMinutes
  const canLog = minutes != null && minutes > 0

  return (
    <div className="rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer p-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-share-onSurfaceVariant" />
        <span className="text-sm text-share-onSurface">Log time by hand</span>
        <span className="ml-auto text-[10px] text-share-onSurfaceVariant/60">fills faded</span>
      </div>

      <div className="mt-2 flex gap-1 text-xs">
        {(['blocks', 'range'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`min-h-[32px] rounded-full border px-3 py-1 transition-colors ${
              mode === option
                ? 'border-share-primary/60 bg-share-primary/10 text-share-primary'
                : 'border-share-outlineVariant/40 text-share-onSurfaceVariant hover:text-share-onSurface'
            }`}
          >
            {option === 'blocks' ? 'In blocks' : 'Time range'}
          </button>
        ))}
      </div>

      {mode === 'blocks' ? (
        <div className="mt-3 flex items-center gap-2">
          <StepButton
            label="One block fewer"
            disabled={blocks <= 1}
            onClick={() => setBlocks((n) => Math.max(1, n - 1))}
          >
            <Minus className="h-4 w-4" />
          </StepButton>
          <span className="flex-1 text-center text-sm tabular-nums text-share-onSurface">
            {blocks === 1 ? '1 block' : `${blocks} blocks`}
            <span className="ml-1.5 text-xs text-share-onSurfaceVariant/70">
              {formatMinutes(minutesForBlocks(blocks))}
            </span>
          </span>
          <StepButton
            label="One block more"
            disabled={blocks >= maxBlocks}
            onClick={() => setBlocks((n) => Math.min(maxBlocks, n + 1))}
          >
            <Plus className="h-4 w-4" />
          </StepButton>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="time"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="Started at"
            className="min-h-[36px] min-w-0 flex-1 rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-sm tabular-nums text-share-onBg focus:border-share-primary focus:outline-none"
          />
          <span className="shrink-0 text-xs text-share-onSurfaceVariant">to</span>
          <input
            type="time"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="Finished at"
            className="min-h-[36px] min-w-0 flex-1 rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-sm tabular-nums text-share-onBg focus:border-share-primary focus:outline-none"
          />
        </div>
      )}

      <button
        type="button"
        disabled={!canLog}
        onClick={() => {
          if (minutes == null || minutes <= 0) return
          onLogManual(minutes)
          setFrom('')
          setTo('')
          setBlocks(1)
        }}
        className={`mt-3 flex min-h-[40px] w-full items-center justify-center rounded-md border px-3 py-1.5 text-sm transition-colors ${
          canLog
            ? 'border-share-outlineVariant/60 bg-share-surfaceContainerHigh text-share-onSurface hover:border-share-primary/60 hover:text-share-primary'
            : 'cursor-not-allowed border-share-outlineVariant/30 text-share-onSurfaceVariant/50'
        }`}
      >
        {canLog ? `Log ${formatMinutes(minutes)}` : 'Set a start and end time'}
      </button>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-share-outlineVariant/40 ${
        disabled
          ? 'cursor-not-allowed text-share-onSurfaceVariant/30'
          : 'text-share-onSurfaceVariant hover:border-share-primary/60 hover:text-share-primary'
      }`}
    >
      {children}
    </button>
  )
}
