/**
 * components/planner/TaskProgressBoxes.tsx
 *
 * The 30-minute progress row for a task with a planned duration.
 *
 * Two fills, two meanings. Solid teal is earned - minutes that came from a
 * finished deep work session attributed to this task. Faded teal is
 * hand-logged. They are never merged into one bar, so a glance at a row always
 * separates work done from work claimed. Amber boxes past the planned duration
 * mean the estimate was short, and are shown rather than clamped away.
 *
 * The boxes themselves are display-first: on a phone they are far too small to
 * be touch targets, so the whole row becomes one button that opens the actions
 * sheet. On a pointer device the next empty box is clickable to log 30 minutes
 * by hand, and the last hand-logged box is clickable to take them back.
 */

import type { TaskProgress, TaskProgressSlot } from '../../domain/taskProgress'
import { MAX_INLINE_SLOTS, describeTaskProgress, formatMinutes } from '../../domain/taskProgress'

interface TaskProgressBoxesProps {
  progress: TaskProgress
  /** Log hand-tracked minutes. Omit for a read-only row (share mode). */
  onLogManual?: (minutes: number) => void
  /** Take back hand-tracked minutes. Never offered for earned minutes. */
  onUndoManual?: (minutes: number) => void
  /** Open the mobile actions sheet. */
  onRequestActions?: () => void
  className?: string
}

export function TaskProgressBoxes({
  progress,
  onLogManual,
  onUndoManual,
  onRequestActions,
  className,
}: TaskProgressBoxesProps) {
  const summary = describeTaskProgress(progress)
  const isCollapsed = progress.slots.length > MAX_INLINE_SLOTS
  const isInteractive = typeof onLogManual === 'function' || typeof onUndoManual === 'function'

  // The next box worth filling, and the last one holding minutes we are allowed
  // to take back. Everything else in the row is inert.
  const nextIndex = progress.slots.findIndex(
    (slot) => slot.timerMinutes + slot.manualMinutes < slot.capacityMinutes,
  )
  const undoIndex = findLastIndex(progress.slots, (slot) => slot.manualMinutes > 0)

  /**
   * `interactive` is false for the phone copy of the row: its boxes must stay
   * plain, both because they are too small to hit and because the row itself is
   * already a button, and a button inside a button is not valid markup.
   */
  const renderRow = (interactive: boolean) => {
    if (isCollapsed) return <CollapsedBar progress={progress} />
    return (
      <span className="flex items-center gap-1">
        {progress.slots.map((slot, index) => {
          const canLog = interactive && index === nextIndex && typeof onLogManual === 'function'
          const canUndo = interactive && index === undoIndex && typeof onUndoManual === 'function'
          const room = slot.capacityMinutes - slot.timerMinutes - slot.manualMinutes
          if (!canLog && !canUndo) return <Box key={index} slot={slot} />

          const action = canLog
            ? `Log ${formatMinutes(room)} by hand`
            : `Undo ${formatMinutes(slot.manualMinutes)} logged by hand`
          return (
            <button
              key={index}
              type="button"
              className="shrink-0 rounded-[3px] focus:outline-none focus:ring-1 focus:ring-share-primary"
              title={action}
              aria-label={action}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (canLog) onLogManual?.(room)
                else onUndoManual?.(slot.manualMinutes)
              }}
            >
              <Box slot={slot} isActionable />
            </button>
          )
        })}
      </span>
    )
  }

  return (
    <span
      role="group"
      aria-label={summary}
      title={summary}
      className={`inline-flex shrink-0 items-center gap-1.5 ${className ?? ''}`}
    >
      {onRequestActions ? (
        <>
          {/* Phone: one 44px target for the whole row, opening the sheet. */}
          <button
            type="button"
            className="-my-2 flex min-h-[44px] shrink-0 items-center gap-1.5 py-2 pr-1 sm:hidden"
            aria-label={`${summary}. Log time on this task`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRequestActions()
            }}
          >
            {renderRow(false)}
            <Total progress={progress} />
          </button>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            {renderRow(isInteractive)}
            <Total progress={progress} />
          </span>
        </>
      ) : (
        <>
          {renderRow(isInteractive)}
          <Total progress={progress} />
        </>
      )}
    </span>
  )
}

/** A single 30-minute box, part-filled by however many minutes landed in it. */
function Box({ slot, isActionable = false }: { slot: TaskProgressSlot; isActionable?: boolean }) {
  const timerWidth = ratio(slot.timerMinutes, slot.capacityMinutes) * 100
  const manualWidth = ratio(slot.manualMinutes, slot.capacityMinutes) * 100
  const border = slot.isOverflow
    ? 'border-amber-500/50'
    : slot.filledRatio > 0
      ? 'border-teal-500/60'
      : 'border-share-outlineVariant/50'

  return (
    <span
      className={`relative block h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[3px] border bg-share-surfaceContainer ${border} ${
        isActionable ? 'hover:border-share-primary hover:bg-share-surfaceContainerHigh' : ''
      }`}
      // A short trailing box holds less than 30 minutes; say so rather than
      // letting it read as a full one.
      title={slot.capacityMinutes < 30 ? `${formatMinutes(slot.capacityMinutes)} block` : undefined}
    >
      <span
        className={`absolute inset-y-0 left-0 ${slot.isOverflow ? 'bg-amber-400' : 'bg-teal-400'}`}
        style={{ width: `${timerWidth}%` }}
      />
      <span
        className={`absolute inset-y-0 ${slot.isOverflow ? 'bg-amber-400/30' : 'bg-teal-400/30'}`}
        style={{ left: `${timerWidth}%`, width: `${manualWidth}%` }}
      />
    </span>
  )
}

/**
 * Long tasks would wrap into a wall of boxes, so past six they collapse into a
 * single track. Same two fills, same meanings.
 */
function CollapsedBar({ progress }: { progress: TaskProgress }) {
  const earned = ratio(progress.timerMinutes, progress.goalMinutes) * 100
  const claimed = ratio(progress.manualMinutes, progress.goalMinutes) * 100
  const capped = Math.min(100, earned)
  const cappedClaimed = Math.min(100 - capped, claimed)

  return (
    <span className="relative block h-2 w-20 shrink-0 overflow-hidden rounded-full border border-share-outlineVariant/50 bg-share-surfaceContainer">
      <span
        className={`absolute inset-y-0 left-0 ${progress.isOverflowing ? 'bg-amber-400' : 'bg-teal-400'}`}
        style={{ width: `${capped}%` }}
      />
      <span
        className={`absolute inset-y-0 ${progress.isOverflowing ? 'bg-amber-400/30' : 'bg-teal-400/30'}`}
        style={{ left: `${capped}%`, width: `${cappedClaimed}%` }}
      />
    </span>
  )
}

/** The running total, e.g. "1h30/3h". */
function Total({ progress }: { progress: TaskProgress }) {
  return (
    <span
      className={`shrink-0 text-[10px] tabular-nums ${
        progress.isOverflowing
          ? 'text-amber-400'
          : progress.isComplete
            ? 'text-teal-300'
            : 'text-share-onSurfaceVariant/70'
      }`}
    >
      {formatMinutes(progress.totalMinutes)}/{formatMinutes(progress.goalMinutes)}
    </span>
  )
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.max(0, Math.min(1, part / whole))
}

/** Array.prototype.findLastIndex needs a newer lib target than this project uses. */
function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (predicate(items[i])) return i
  }
  return -1
}
