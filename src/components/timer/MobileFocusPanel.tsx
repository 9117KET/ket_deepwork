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
 * - **Idle** — you have not started anything, so setting up the block is the
 *   screen: what it is for, how long, and one full-width Start. It is its own
 *   layout rather than the desktop card, because a phone needs 48px controls
 *   and the digits where the ring will be. Every rule still lives in
 *   `useDeepWorkTimer`; this file only draws it.
 * - **Running or paused** — the ring is the screen: what you are on, how long
 *   is left, and three controls. Nothing to read, nothing to decide.
 *
 * Both states are a column at least one screen tall with flexible space above
 * and below, so the content sits in the middle on a tall phone instead of
 * hugging the header.
 *
 * The three controls are deliberately not symmetrical. Pause is the large one
 * in the middle because it is the one you reach for mid-block without looking.
 * See `docs/design/mobile/Focus.dc.html`.
 */

import { useState, type FormEvent } from 'react'
import { formatMinutes } from '../../domain/taskProgress'
import { FOCUS_BLOCK_PRESETS } from '../../domain/focusBlocks'
import { AwayBlockClaim } from '../planner/AwayBlockClaim'
import { BlockLengthLine, SoundToggle } from './BlockLengthLine'
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

/** Fills the space between the app header and the tab bar. */
const COLUMN = 'flex min-h-[calc(100dvh-7.5rem)] flex-col lg:hidden'

/**
 * The idle column is shorter: below it sit `PlannerPage`'s `pb-20` and
 * `DayPlanner`'s `h-[calc(4.5rem+env(safe-area-inset-bottom))]` spacer, both
 * clearing the tab bar, so a 7.5rem column made the tab scroll about 100px of
 * nothing. 14rem is the header, its top padding and both clearances, measured
 * at 390x844. On a notched phone the spacer grows by the inset, so subtract it
 * here too.
 */
const IDLE_COLUMN =
  'flex min-h-[calc(100dvh-14rem-env(safe-area-inset-bottom))] flex-col lg:hidden'

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
    return <IdleFocus timer={timer} breakMinutes={breakMinutes} onSetBlockLength={onSetBlockLength} />
  }

  const title = selectedTask?.title ?? label

  return (
    <div className={`${COLUMN} items-center pt-3`} data-testid="mobile-focus-running">
      <p className="text-xs font-semibold text-share-onSurfaceVariant">
        Block {completedBlocksToday + 1} today
      </p>

      <div className="min-h-6 flex-1" aria-hidden="true" />

      <div className="px-8 text-center">
        <p className="overline">Working on</p>
        <h2 className="mt-2.5 font-shareHeadline text-lg font-bold leading-snug text-share-onBg">
          {title}
        </h2>
      </div>

      <div className="relative mt-8 h-[260px] w-[260px]" data-testid="mobile-focus-ring">
        <svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle cx="130" cy="130" r={RADIUS} fill="none" className="stroke-share-hairline" strokeWidth="4" />
          <circle
            cx="130"
            cy="130"
            r={RADIUS}
            fill="none"
            className="stroke-share-primary"
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
        <div className="mx-5 mt-5 rounded-xl border border-share-tertiary bg-share-tertiary/10 p-3">
          <p className="text-sm text-share-onBg">
            This block has run for{' '}
            <span className="font-semibold text-share-tertiary">{formatMinutes(elapsedMinutes)}</span>.
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

      <div className="min-h-6 flex-1" aria-hidden="true" />

      <p className="px-8 pb-6 text-center text-xs text-share-onSurfaceVariant/70">
        Finishing this fills one box on the task
      </p>
    </div>
  )
}

/**
 * Setting up a block on a phone. The same controller as the desktop card, so
 * attribution, the picked length, the block-length offer and mute behave the
 * same; only the sizes change.
 */
function IdleFocus({
  timer,
  breakMinutes,
  onSetBlockLength,
}: {
  timer: DeepWorkTimerController
  breakMinutes: number
  onSetBlockLength?: (minutes: number, breakMinutes: number) => void
}) {
  const {
    status,
    label,
    setLabel,
    durationMinutes,
    customInput,
    minutes,
    seconds,
    options,
    selectedTask,
    isAttributionLocked,
    blockMinutes,
    selectTask,
    setPreset,
    setCustom,
    start,
    pendingAwayBlock,
    confirmAwayBlock,
    discardAwayBlock,
  } = timer

  const presetMinutes = FOCUS_BLOCK_PRESETS.map((preset) => preset.minutes)
  const isCustom = !presetMinutes.includes(durationMinutes)
  // The custom slot reads "Custom" until tapped. It stays a field while it
  // holds digits, and shows the length when the configured block is not one of
  // the presets.
  const [customOpen, setCustomOpen] = useState(false)
  const showCustomField = customOpen || customInput !== ''

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    start()
  }

  const pill = (selected: boolean) =>
    `flex h-12 w-full min-w-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
      selected ? 'bg-share-primary text-share-onPrimary' : 'bg-share-hairline text-share-onSurface'
    }`

  return (
    <div className={`${IDLE_COLUMN} relative pb-6`} data-testid="mobile-focus-idle">
      {/* Top-right, out of the flow, so it does not push the middle down. */}
      <SoundToggle size="phone" className="absolute right-0 top-0" />

      {/* A block that ran out while the app was closed. The Today tab shows the
          same claim; on a phone only one tab is on screen at a time. */}
      {pendingAwayBlock && (
        <div className="mr-12 mt-0.5">
          <AwayBlockClaim
            block={pendingAwayBlock}
            taskTitle={options.find((option) => option.id === pendingAwayBlock.taskId)?.title}
            onConfirm={confirmAwayBlock}
            onDiscard={discardAwayBlock}
          />
        </div>
      )}

      <div className="min-h-12 flex-1" aria-hidden="true" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {options.length > 0 && (
          <div>
            <label className="overline block" htmlFor="mobile-focus-task">
              Working on
            </label>
            <select
              id="mobile-focus-task"
              value={selectedTask?.id ?? ''}
              disabled={isAttributionLocked}
              onChange={(event) => selectTask(event.target.value)}
              className={`mt-2 h-12 w-full rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 text-base text-share-onBg focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary ${
                isAttributionLocked ? 'opacity-60' : ''
              }`}
            >
              <option value="">No task, just log the time</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label="Session label"
          placeholder="What are you focusing on?"
          className="h-12 w-full rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 text-base text-share-onBg placeholder:text-share-onSurfaceDim focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
        />

        <div>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Block length">
            {FOCUS_BLOCK_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => {
                  setPreset(preset.minutes)
                  setCustomOpen(false)
                }}
                aria-pressed={durationMinutes === preset.minutes && !isCustom}
                className={pill(durationMinutes === preset.minutes && !isCustom)}
              >
                {preset.minutes}m
              </button>
            ))}
            {showCustomField ? (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                autoFocus={customOpen && customInput === ''}
                value={customInput}
                onChange={(event) => setCustom(event.target.value)}
                onBlur={() => {
                  if (customInput === '') setCustomOpen(false)
                }}
                placeholder="min"
                aria-label="Custom duration in minutes"
                className={`${pill(isCustom)} px-1 text-center placeholder:text-share-onSurfaceDim focus:outline-none focus:ring-2 focus:ring-share-primary`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                aria-pressed={isCustom}
                aria-label={isCustom ? `Custom length, ${durationMinutes} minutes` : 'Custom length'}
                className={pill(isCustom)}
              >
                {isCustom ? `${durationMinutes}m` : 'Custom'}
              </button>
            )}
          </div>
          <div className="mt-1">
            <BlockLengthLine
              size="phone"
              durationMinutes={durationMinutes}
              blockMinutes={blockMinutes}
              breakMinutes={breakMinutes}
              disabled={false}
              onSetBlockLength={onSetBlockLength}
            />
          </div>
        </div>

        <div className="py-2 text-center">
          <div className="font-shareHeadline text-[62px] font-extrabold leading-none tabular-nums tracking-[-0.03em] text-share-onBg">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <p className="mt-2 text-xs text-share-onSurfaceDim" role={status === 'finished' ? 'status' : undefined}>
            {status === 'finished' ? 'Block logged. Start another or call it done.' : 'ready'}
          </p>
        </div>

        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-share-primary text-[15px] font-bold text-share-onPrimary"
        >
          Start
        </button>
      </form>

      <div className="min-h-4 flex-1" aria-hidden="true" />
    </div>
  )
}
