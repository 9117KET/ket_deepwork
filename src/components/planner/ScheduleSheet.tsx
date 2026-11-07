/**
 * components/planner/ScheduleSheet.tsx
 *
 * Put a task on the calendar. One tap for "the next free slot that fits",
 * or a time of your choosing; either way the result is a real calendar event
 * with a reminder, which is what makes the calendar — not this app — the thing
 * that taps you on the shoulder.
 *
 * Without a calendar connection the sheet still sets a plain time on the task
 * and says plainly that no reminder comes with it.
 *
 * How long: a typed length ("2h 30m", "45", "1:30", read by
 * `parseDurationInput`) above the ladder. Typing a valid length selects it;
 * Enter saves it as the task's length and closes, like "Save length only".
 *
 * Drawn by the shared `ui/Sheet` (focus trap, inert app behind, Escape and
 * scrim close, drag to dismiss on touch).
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '../../domain/types'
import { durationOptions as ladderWith, parseDurationInput } from '../../domain/durations'
import { formatMinutes } from '../../domain/taskProgress'
import { DURATION_INPUT_ERROR, DURATION_INPUT_PLACEHOLDER } from './DurationChip'
import { Sheet } from '../ui/Sheet'
import { ErrorLine } from '../ui/Notices'

export interface ScheduleRequest {
  durationMinutes: number
  /** "HH:MM"; omitted = next free slot. */
  startTime?: string
}

interface ScheduleSheetProps {
  task: Task
  defaultMinutes: number
  connected: boolean
  /** Signed-in users can connect; guests are pointed at signing in instead. */
  canConnect: boolean
  onSchedule: (req: ScheduleRequest) => Promise<void>
  onUnschedule: () => Promise<void>
  /** Set how long the task takes without putting it anywhere in time. */
  onSaveLength: (minutes: number) => void
  onClose: () => void
}

export function ScheduleSheet({
  task,
  defaultMinutes,
  connected,
  canConnect,
  onSchedule,
  onUnschedule,
  onSaveLength,
  onClose,
}: ScheduleSheetProps) {
  const [minutes, setMinutes] = useState(task.durationMinutes ?? defaultMinutes)
  const [time, setTime] = useState(task.scheduledAt ?? '')
  const [busy, setBusy] = useState<null | 'next' | 'at' | 'remove'>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState(false)

  const saveTyped = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseDurationInput(typed)
    if (parsed == null) {
      setTypedError(true)
      return
    }
    onSaveLength(parsed)
    onClose()
  }

  const run = async (kind: 'next' | 'at' | 'remove', fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (e) {
      setError((e as Error).message.replace(/^.*Uncaught Error: /, '').replace(/\s+at .*$/s, ''))
      setBusy(null)
    }
  }

  // The same ascending ladder as the desktop picker. The stored length is
  // kept in order; a default the sheet opened on (the focus block) is too.
  const fromStored = ladderWith(task.durationMinutes)
  const durationOptions = fromStored.includes(minutes) ? fromStored : [...fromStored, minutes].sort((a, b) => a - b)

  const footer = (
    <div className="mt-4 flex items-center justify-between">
      {task.scheduledAt ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('remove', onUnschedule)}
          className="min-h-[44px] rounded-lg px-3 text-sm text-share-onSurfaceVariant hover:text-share-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-50 -ml-3"
        >
          {busy === 'remove' ? 'Removing…' : connected ? 'Remove from calendar' : 'Clear time'}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        {minutes !== task.durationMinutes && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              onSaveLength(minutes)
              onClose()
            }}
            className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-share-onSurface hover:bg-share-surfaceContainerHighest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-50"
          >
            Save length only
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-lg px-3 text-sm text-share-onSurfaceVariant hover:text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg -mr-3"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <Sheet onClose={onClose} kicker="Schedule" title={<span className="block truncate">{task.title}</span>} footer={footer}>
      <fieldset className="mt-4">
        <legend className="text-caption font-semibold text-share-onSurfaceVariant">How long</legend>
        <form onSubmit={saveTyped} className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            inputMode="text"
            enterKeyHint="done"
            value={typed}
            onChange={(e) => {
              const raw = e.target.value
              setTyped(raw)
              setTypedError(false)
              const parsed = parseDurationInput(raw)
              if (parsed != null) setMinutes(parsed)
            }}
            placeholder={DURATION_INPUT_PLACEHOLDER}
            aria-label="Type how long"
            aria-invalid={typedError || undefined}
            name="duration"
            autoComplete="off"
            spellCheck={false}
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-share-outlineStrong bg-share-surfaceContainer px-3 text-sm tabular-nums text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="min-h-[44px] rounded-xl border border-share-outlineStrong px-4 text-sm font-semibold text-share-onSurface hover:border-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-50"
          >
            Save length
          </button>
        </form>
        {typedError && <ErrorLine className="mt-2" message={DURATION_INPUT_ERROR} />}
        <div role="group" aria-label="Pick a length" className="mt-2 flex flex-wrap gap-1.5">
          {durationOptions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMinutes(m)
                setTyped('')
                setTypedError(false)
              }}
              aria-pressed={m === minutes}
              className={`touch-target-coarse rounded-lg border px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg ${
                m === minutes
                  ? 'border-share-primary bg-share-primary/15 font-semibold text-share-primary'
                  : 'border-share-outlineVariant/40 text-share-onSurface hover:border-share-primary/50'
              }`}
            >
              {formatMinutes(m)}
            </button>
          ))}
        </div>
      </fieldset>

      {connected ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('next', () => onSchedule({ durationMinutes: minutes }))}
          className="mt-4 w-full rounded-xl bg-share-primary px-4 py-3 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-surfaceContainerHigh disabled:opacity-60"
        >
          {busy === 'next' ? 'Finding a slot…' : 'Next free slot'}
        </button>
      ) : (
        <p className="mt-4 rounded-xl border border-share-outlineVariant/40 px-3 py-2.5 text-xs text-share-onSurfaceVariant">
          {canConnect ? (
            <>
              <Link to="/calendar" className="font-semibold text-share-primary hover:underline">
                Connect Google Calendar
              </Link>{' '}
              to drop tasks into free slots with a reminder. Without it, a time is only a note.
            </>
          ) : (
            <>Sign in and connect Google Calendar to get reminders. Without it, a time is only a note.</>
          )}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="min-h-[44px] flex-1 rounded-xl border border-share-outlineStrong bg-share-surfaceContainer px-3 text-sm text-share-onSurface focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg"
          aria-label="Start time"
          name="start-time"
          autoComplete="off"
        />
        <button
          type="button"
          disabled={busy !== null || !/^\d{2}:\d{2}$/.test(time)}
          onClick={() => run('at', () => onSchedule({ durationMinutes: minutes, startTime: time }))}
          className="min-h-[44px] rounded-xl border border-share-outlineStrong px-4 text-sm font-semibold text-share-onSurface hover:border-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-50"
        >
          {busy === 'at' ? 'Saving…' : 'At this time'}
        </button>
      </div>

      {error && <ErrorLine className="mt-3" message={error} />}
    </Sheet>
  )
}
