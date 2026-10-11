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
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '../../domain/types'

const DURATIONS = [15, 30, 45, 60, 90, 120]

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const durationOptions = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-4 pb-safe-nav shadow-2xl sm:rounded-2xl sm:pb-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-share-outlineVariant/50 sm:hidden" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide text-share-onSurfaceVariant">Schedule</p>
        <h2 id="schedule-sheet-title" className="mt-0.5 truncate text-base font-bold text-share-onBg">
          {task.title}
        </h2>

        <label className="mt-4 block text-xs font-semibold text-share-onSurfaceVariant">
          How long
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {durationOptions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                aria-pressed={m === minutes}
                className={`touch-target-coarse rounded-lg border px-2.5 py-1 text-sm ${
                  m === minutes
                    ? 'border-share-primary bg-share-primary/15 font-semibold text-share-primary'
                    : 'border-share-outlineVariant/40 text-share-onSurface hover:border-share-primary/50'
                }`}
              >
                {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`}
              </button>
            ))}
          </div>
        </label>

        {connected ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run('next', () => onSchedule({ durationMinutes: minutes }))}
            className="mt-4 w-full rounded-xl bg-share-primary px-4 py-3 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
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
            className="min-h-[44px] flex-1 rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 text-sm text-share-onSurface focus:border-share-primary focus:outline-none"
            aria-label="Start time"
          />
          <button
            type="button"
            disabled={busy !== null || !/^\d{2}:\d{2}$/.test(time)}
            onClick={() => run('at', () => onSchedule({ durationMinutes: minutes, startTime: time }))}
            className="min-h-[44px] rounded-xl border border-share-outlineVariant/50 px-4 text-sm font-semibold text-share-onSurface hover:border-share-primary/60 disabled:opacity-50"
          >
            {busy === 'at' ? 'Saving…' : 'At this time'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-amber-300">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          {task.scheduledAt ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('remove', onUnschedule)}
              className="min-h-[44px] text-sm text-share-onSurfaceVariant hover:text-red-300 disabled:opacity-50"
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
                className="min-h-[44px] px-2 text-sm text-share-primary hover:underline disabled:opacity-50"
              >
                Save length only
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-2 text-sm text-share-onSurfaceVariant hover:text-share-onSurface"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
