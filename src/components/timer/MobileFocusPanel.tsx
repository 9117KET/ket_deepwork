/**
 * components/timer/MobileFocusPanel.tsx
 *
 * The phone's Focus tab: one running block, and nothing else.
 *
 * The old Timer tab rendered the whole `DeepWorkTimer` card — presets, a task
 * selector, a session label field — and then ~2,500px of dashboard under it. On
 * a 390x844 screen that meant the countdown, the one thing you open this tab to
 * see, was a 45px line of text in the middle of a scroll.
 *
 * So this screen has two states and shows exactly one of them:
 *
 * - **Idle** — you have not started anything, so the setup card is the screen.
 *   Picking a length and a task is the work at this moment, and hiding it
 *   behind a big empty ring would be a lie about what the tab does.
 * - **Running or paused** — the ring is the screen: what you are on, how long
 *   is left, and three controls. Nothing to read, nothing to decide.
 *
 * The three controls are deliberately not symmetrical. Pause is the large one
 * in the middle because it is the one you reach for mid-block without looking.
 * See `docs/design/mobile/Focus.dc.html`.
 */

import { useState } from 'react'
import { formatMinutes } from '../../domain/taskProgress'
import { DeepWorkTimer } from './DeepWorkTimer'
import type { DeepWorkTimerController } from './useDeepWorkTimer'

interface MobileFocusPanelProps {
  timer: DeepWorkTimerController
  breakMinutes: number
  onSetBlockLength?: (minutes: number, breakMinutes: number) => void
  /** Blocks already banked today, so this one can be numbered. */
  completedBlocksToday: number
}

const RADIUS = 120
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function MobileFocusPanel({
  timer,
  breakMinutes,
  onSetBlockLength,
  completedBlocksToday,
}: MobileFocusPanelProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const {
    status,
    minutes,
    seconds,
    fractionComplete,
    durationMinutes,
    label,
    selectedTask,
    elapsedMinutes,
    hasBankableWork,
    pause,
    resume,
    reset,
    stopAndBank,
  } = timer

  const isLive = status === 'running' || status === 'paused'

  if (!isLive) {
    return (
      <div className="mt-3 lg:hidden" data-testid="mobile-focus-idle">
        <DeepWorkTimer timer={timer} breakMinutes={breakMinutes} onSetBlockLength={onSetBlockLength} />
      </div>
    )
  }

  const title = selectedTask?.title ?? label

  return (
    <div
      className="mt-3 flex flex-col items-center lg:hidden"
      data-testid="mobile-focus-running"
    >
      <p className="text-xs font-semibold text-share-onSurfaceVariant">
        Block {completedBlocksToday + 1} today
      </p>

      <div className="mt-6 px-8 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
          Working on
        </p>
        <h2 className="mt-2.5 font-shareHeadline text-lg font-bold leading-snug text-share-onBg">
          {title}
        </h2>
      </div>

      <div className="relative mt-8 h-[260px] w-[260px]">
        <svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle cx="130" cy="130" r={RADIUS} fill="none" stroke="#23262a" strokeWidth="4" />
          <circle
            cx="130"
            cy="130"
            r={RADIUS}
            fill="none"
            stroke="#00daf3"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fractionComplete)))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-shareHeadline text-[62px] font-extrabold leading-none tabular-nums tracking-[-0.03em] text-share-onBg">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <p className="mt-2.5 text-xs font-semibold text-share-onSurfaceVariant">
            of a {durationMinutes} minute block
          </p>
        </div>
      </div>

      <div className="mt-11 flex items-center justify-center gap-3.5">
        <button
          type="button"
          onClick={() => (hasBankableWork ? setConfirmDiscard(true) : reset())}
          aria-label="Discard this block and start over"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-share-outlineVariant bg-share-surfaceContainerLow text-share-onSurfaceVariant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={status === 'paused' ? resume : pause}
          aria-label={status === 'paused' ? 'Resume block' : 'Pause block'}
          className="flex h-[82px] w-[82px] items-center justify-center rounded-full bg-share-primary text-share-onPrimary"
        >
          {status === 'paused' ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1.4" />
              <rect x="14" y="4" width="4" height="16" rx="1.4" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => stopAndBank()}
          aria-label="Finish early and keep the minutes worked"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-share-outlineVariant bg-share-surfaceContainerLow text-share-onSurfaceVariant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>

      {/* Only the restart button can cost minutes that were really worked, so
          it is the only one that asks. Keeping them is the default. */}
      {confirmDiscard && (
        <div className="mx-5 mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm text-share-onBg">
            This block has run for{' '}
            <span className="font-semibold text-amber-200">{formatMinutes(elapsedMinutes)}</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                stopAndBank()
                setConfirmDiscard(false)
              }}
              className="touch-target rounded-lg border border-share-primary/60 bg-share-primary/15 px-3 text-sm font-semibold text-share-primary"
            >
              Keep {formatMinutes(elapsedMinutes)} and stop
            </button>
            <button
              type="button"
              onClick={() => {
                reset()
                setConfirmDiscard(false)
              }}
              className="touch-target rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 text-sm text-share-onSurfaceVariant"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="touch-target rounded-lg px-3 text-sm text-share-onSurfaceVariant"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mt-10 px-8 text-center text-xs text-share-onSurfaceVariant/70">
        Finishing this fills one box on the task
      </p>
    </div>
  )
}
