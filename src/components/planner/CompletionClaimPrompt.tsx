/**
 * components/planner/CompletionClaimPrompt.tsx
 *
 * The question asked at the one moment anyone still knows the answer: a task
 * has just been ticked off with blocks still empty, so how many of them did the
 * work actually take?
 *
 * It used to be all or nothing - "log the whole remainder" or "no" - which is
 * fine for a task that ran exactly to plan and useless for the ordinary case of
 * finishing early. Someone who set aside eight blocks and needed two had no way
 * to say so, and the only honest option left was "no", which records nothing at
 * all. Now the remainder is a row of blocks to pick from, opening on all of
 * them so the old one-tap answer still costs one tap.
 *
 * Everything logged here is self-reported: it fills faded and stays out of the
 * earned-hours scoreboard. The prompt gives up after a while on its own, since
 * an unanswered question is an answer of "no" and a prompt that waits forever
 * turns into a nag - but touching the picker stops that clock, because a
 * half-made choice must never be taken away mid-tap.
 */

import { useEffect, useRef, useState } from 'react'
import type { BlockAmountOption } from '../../domain/taskProgress'
import { formatMinutes } from '../../domain/taskProgress'
import { BlockAmountPicker } from './BlockAmountPicker'

/** How long the offer stands before it withdraws itself. */
export const COMPLETION_CLAIM_TIMEOUT_MS = 12000

interface CompletionClaimPromptProps {
  title: string
  /** How many more of these are waiting behind this one. */
  queuedAfter?: number
  /** The empty blocks, cumulative - see `blockAmountOptions`. */
  options: BlockAmountOption[]
  onLog: (minutes: number) => void
  onDismiss: () => void
}

export function CompletionClaimPrompt({
  title,
  queuedAfter = 0,
  options,
  onLog,
  onDismiss,
}: CompletionClaimPromptProps) {
  const total = options.length
  const [blocks, setBlocks] = useState(total)
  // Once they have started answering, the offer waits.
  const [held, setHeld] = useState(false)

  // Read through a ref so an inline callback from the parent cannot restart the
  // countdown on every re-render - the planner re-renders once a second while a
  // block runs, and the offer would then never withdraw itself.
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (held) return
    const id = window.setTimeout(() => dismissRef.current(), COMPLETION_CLAIM_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [held])

  const selected = options.find((option) => option.blocks === blocks) ?? options.at(-1)
  if (!selected) return null

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-sm rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-3 py-2.5 shadow-lg lg:bottom-6"
    >
      <p className="text-xs text-share-onSurface">
        <span className="font-medium">{title}</span> done with{' '}
        {total === 1 ? '1 block' : `${total} blocks`} unlogged. How many did you do?
      </p>
      {queuedAfter > 0 && (
        <p className="mt-0.5 text-[11px] text-share-onSurfaceVariant/70">
          {queuedAfter === 1 ? '1 more subtask after this' : `${queuedAfter} more after this`}
        </p>
      )}

      <BlockAmountPicker
        className="mt-2"
        options={options}
        value={blocks}
        onChange={(next) => {
          setHeld(true)
          setBlocks(next)
        }}
        label={`How many blocks of ${title} did you do?`}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onLog(selected.minutes)}
          className="min-h-[32px] flex-1 rounded-md border border-share-outlineVariant/60 bg-share-surfaceContainer px-2 py-1 text-xs text-share-onSurface hover:border-share-primary/60 hover:text-share-primary"
        >
          Log {formatMinutes(selected.minutes)} by hand
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[32px] rounded-md px-2 py-1 text-xs text-share-onSurfaceVariant hover:text-share-onSurface"
        >
          None
        </button>
      </div>
    </div>
  )
}
