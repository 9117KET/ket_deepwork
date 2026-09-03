/**
 * components/timer/FocusMode.tsx
 *
 * The desktop Focus screen: while a block runs, the sidebar and the day go
 * away and the countdown is the only thing on the monitor.
 *
 * This is rule 5 of the redesign taken to its end. On a phone Focus is a
 * destination you tap to, and leaving the day behind is free — the screen only
 * ever held one thing. On a desktop the day is *already* on screen, so the only
 * way Focus can mean the same thing is to cover it. A timer running in the
 * corner of a planner is a timer you look past; this one you cannot.
 *
 * What it deliberately does not do is trap you. Esc leaves, the corner says so,
 * and leaving does not touch the block — the countdown keeps running in the
 * sidebar exactly as before. Dismissing is remembered until the block ends, so
 * a screen you pushed away does not shove itself back in front of you a second
 * later. See `docs/design/desktop/DesktopFocus.dc.html`.
 *
 * Stopping is the one place this screen is careful. "Finish early" banks the
 * minutes worked, because they were really worked; the restart button throws
 * them away and therefore asks first, the same guard `DeepWorkTimer` uses.
 * `docs/data-safety.md` is the register this belongs to.
 */

import { useEffect, useState } from 'react'
import type { TaskProgress } from '../../domain/taskProgress'
import { formatMinutes } from '../../domain/taskProgress'
import type { DeepWorkTimerController } from './useDeepWorkTimer'

interface FocusModeProps {
  timer: DeepWorkTimerController
  /** Progress for the task this block is pointed at, if it has one. */
  progress: TaskProgress | null
  /** Blocks already finished today, so this one can be numbered. */
  completedBlocksToday: number
  /** Minutes of deep work already earned today. */
  deepMinutesToday: number
  onLeave: () => void
}

const RADIUS = 158
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function FocusMode({
  timer,
  progress,
  completedBlocksToday,
  deepMinutesToday,
  onLeave,
}: FocusModeProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const {
    minutes,
    seconds,
    fractionComplete,
    durationMinutes,
    status,
    label,
    selectedTask,
    elapsedMinutes,
    hasBankableWork,
    pause,
    resume,
    reset,
    stopAndBank,
  } = timer

  // Esc leaves. The block is untouched — this screen is a view of the timer,
  // never the timer itself, so closing it can never cost a minute.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmDiscard) {
        setConfirmDiscard(false)
        return
      }
      onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onLeave, confirmDiscard])

  const title = selectedTask?.title ?? label
  const blockNumber = completedBlocksToday + 1

  return (
    <div
      role="dialog"
      aria-label="Focus mode"
      data-testid="focus-mode"
      /*
       * Above the app chrome, not merely over the page: AppTopBar is z-50 and
       * AppSidebar z-40, so anything lower leaves the header and a strip of
       * sidebar punched through the middle of a "nothing else on screen" view.
       */
      className="fixed inset-0 z-[60] hidden flex-col bg-[#0d0f11] text-share-onBg lg:flex"
    >
      {/* A single soft pool of the accent, so the eye lands in the middle of
          the screen and has nowhere else to go. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(0,218,243,0.06) 0%, rgba(0,218,243,0) 68%)',
        }}
      />

      <div className="relative flex items-center justify-between px-8 py-6">
        <button
          type="button"
          onClick={onLeave}
          className="touch-target flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-share-onSurfaceVariant/70 transition-colors hover:text-share-onBg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Leave focus</span>
        </button>
        <p className="text-sm text-share-onSurfaceVariant/70">
          Block {blockNumber} today
          {deepMinutesToday > 0 ? ` · ${formatMinutes(deepMinutesToday)} deep so far` : ''}
        </p>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-12 px-8 xl:flex-row xl:gap-[86px]">
        <div className="relative h-[340px] w-[340px] shrink-0">
          <svg
            width="340"
            height="340"
            viewBox="0 0 340 340"
            className="absolute inset-0 -rotate-90"
            aria-hidden="true"
          >
            <circle cx="170" cy="170" r={RADIUS} fill="none" stroke="#1c2023" strokeWidth="5" />
            <circle
              cx="170"
              cy="170"
              r={RADIUS}
              fill="none"
              stroke="#00daf3"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fractionComplete)))}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-shareHeadline text-[82px] font-extrabold leading-none tabular-nums tracking-[-0.035em]"
              aria-live="off"
            >
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <p className="mt-3 text-sm font-semibold text-share-onSurfaceVariant/70">
              of a {durationMinutes} minute block
            </p>
          </div>
        </div>

        <div className="max-w-[400px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-share-primary">
            Working on
          </p>
          <h2 className="mt-3.5 font-shareHeadline text-3xl font-extrabold leading-tight tracking-[-0.02em]">
            {title}
          </h2>

          {progress && (
            <>
              <div className="mt-6 flex max-w-[300px] gap-2">
                {progress.slots.map((slot, i) => (
                  <span
                    key={i}
                    style={{ flexGrow: slot.widthRatio }}
                    className={`h-2.5 rounded-full ${
                      slot.isOverflow
                        ? 'bg-share-tertiary'
                        : slot.filledRatio >= 1
                        ? 'bg-share-primary'
                        : slot.filledRatio > 0
                        ? 'bg-share-primary/50'
                        : 'bg-[#1c2023]'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 text-sm text-share-onSurfaceVariant">
                <span className="font-semibold text-share-onBg">
                  {formatMinutes(progress.totalMinutes)}
                </span>{' '}
                done of {formatMinutes(progress.goalMinutes)} planned
              </p>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={status === 'paused' ? resume : pause}
              className="flex h-[52px] items-center gap-2.5 rounded-2xl bg-share-primary px-6 font-extrabold text-share-onPrimary transition-opacity hover:opacity-90"
            >
              {status === 'paused' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1.4" />
                  <rect x="14" y="4" width="4" height="16" rx="1.4" />
                </svg>
              )}
              <span>{status === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={() => (hasBankableWork ? setConfirmDiscard(true) : reset())}
              aria-label="Discard this block and start over"
              title="Discard this block and start over"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[#2a3033] bg-[#16191c] text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => stopAndBank()}
              className="flex h-[52px] items-center gap-2.5 rounded-2xl border border-[#2a3033] bg-[#16191c] px-5 text-sm font-semibold text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Finish early</span>
            </button>
          </div>

          {/*
            The restart button is the only control here that can cost you
            minutes you actually sat and worked, so it is the only one that
            asks. Keeping them is the default.
          */}
          {confirmDiscard && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
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
                  className="touch-target rounded-lg border border-share-primary/60 bg-share-primary/15 px-3 text-sm font-semibold text-share-primary hover:bg-share-primary/25"
                >
                  Keep {formatMinutes(elapsedMinutes)} and stop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset()
                    setConfirmDiscard(false)
                  }}
                  className="touch-target rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 text-sm text-share-onSurfaceVariant hover:border-red-500/60 hover:text-red-300"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="touch-target rounded-lg px-3 text-sm text-share-onSurfaceVariant hover:text-share-onBg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="relative pb-8 text-center text-sm text-[#556064]">
        The sidebar and the day are hidden while a block runs. Press Esc to bring them back.
      </p>
    </div>
  )
}
