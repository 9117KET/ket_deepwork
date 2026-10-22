/**
 * components/planner/TaskProgressBoxes.tsx
 *
 * A task's focus blocks: one chip per sitting the task needs.
 *
 * The chips are not a readout. An empty one is a button that starts the timer
 * for exactly that block, pointed at this task, which is the whole reason the
 * row exists - the plan and the thing that executes the plan are the same
 * control. The chip that is running fills in real time, so the row is alive
 * while you work rather than jumping when the countdown ends.
 *
 * Two fills, two meanings. Solid cyan is earned - minutes from a finished deep
 * work session attributed to this task. Faded cyan is hand-logged. They are
 * never merged into one bar, so a glance at a row always separates work done
 * from work claimed. Amber chips past the planned duration mean the estimate
 * was short, and are shown rather than clamped away.
 *
 * Widths are proportional: a trailing chip holding less than a full block is
 * drawn narrower, so a row never claims a half-block is a whole one.
 */

import { useLayoutEffect, useState } from 'react'
import type { TaskProgress, TaskProgressSlot } from '../../domain/taskProgress'
import { MAX_INLINE_SLOTS, describeTaskProgress, formatMinutes } from '../../domain/taskProgress'
import { useActiveBlockForTask, useFocusBlocks } from './focusBlockContext'

interface TaskProgressBoxesProps {
  progress: TaskProgress
  /** The task these chips belong to - used to spot its running block. */
  taskId: string
  /** Start a block of this many minutes on the task. Omit for a read-only row. */
  onStartBlock?: (minutes: number) => void
  /** Open the actions sheet (hand-logging, undo). Omit for a read-only row. */
  onOpenActions?: () => void
  className?: string
}

export function TaskProgressBoxes({
  progress,
  taskId,
  onStartBlock,
  onOpenActions,
  className,
}: TaskProgressBoxesProps) {
  const { breakMinutes } = useFocusBlocks()
  const activeBlock = useActiveBlockForTask(taskId)
  // One second hand per row, and only for the row that is actually running.
  const now = useNow(activeBlock?.status === 'running')
  const remainingMs = activeBlock
    ? activeBlock.endsAt != null
      ? Math.max(0, activeBlock.endsAt - now)
      : activeBlock.remainingMs
    : 0
  const summary = describeTaskProgress(progress)
  const isCollapsed = progress.slots.length > MAX_INLINE_SLOTS

  // The next chip worth starting. Everything before it is spoken for.
  const nextIndex = progress.slots.findIndex(
    (slot) => slot.timerMinutes + slot.manualMinutes < slot.capacityMinutes,
  )

  return (
    <span
      role="group"
      aria-label={summary}
      className={`inline-flex shrink-0 items-center gap-1.5 [--chip-h:1.375rem] [--chip-w:1.75rem] sm:[--chip-h:1.125rem] sm:[--chip-w:1.5rem] ${className ?? ''}`}
    >
      {isCollapsed ? (
        <CollapsedBar
          progress={progress}
          summary={summary}
          onStart={
            nextIndex >= 0 && !activeBlock && onStartBlock
              ? () => onStartBlock(roomIn(progress.slots[nextIndex]!))
              : undefined
          }
          isActive={Boolean(activeBlock)}
        />
      ) : (
        <span className="flex items-center">
          {progress.slots.map((slot, index) => {
            const isNext = index === nextIndex
            const isActive = Boolean(activeBlock) && isNext
            const room = roomIn(slot)
            return (
              <span key={index} className="flex items-center">
                {index > 0 && <BreakDot minutes={breakMinutes} />}
                <Chip
                  slot={slot}
                  activeBlock={isActive ? activeBlock : null}
                  remainingMs={remainingMs}
                  onStart={isNext && !isActive && onStartBlock ? () => onStartBlock(room) : undefined}
                  startMinutes={room}
                />
              </span>
            )
          })}
        </span>
      )}
      <Total
        progress={progress}
        onOpenActions={onOpenActions}
        summary={summary}
        countdown={activeBlock ? formatCountdown(remainingMs, activeBlock.status) : null}
      />
    </span>
  )
}

/**
 * The rest between two blocks. Purely decorative, but it is what turns the row
 * from a bar chart into a shape you read as a plan for the afternoon.
 */
function BreakDot({ minutes }: { minutes: number }) {
  return (
    <span
      aria-hidden
      title={`${minutes} min break`}
      className="mx-[3px] h-[3px] w-[3px] shrink-0 rounded-full bg-share-outlineVariant/50"
    />
  )
}

interface ChipProps {
  slot: TaskProgressSlot
  /** Set when the timer is counting down into this chip. */
  activeBlock: ReturnType<typeof useActiveBlockForTask>
  remainingMs: number
  onStart?: () => void
  startMinutes: number
}

/** One focus block, part-filled by however many minutes landed in it. */
function Chip({ slot, activeBlock, remainingMs, onStart, startMinutes }: ChipProps) {
  const timerWidth = ratio(slot.timerMinutes, slot.capacityMinutes) * 100
  const manualWidth = ratio(slot.manualMinutes, slot.capacityMinutes) * 100
  const partialTitle =
    slot.widthRatio < 1 ? `${formatMinutes(slot.capacityMinutes)} block` : undefined

  const border = activeBlock
    ? 'border-share-primary'
    : slot.isOverflow
      ? 'border-share-tertiary/50'
      : slot.filledRatio > 0
        ? 'border-share-primary/60'
        : 'border-share-outlineVariant/50'

  const body = (
    <span
      className={`relative block overflow-hidden rounded-[4px] border bg-share-surfaceContainer transition-colors ${border} ${
        activeBlock ? 'shadow-[0_0_0_1px_rgba(0,218,243,0.35)]' : ''
      } ${onStart ? 'group-hover:border-share-primary group-hover:bg-share-surfaceContainerHigh' : ''}`}
      style={{
        height: 'var(--chip-h)',
        // Floored so a very short remainder is still a chip rather than a
        // sliver that reads as a rendering fault. It stays visibly narrower
        // than a full block, and its tooltip says what it holds.
        width: `calc(var(--chip-w) * ${Math.max(0.3, slot.widthRatio)})`,
      }}
    >
      <span
        className={`absolute inset-y-0 left-0 ${slot.isOverflow ? 'bg-share-tertiary' : 'bg-share-primary'}`}
        style={{ width: `${timerWidth}%` }}
      />
      <span
        className={`absolute inset-y-0 ${slot.isOverflow ? 'bg-share-tertiary/30' : 'bg-share-primary/30'}`}
        style={{ left: `${timerWidth}%`, width: `${manualWidth}%` }}
      />
      {activeBlock && (
        <ActiveFill activeBlock={activeBlock} remainingMs={remainingMs} slot={slot} />
      )}
      {onStart && (
        <span
          aria-hidden
          className="absolute inset-0 hidden items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
        >
          <svg viewBox="0 0 8 10" className="h-2 w-2 fill-share-primary">
            <path d="M0 0 L8 5 L0 10 Z" />
          </svg>
        </span>
      )}
    </span>
  )

  if (!onStart) {
    return (
      <span
        className="flex shrink-0 items-center"
        title={activeBlock ? 'Running now' : partialTitle}
      >
        {body}
      </span>
    )
  }

  const action = `Start a ${formatMinutes(startMinutes)} block on this task`
  return (
    <button
      type="button"
      // The chip is small by design; the padding turns it into a real touch
      // target without changing how the row looks.
      className="group -my-3 flex shrink-0 items-center py-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary sm:-my-2 sm:py-2"
      title={partialTitle ? `${action} (${partialTitle})` : action}
      aria-label={action}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onStart()
      }}
    >
      {body}
    </button>
  )
}

/** The live edge of a running block. */
function ActiveFill({
  activeBlock,
  remainingMs,
  slot,
}: {
  activeBlock: NonNullable<ReturnType<typeof useActiveBlockForTask>>
  remainingMs: number
  slot: TaskProgressSlot
}) {
  const isRunning = activeBlock.status === 'running'
  const elapsedMinutes = activeBlock.totalMinutes - remainingMs / 60000
  const pct = ratio(elapsedMinutes, slot.capacityMinutes) * 100

  return (
    <>
      <span
        className={`absolute inset-y-0 left-0 bg-share-primary/60 ${isRunning ? 'transition-[width] duration-1000 ease-linear' : ''}`}
        style={{ width: `${pct}%` }}
      />
      {!isRunning && (
        <span aria-hidden className="absolute inset-0 bg-share-primary/10" title="Paused" />
      )}
    </>
  )
}

/**
 * Long tasks would wrap into a wall of chips, so past the inline limit they
 * collapse into a single track - ticked at every block boundary, so the row
 * stays countable rather than turning into an anonymous smear.
 */
function CollapsedBar({
  progress,
  summary,
  onStart,
  isActive,
}: {
  progress: TaskProgress
  summary: string
  onStart?: () => void
  isActive: boolean
}) {
  const earned = ratio(progress.timerMinutes, progress.goalMinutes) * 100
  const claimed = ratio(progress.manualMinutes, progress.goalMinutes) * 100
  const capped = Math.min(100, earned)
  const cappedClaimed = Math.min(100 - capped, claimed)
  const plannedSlots = progress.slots.filter((slot) => !slot.isOverflow).length

  const track = (
    <span
      title={onStart ? undefined : summary}
      className={`relative block h-2.5 w-24 shrink-0 overflow-hidden rounded-full border bg-share-surfaceContainer ${
        isActive ? 'border-share-primary' : 'border-share-outlineVariant/50'
      } ${onStart ? 'group-hover:border-share-primary' : ''}`}
    >
      <span
        className={`absolute inset-y-0 left-0 ${progress.isOverflowing ? 'bg-share-tertiary' : 'bg-share-primary'}`}
        style={{ width: `${capped}%` }}
      />
      <span
        className={`absolute inset-y-0 ${progress.isOverflowing ? 'bg-share-tertiary/30' : 'bg-share-primary/30'}`}
        style={{ left: `${capped}%`, width: `${cappedClaimed}%` }}
      />
      {Array.from({ length: Math.max(0, plannedSlots - 1) }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute inset-y-0 w-px bg-share-surfaceContainerLow/80"
          style={{ left: `${((i + 1) / plannedSlots) * 100}%` }}
        />
      ))}
    </span>
  )

  // A collapsed row is still a row of startable blocks - losing the button
  // because the task is long would punish exactly the tasks that need it most.
  if (!onStart) return track
  return (
    <button
      type="button"
      className="group -my-3 flex shrink-0 items-center py-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary sm:-my-2 sm:py-2"
      title={`Start the next block on this task. ${summary}`}
      aria-label="Start the next block on this task"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onStart()
      }}
    >
      {track}
    </button>
  )
}

/** The running total, e.g. "1h30/3h", and the way into the actions sheet. */
function Total({
  progress,
  onOpenActions,
  summary,
  countdown,
}: {
  progress: TaskProgress
  onOpenActions?: () => void
  summary: string
  /** Shown in place of the total while a block runs on this task. */
  countdown: string | null
}) {
  // While a block is running the countdown is the more useful number, and it is
  // the only feedback a phone gets that the tap landed.
  const tone = countdown
    ? 'text-share-primary'
    : progress.isOverflowing
      ? 'text-share-tertiary'
      : progress.isComplete
        ? 'text-share-primary'
        : 'text-share-onSurfaceVariant/70'
  const text = countdown ?? `${formatMinutes(progress.totalMinutes)}/${formatMinutes(progress.goalMinutes)}`

  if (!onOpenActions) {
    return <span className={`shrink-0 text-[10px] tabular-nums ${tone}`} title={summary}>{text}</span>
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenActions()
      }}
      title={`${summary}. Log time by hand`}
      aria-label={`${summary}. Log time by hand`}
      className={`-my-[15px] shrink-0 rounded px-1 py-[15px] text-[10px] sm:-my-2 sm:py-2 tabular-nums underline decoration-dotted underline-offset-2 hover:text-share-onSurface focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary ${tone}`}
    >
      {text}
    </button>
  )
}

/**
 * The phone form of the row: one 8px segmented bar, a segment per block, and
 * the total beside it. On a phone the chips were each a target too small to
 * hit and a tap landed on the wrong one, so the whole bar is one button that
 * opens the progress sheet, where the timer is offered first and hand-logging
 * second. Without `onOpen` it is a plain readout (the sheet's own header).
 *
 * Same fills as the chips: solid is earned, half-strength is hand-logged,
 * amber is past the estimate. A running block shows its countdown in place of
 * the total, which is the only sign on the row that the timer is going.
 */
export function TaskProgressBar({
  progress,
  taskId,
  onOpen,
}: {
  progress: TaskProgress
  taskId: string
  onOpen?: () => void
}) {
  const activeBlock = useActiveBlockForTask(taskId)
  const now = useNow(activeBlock?.status === 'running')
  const remainingMs = activeBlock
    ? activeBlock.endsAt != null
      ? Math.max(0, activeBlock.endsAt - now)
      : activeBlock.remainingMs
    : 0
  const summary = describeTaskProgress(progress)
  const caption = activeBlock
    ? formatCountdown(remainingMs, activeBlock.status)
    : `${formatMinutes(progress.totalMinutes)} / ${formatMinutes(progress.goalMinutes)}`
  const captionTone = activeBlock
    ? 'text-share-primary'
    : progress.isOverflowing
      ? 'text-share-tertiary'
      : 'text-share-onSurfaceDim'

  const bar = (
    <>
      <span className="flex h-2 min-w-0 flex-1 gap-1" aria-hidden>
        {progress.slots.map((slot, index) => {
          const earned = ratio(slot.timerMinutes, slot.capacityMinutes) * 100
          const logged = ratio(slot.manualMinutes, slot.capacityMinutes) * 100
          return (
            <span
              key={index}
              className="relative h-2 overflow-hidden rounded-full bg-share-hairline"
              style={{ flexGrow: Math.max(0.3, slot.widthRatio), flexBasis: 0 }}
            >
              <span
                className={`absolute inset-y-0 left-0 ${slot.isOverflow ? 'bg-share-tertiary' : 'bg-share-primary'}`}
                style={{ width: `${earned}%` }}
              />
              <span
                className={`absolute inset-y-0 ${slot.isOverflow ? 'bg-share-tertiary/50' : 'bg-share-primary/50'}`}
                style={{ left: `${earned}%`, width: `${logged}%` }}
              />
            </span>
          )
        })}
      </span>
      <span className={`shrink-0 text-xs tabular-nums ${captionTone}`}>{caption}</span>
    </>
  )

  if (!onOpen) {
    return (
      <span className="flex w-full items-center gap-3" role="img" aria-label={summary}>
        {bar}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
      aria-label={`${summary}. Start a block or log time`}
      data-testid="task-progress-bar"
      className="flex min-h-11 w-full items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary"
    >
      {bar}
    </button>
  )
}

/** mm:ss left in the running block, or "paused". */
function formatCountdown(remainingMs: number, status: 'running' | 'paused'): string {
  if (status === 'paused') return 'paused'
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * The wall clock, read in an effect so the component stays pure, and only
 * ticking while something is actually running.
 */
function useNow(isRunning: boolean): number {
  const [now, setNow] = useState(0)
  useLayoutEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    if (!isRunning) return
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [isRunning])
  return now
}

/** Minutes still free in a slot. */
function roomIn(slot: TaskProgressSlot): number {
  return slot.capacityMinutes - slot.timerMinutes - slot.manualMinutes
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.max(0, Math.min(1, part / whole))
}
