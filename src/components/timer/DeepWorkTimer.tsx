import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle } from 'lucide-react'

interface DeepWorkTimerProps {
  onSessionComplete?: (label: string, durationMinutes: number) => void
}

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

function playCompletionChime() {
  try {
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5 - major arpeggio
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch (_err) {
    // AudioContext unavailable - silent fail
  }
}

const PRESETS = [15, 25, 30, 45, 50, 60]

export function DeepWorkTimer({ onSessionComplete }: DeepWorkTimerProps) {
  const [label, setLabel] = useState('Deep work block')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [customInput, setCustomInput] = useState('')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [targetTime, setTargetTime] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)

  const onSessionCompleteRef = useRef(onSessionComplete)
  useLayoutEffect(() => {
    onSessionCompleteRef.current = onSessionComplete
  })

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
        playCompletionChime()
        onSessionCompleteRef.current?.(label, durationMinutes)
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [status, targetTime, label, durationMinutes])

  const totalMs = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes])
  // Show original duration when idle or finished (not 00:00 after completion)
  const effectiveRemaining = status === 'idle' || status === 'finished' ? totalMs : remainingMs

  const minutes = Math.floor(effectiveRemaining / 60000)
  const seconds = Math.floor((effectiveRemaining % 60000) / 1000)

  const handlePreset = (minutesPreset: number) => {
    if (status === 'running') return
    setDurationMinutes(minutesPreset)
    setCustomInput('')
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCustomInput(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 1) {
      setDurationMinutes(parsed)
    }
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
  const isCustom = !PRESETS.includes(durationMinutes)

  const fractionComplete =
    status === 'finished'
      ? 1
      : totalMs === 0
        ? 0
        : 1 - Math.min(1, effectiveRemaining / Math.max(1, totalMs))

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
          {PRESETS.map((minutesPreset) => (
            <button
              key={minutesPreset}
              type="button"
              disabled={isRunning}
              onClick={() => handlePreset(minutesPreset)}
              className={`rounded-full border px-3 py-1 transition-colors ${
                durationMinutes === minutesPreset && !isCustom
                  ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-sky-500 hover:text-sky-400'
              } ${isRunning ? 'opacity-60' : ''}`}
            >
              {minutesPreset} min
            </button>
          ))}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            disabled={isRunning}
            value={customInput}
            onChange={handleCustomChange}
            placeholder="?? min"
            aria-label="Custom duration in minutes"
            className={`w-16 rounded-full border px-2 py-1 text-center transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
              isCustom
                ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 placeholder:text-slate-600 focus:border-sky-500 focus:text-sky-400'
            } ${isRunning ? 'opacity-60' : ''}`}
          />
        </div>

        {status === 'finished' ? (
          <div className="rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-teal-300">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Session complete</span>
            </div>
            <p className="mt-0.5 text-xs text-teal-400/70">
              {durationMinutes} min - {label}
            </p>
            <p className="mt-1 text-xs text-slate-400">Block logged. Start another or call it done.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-2xl sm:text-3xl">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 capitalize">{status}</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-900">
              <div
                className="h-1.5 rounded-full bg-sky-500 transition-[width] duration-300"
                style={{ width: `${fractionComplete * 100}%` }}
              />
            </div>
          </div>
        )}

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
