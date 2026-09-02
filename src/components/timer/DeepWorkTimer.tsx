/**
 * components/timer/DeepWorkTimer.tsx
 *
 * The timer's face. All of its state lives in `useDeepWorkTimer`, held once by
 * DayPlanner, so the desktop sidebar copy and the mobile tab copy are two views
 * of one countdown rather than two countdowns.
 *
 * The preset row is the focus-block set (25/45/60/90) rather than an arbitrary
 * ladder of minutes, and the configured block is marked, because that length is
 * what a task's progress row is drawn in. Running something else is allowed -
 * it just fills part of a block instead of one exactly.
 *
 * Which length is *yours* is set from here too, on the line under the presets.
 * It used to live at the bottom of the monthly tracking dashboard, a screen
 * away from the only control it affects. Deciding your block length is
 * something you do while looking at the timer and thinking "45 is too short" -
 * so the decision belongs next to the chips that just proved it, and the chip
 * you are already reaching for is the one that sets it.
 */

import { useState, type FormEvent } from 'react'
import { CheckCircle } from 'lucide-react'
import { FOCUS_BLOCK_PRESETS, suggestedBreakMinutes } from '../../domain/focusBlocks'
import type { DeepWorkTimerController } from './useDeepWorkTimer'

export type { TimerTaskOption } from './useDeepWorkTimer'

interface DeepWorkTimerProps {
  timer: DeepWorkTimerController
  /** The rest that goes with the configured block, shown alongside it. */
  breakMinutes?: number
  /**
   * Adopt a length as the configured block. Omitted in share mode and anywhere
   * else the setting is not the viewer's to change, which hides the control
   * rather than showing a dead one.
   */
  onSetBlockLength?: (minutes: number, breakMinutes: number) => void
}

export function DeepWorkTimer({ timer, breakMinutes, onSetBlockLength }: DeepWorkTimerProps) {
  const {
    label,
    setLabel,
    durationMinutes,
    customInput,
    status,
    minutes,
    seconds,
    fractionComplete,
    options,
    selectedTask,
    isAttributionLocked,
    blockMinutes,
    selectTask,
    setPreset,
    setCustom,
    start,
    pause,
    resume,
    reset,
    elapsedMinutes,
    hasBankableWork,
    stopAndBank,
  } = timer

  // Armed only while a stop would actually cost something, so an untouched
  // block still resets in one click.
  const [confirmStop, setConfirmStop] = useState(false)

  const isRunning = status === 'running'
  const isIdleOrFinished = status === 'idle' || status === 'finished'
  const presetMinutes = FOCUS_BLOCK_PRESETS.map((preset) => preset.minutes)
  const isCustom = !presetMinutes.includes(durationMinutes)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    start()
  }

  return (
    <section className="rounded-lg border border-share-outlineVariant/25 bg-share-surfaceContainerLow p-3 sm:p-4">
      <header className="mb-3">
        <h3 className="text-sm sm:text-base font-semibold text-share-onBg">Deep work timer</h3>
        <p className="text-xs text-share-onSurfaceVariant">
          One block, one thing. Finishing it fills a box on the task.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        {options.length > 0 && (
          <div className="space-y-1">
            <label className="block text-xs text-share-onSurfaceVariant" htmlFor="deep-work-timer-task">
              Working on
            </label>
            <select
              id="deep-work-timer-task"
              value={selectedTask?.id ?? ''}
              disabled={isAttributionLocked}
              onChange={(event) => selectTask(event.target.value)}
              className={`w-full rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary ${
                isAttributionLocked ? 'opacity-60' : ''
              }`}
              title={
                isAttributionLocked
                  ? 'Locked while a session is under way'
                  : 'Credit this session to a task'
              }
            >
              <option value="">No task - just log the time</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
            {selectedTask && (
              <p className="text-xs text-share-onSurfaceVariant/70">
                Finishing this block fills its progress boxes.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs text-share-onSurfaceVariant" htmlFor="deep-work-timer-label">
            Session label
          </label>
          <input
            id="deep-work-timer-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="w-full rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
            placeholder="What are you focusing on?"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {FOCUS_BLOCK_PRESETS.map((preset) => {
            const isSelected = durationMinutes === preset.minutes && !isCustom
            const isConfigured = preset.minutes === blockMinutes
            return (
              <button
                key={preset.minutes}
                type="button"
                disabled={isRunning}
                onClick={() => setPreset(preset.minutes)}
                title={`${preset.name} - ${preset.blurb}${isConfigured ? '\nThis is your block length' : ''}`}
                className={`flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 transition-colors ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-share-outlineVariant/40 bg-share-surfaceContainer text-share-onSurfaceVariant hover:border-share-primary/60 hover:text-share-primary'
                } ${isRunning ? 'opacity-60' : ''}`}
              >
                {isConfigured && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400"
                    aria-label="Your block length"
                  />
                )}
                {preset.minutes}m
              </button>
            )
          })}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            disabled={isRunning}
            value={customInput}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="?? min"
            aria-label="Custom duration in minutes"
            className={`min-h-[36px] w-16 rounded-full border px-2 py-1 text-center transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
              isCustom
                ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                : 'border-share-outlineVariant/40 bg-share-surfaceContainer text-share-onSurfaceVariant placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:text-share-primary'
            } ${isRunning ? 'opacity-60' : ''}`}
          />
        </div>

        <BlockLengthLine
          durationMinutes={durationMinutes}
          blockMinutes={blockMinutes}
          breakMinutes={breakMinutes ?? suggestedBreakMinutes(blockMinutes)}
          disabled={isRunning}
          onSetBlockLength={onSetBlockLength}
        />

        {status === 'finished' ? (
          <div className="rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-teal-300">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Block complete</span>
            </div>
            <p className="mt-0.5 text-xs text-teal-400/70">
              {durationMinutes} min - {label}
            </p>
            <p className="mt-1 text-xs text-share-onSurfaceVariant">Block logged. Start another or call it done.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-2xl sm:text-3xl">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </p>
              <p className="text-xs text-share-onSurfaceVariant capitalize">{status}</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-share-outlineVariant/25">
              <div
                className="h-1.5 rounded-full bg-share-primary transition-[width] duration-300"
                style={{ width: `${fractionComplete * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isIdleOrFinished ? (
            <button
              type="submit"
              className="min-h-[44px] rounded-md border border-sky-500 bg-sky-500 px-4 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
            >
              Start
            </button>
          ) : null}

          {isRunning ? (
            <button
              type="button"
              onClick={pause}
              className="min-h-[44px] rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-4 py-1.5 text-sm text-share-onBg hover:border-share-primary/60 hover:text-share-primary"
            >
              Pause
            </button>
          ) : null}

          {status === 'paused' ? (
            <button
              type="button"
              onClick={resume}
              className="min-h-[44px] rounded-md border border-share-primary/60 bg-share-primary/10 px-4 py-1.5 text-sm text-share-primary hover:bg-share-primary/20"
            >
              Resume
            </button>
          ) : null}

          {!isIdleOrFinished ? (
            <button
              type="button"
              onClick={() => (hasBankableWork ? setConfirmStop(true) : reset())}
              className="min-h-[44px] rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-4 py-1.5 text-sm text-share-onSurfaceVariant hover:border-share-primary/60 hover:text-share-primary"
            >
              Stop
            </button>
          ) : null}
        </div>

        {/*
          Stopping a block that has run for a while used to bin the elapsed
          minutes with no warning and no record — which made "a block is already
          running" a choice between losing your place and losing your work.
          Keeping them is the default because they were really worked.
        */}
        {confirmStop && !isIdleOrFinished ? (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm text-share-onBg">
              This block has run for{' '}
              <span className="font-semibold text-amber-200">{formatBlockMinutes(elapsedMinutes)}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  stopAndBank()
                  setConfirmStop(false)
                }}
                className="min-h-[44px] rounded-md border border-share-primary/60 bg-share-primary/15 px-3 py-1.5 text-sm font-semibold text-share-primary hover:bg-share-primary/25"
              >
                Keep {formatBlockMinutes(elapsedMinutes)} and stop
              </button>
              <button
                type="button"
                onClick={() => {
                  reset()
                  setConfirmStop(false)
                }}
                className="min-h-[44px] rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onSurfaceVariant hover:border-red-500/60 hover:text-red-300"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                className="min-h-[44px] rounded-md px-3 py-1.5 text-sm text-share-onSurfaceVariant hover:text-share-onBg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  )
}

/**
 * What your block is, and the one-tap way to change it to whatever you just
 * picked.
 *
 * The offer only appears when the two disagree, because that is the only
 * moment the question is live - you have reached for 60m twice in a row and
 * the planner is still drawing your tasks in 45s. The warning is not
 * decoration: the block length is the unit every progress row is drawn in, so
 * changing it re-buckets work already logged. Nothing is lost, but the shape of
 * every row changes, and that is worth saying before the tap rather than after.
 */
function BlockLengthLine({
  durationMinutes,
  blockMinutes,
  breakMinutes,
  disabled,
  onSetBlockLength,
}: {
  durationMinutes: number
  blockMinutes: number
  breakMinutes: number
  disabled: boolean
  onSetBlockLength?: (minutes: number, breakMinutes: number) => void
}) {
  const differs = durationMinutes !== blockMinutes

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-share-onSurfaceVariant/70">
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400"
        />
        Your block: {blockMinutes}m on · {breakMinutes}m off
      </span>
      {onSetBlockLength && differs && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSetBlockLength(durationMinutes, suggestedBreakMinutes(durationMinutes))}
          title="Draw every task's progress row in blocks of this length. Work already logged re-buckets; nothing is lost."
          className={`rounded-full border border-share-outlineVariant/40 px-2 py-0.5 transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-teal-500/60 hover:text-teal-300'
          }`}
        >
          Make {durationMinutes}m my block
        </button>
      )}
    </div>
  )
}

/** "1h 05m" / "45m" for a block length or an elapsed stretch. */
function formatBlockMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}
