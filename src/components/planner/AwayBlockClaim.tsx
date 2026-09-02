/**
 * components/planner/AwayBlockClaim.tsx
 *
 * The prompt for a block that ran out while the app was closed.
 *
 * This is the honest answer to work you cannot sit and watch. Start a block
 * before you leave, go and do the hour, come back: a clock measured the
 * interval, which is the same evidence a block watched from start to finish
 * produces. So claiming it fills the task solid, like any other earned block.
 *
 * It is a claim rather than a recording because the clock only proves the time
 * passed, not that you spent it working - you might have started a block and
 * then not gone. One question, asked once, and answered either way it goes.
 *
 * Rendered in the main column rather than inside the timer card, because the
 * timer card is collapsible and a claim behind a chevron is a claim that gets
 * lost.
 */

import { Check, Timer, X } from 'lucide-react'
import type { AwayBlock } from '../timer/useDeepWorkTimer'
import { formatMinutes } from '../../domain/taskProgress'

interface AwayBlockClaimProps {
  block: AwayBlock
  /** Title of the task the block was pointed at, when it is still on the plan. */
  taskTitle?: string
  onConfirm: () => void
  onDiscard: () => void
}

export function AwayBlockClaim({ block, taskTitle, onConfirm, onDiscard }: AwayBlockClaimProps) {
  const finishedAt = new Date(block.finishedAt)
  const finishedLabel = Number.isNaN(finishedAt.getTime())
    ? null
    : finishedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const subject = taskTitle ?? block.label

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-sky-100">
            Your {formatMinutes(block.minutes)} block finished while you were away
          </p>
          <p className="mt-0.5 text-xs text-sky-200/70">
            <span className="font-medium">{subject}</span>
            {finishedLabel ? ` · ended at ${finishedLabel}` : null}
            {' · did you work it?'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-sky-400 bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
        >
          <Check className="h-4 w-4" />
          Log it
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onSurfaceVariant hover:text-share-onSurface"
        >
          <X className="h-4 w-4" />
          Discard
        </button>
      </div>
    </div>
  )
}
