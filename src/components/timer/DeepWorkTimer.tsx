/**
 * components/timer/DeepWorkTimer.tsx
 *
 * A simple deep-work countdown timer with presets.
 * It focuses on clarity over advanced features so you can start a
 * focused block quickly.
 */

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

interface DeepWorkTimerProps {
  onSessionComplete?: (label: string, durationMinutes: number) => void
}

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export function DeepWorkTimer({ onSessionComplete }: DeepWorkTimerProps) {
  const [label, setLabel] = useState('Deep work block')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [targetTime, setTargetTime] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)

  useEffect(() => {
    if (status !== 'running' || targetTime == null) {
      return
    }

    const tick = () => {
      const now = Date.now()
      const msLeft = Math.max(0, targetTime - now)
      setRemainingMs(msLeft)

      if (msLeft === 0) {
        setStatus('finished')
        setTargetTime(null)
        if (onSessionComplete) {
          onSessionComplete(label, durationMinutes)
        }
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [status, targetTime, label, durationMinutes, onSessionComplete])

  const totalMs = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes])
  const effectiveRemaining = status === 'idle' ? totalMs : remainingMs

  const minutes = Math.floor(effectiveRemaining / 60000)
  const seconds = Math.floor((effectiveRemaining % 60000) / 1000)

  const handlePreset = (minutesPreset: number) => {
    if (status === 'running') return
    setDurationMinutes(minutesPreset)
  }

  const handleStart = (event?: FormEvent) => {
    if (event) event.preventDefault()
    const now = Date.now()
    setTargetTime(now + durationMinutes * 60 * 1000)
    setStatus('running')
  }

  const handlePause = () => {
    if (status !== 'running') return
    setStatus('paused')
    setTargetTime(null)
  }

  const handleResume = () => {
    if (status !== 'paused') return
    const now = Date.now()
    setTargetTime(now + remainingMs)
    setStatus('running')
  }

  const handleReset = () => {
    setStatus('idle')
    setTargetTime(null)
    setRemainingMs(0)
  }

  const isRunning = status === 'running'
  const isIdleOrFinished = status === 'idle' || status === 'finished'

  const fractionComplete =
    totalMs === 0 ? 0 : 1 - Math.min(1, effectiveRemaining / Math.max(1, totalMs))

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <header className="mb-3">
        <h3 className="text-sm sm:text-base font-semibold text-slate-100">Deep work timer</h3>
        <p className="text-xs text-slate-400">
          Set a focused block (e.g. German, job applications) and stay with it.
        </p>
      </header>

      <form onSubmit={handleStart} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-xs text-slate-400">Session label</label>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="What are you focusing on?"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Presets:</span>
          {[15, 25, 30, 45, 50, 60].map((minutesPreset) => (
            <button
              key={minutesPreset}
              type="button"
              disabled={isRunning}
              onClick={() => handlePreset(minutesPreset)}
              className={`rounded-full border px-3 py-1 transition-colors ${
                durationMinutes === minutesPreset
                  ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-sky-500 hover:text-sky-400'
              } ${isRunning ? 'opacity-60' : ''}`}
            >
              {minutesPreset} min
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-2xl sm:text-3xl">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-xs text-slate-400 capitalize">{status}</p>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-900">
            <div
              className="h-1.5 rounded-full bg-sky-500"
              style={{ width: `${fractionComplete * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isIdleOrFinished ? (
            <button
              type="submit"
              className="rounded-md border border-sky-500 bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
            >
              Start
            </button>
          ) : null}

          {isRunning ? (
            <button
              type="button"
              onClick={handlePause}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 hover:text-sky-400"
            >
              Pause
            </button>
          ) : null}

          {status === 'paused' ? (
            <button
              type="button"
              onClick={handleResume}
              className="rounded-md border border-sky-500 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-400 hover:bg-sky-500/20"
            >
              Resume
            </button>
          ) : null}

          {!isIdleOrFinished ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 hover:border-sky-500 hover:text-sky-400"
            >
              Reset
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

