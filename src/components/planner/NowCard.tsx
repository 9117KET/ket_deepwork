/**
 * components/planner/NowCard.tsx
 *
 * The top of the day: the one task the clock says you should be on, and the
 * button that starts working on it.
 *
 * Everything here was already on the screen — the task, its progress chips, a
 * way to start a block — spread across a section the user had to find first.
 * The card's whole job is that finding it is not a step. It answers "what am I
 * doing right now" without a scan, which is the thing the old planner made you
 * do six times a day. See `docs/design/README.md`.
 *
 * It renders two states and never a third. With work left in the running block
 * it names the task; with the block finished it says so, in the same box, in
 * the same place. It does not disappear — a card that vanishes when you get
 * ahead reads as a bug and hides the good news.
 *
 * The accent is `share.primary`, and it means "act now". That is the reason
 * this card is the only thing on the day that wears it.
 */

import type { NowFocus } from '../../domain/nowFocus'
import { formatMinutes } from '../../domain/taskProgress'
import type { TaskProgress } from '../../domain/taskProgress'
import { FIXED_SECTIONS } from '../../domain/types'
import { TaskProgressBoxes } from './TaskProgressBoxes'

interface NowCardProps {
  focus: NowFocus
  /** The running block's clock window, e.g. "8:30 – 10:30". */
  timeframeLabel?: string | null
  /** Progress for the focused task, or null when it is not trackable. */
  progress: TaskProgress | null
  /** This run's block length, for the button's label. */
  blockMinutes: number
  onToggleTask: (taskId: string) => void
  onStartBlock: (taskId: string, minutes: number) => void
  onOpenActions: (taskId: string) => void
}

function sectionLabel(sectionId: string): string {
  const section = FIXED_SECTIONS.find((s) => s.id === sectionId)
  return section?.shortTitle ?? section?.title ?? ''
}

export function NowCard({
  focus,
  timeframeLabel,
  progress,
  blockMinutes,
  onToggleTask,
  onStartBlock,
  onOpenActions,
}: NowCardProps) {
  const label = sectionLabel(focus.sectionId)

  return (
    <section
      aria-label="Working on now"
      data-testid="now-card"
      className="rounded-2xl border border-share-outlineVariant/60 bg-share-surfaceContainerLow p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-primary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-share-primary" />
        <span>
          Now
          {label ? ` · ${label}` : ''}
        </span>
        {timeframeLabel && (
          <span className="font-semibold normal-case tracking-normal text-share-onSurfaceVariant">
            {timeframeLabel}
          </span>
        )}
      </div>

      {focus.kind === 'clear' ? (
        <p className="mt-3 text-sm text-share-onSurfaceVariant">
          Nothing left in this block — you're ahead. Rest, or pull something forward.
        </p>
      ) : (
        <NowTask
          focus={focus}
          progress={progress}
          blockMinutes={blockMinutes}
          onToggleTask={onToggleTask}
          onStartBlock={onStartBlock}
          onOpenActions={onOpenActions}
        />
      )}
    </section>
  )
}

function NowTask({
  focus,
  progress,
  blockMinutes,
  onToggleTask,
  onStartBlock,
  onOpenActions,
}: {
  focus: Extract<NowFocus, { kind: 'task' }>
  progress: TaskProgress | null
  blockMinutes: number
  onToggleTask: (taskId: string) => void
  onStartBlock: (taskId: string, minutes: number) => void
  onOpenActions: (taskId: string) => void
}) {
  const { task } = focus

  return (
    <>
      <div className="mt-3 flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleTask(task.id)}
          aria-label={`Mark "${task.title}" done`}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-[1.5px] border-share-outlineVariant transition-colors hover:border-share-primary"
        />
        <h2 className="min-w-0 flex-1 font-shareHeadline text-lg font-bold leading-tight text-share-onBg sm:text-xl">
          {task.title}
        </h2>
      </div>

      {progress && (
        <div className="mt-3.5">
          <TaskProgressBoxes
            progress={progress}
            taskId={task.id}
            onStartBlock={(minutes) => onStartBlock(task.id, minutes)}
            onOpenActions={() => onOpenActions(task.id)}
          />
          <p className="mt-2 text-xs text-share-onSurfaceVariant">
            <span className="font-semibold text-share-onBg">
              {formatMinutes(progress.totalMinutes)}
            </span>{' '}
            done of {formatMinutes(progress.goalMinutes)} planned
          </p>
        </div>
      )}

      <div className="mt-4 flex items-stretch gap-2.5">
        <button
          type="button"
          onClick={() => onStartBlock(task.id, blockMinutes)}
          className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl bg-share-primary px-4 font-extrabold text-share-onPrimary transition-opacity hover:opacity-90"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Start {blockMinutes}m block</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenActions(task.id)}
          aria-label="More actions for this task"
          className="touch-target flex w-12 items-center justify-center rounded-xl border border-share-outlineVariant bg-share-surfaceContainer text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="5.5" r="1.7" />
            <circle cx="12" cy="18.5" r="1.7" />
          </svg>
        </button>
      </div>
    </>
  )
}
