/**
 * components/timer/useDeepWorkTimer.ts
 *
 * The deep work timer's state, lifted out of the component that draws it.
 *
 * Two things forced this. The planner renders the timer twice - once in the
 * desktop sidebar, once in the mobile tab - and while the timer owned its own
 * state those were two unrelated countdowns; starting one on a phone left the
 * sidebar copy sitting at 45:00. And a task's progress row can now start a
 * block itself, which needs a single countdown to talk to, not whichever copy
 * happened to be mounted. One hook in DayPlanner, two views of it.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { normalizeFocusBlockMinutes } from '../../domain/focusBlocks'

/** A task this session can be attributed to. */
export interface TimerTaskOption {
  id: string
  title: string
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

/** What the timer is doing right now, as a task's progress row needs to see it. */
export interface ActiveBlock {
  taskId?: string
  status: 'running' | 'paused'
  /** Epoch ms the countdown lands on. Null while paused. */
  endsAt: number | null
  /** Frozen remainder while paused. */
  remainingMs: number
  totalMinutes: number
}

export interface StartBlockRequest {
  taskId?: string
  minutes: number
  label?: string
}

/** Why a start request was turned down, so the caller can say so. */
export type StartBlockResult = 'started' | 'busy'

interface UseDeepWorkTimerOptions {
  onSessionComplete?: (label: string, durationMinutes: number, taskId?: string) => void
  taskOptions?: TimerTaskOption[]
  selectedTaskId?: string
  onSelectTask?: (taskId: string | undefined) => void
  /** The configured block length - the timer's default and its highlighted preset. */
  blockMinutes?: number
  /** Called when a block starts from somewhere other than the timer itself. */
  onBlockStarted?: () => void
}

export interface DeepWorkTimerController {
  label: string
  setLabel: (label: string) => void
  durationMinutes: number
  customInput: string
  status: TimerStatus
  minutes: number
  seconds: number
  fractionComplete: number
  options: TimerTaskOption[]
  selectedTask: TimerTaskOption | undefined
  isAttributionLocked: boolean
  blockMinutes: number
  activeBlock: ActiveBlock | null
  selectTask: (taskId: string) => void
  setPreset: (minutes: number) => void
  setCustom: (raw: string) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  /** Start a block for a task from outside the timer (a progress chip). */
  startBlock: (request: StartBlockRequest) => StartBlockResult
}

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

export function useDeepWorkTimer({
  onSessionComplete,
  taskOptions,
  selectedTaskId,
  onSelectTask,
  blockMinutes: blockMinutesInput,
  onBlockStarted,
}: UseDeepWorkTimerOptions): DeepWorkTimerController {
  const blockMinutes = normalizeFocusBlockMinutes(blockMinutesInput)
  const [label, setLabel] = useState('Deep work block')
  /**
   * The length the user picked for this block, or null to follow the configured
   * block length. Derived rather than synced, so changing the setting moves an
   * untouched timer without an effect writing state back into render.
   */
  const [pickedMinutes, setPickedMinutes] = useState<number | null>(null)
  const durationMinutes = pickedMinutes ?? blockMinutes
  const [customInput, setCustomInput] = useState('')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [targetTime, setTargetTime] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)

  const options = useMemo(() => taskOptions ?? [], [taskOptions])
  // A task deleted mid-session leaves a dangling id behind; fall back to an
  // unattributed session rather than crediting work to something that is gone.
  const selectedTask = options.find((option) => option.id === selectedTaskId)
  // The attribution is locked once a session is under way. Swapping tasks
  // mid-block would credit the whole block to whichever task happened to be
  // selected when the countdown ended.
  const isAttributionLocked = status === 'running' || status === 'paused'

  const onSessionCompleteRef = useLatest(onSessionComplete)

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
        onSessionCompleteRef.current?.(label, durationMinutes, selectedTask?.id)
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [status, targetTime, label, durationMinutes, selectedTask?.id, onSessionCompleteRef])

  const totalMs = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes])
  // Show original duration when idle or finished (not 00:00 after completion)
  const effectiveRemaining = status === 'idle' || status === 'finished' ? totalMs : remainingMs

  const minutes = Math.floor(effectiveRemaining / 60000)
  const seconds = Math.floor((effectiveRemaining % 60000) / 1000)

  const fractionComplete =
    status === 'finished'
      ? 1
      : totalMs === 0
        ? 0
        : 1 - Math.min(1, effectiveRemaining / Math.max(1, totalMs))

  const selectTask = useCallback((nextValue: string) => {
    if (isAttributionLocked) return
    const nextId = nextValue === '' ? undefined : nextValue
    onSelectTask?.(nextId)
    const nextTask = options.find((option) => option.id === nextId)
    if (nextTask) setLabel(nextTask.title)
  }, [isAttributionLocked, onSelectTask, options])

  const setPreset = useCallback((minutesPreset: number) => {
    if (status === 'running') return
    setPickedMinutes(minutesPreset)
    setCustomInput('')
  }, [status])

  const setCustom = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 3)
    setCustomInput(digits)
    const parsed = parseInt(digits, 10)
    if (!isNaN(parsed) && parsed >= 1) setPickedMinutes(parsed)
  }, [])

  const start = useCallback(() => {
    setTargetTime(Date.now() + durationMinutes * 60 * 1000)
    setStatus('running')
  }, [durationMinutes])

  const pause = useCallback(() => {
    if (status !== 'running') return
    setStatus('paused')
    setTargetTime(null)
  }, [status])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    setTargetTime(Date.now() + remainingMs)
    setStatus('running')
  }, [status, remainingMs])

  const reset = useCallback(() => {
    setStatus('idle')
    setTargetTime(null)
    setRemainingMs(0)
    // Back to following the configured block length until told otherwise.
    setPickedMinutes(null)
    setCustomInput('')
  }, [])

  const startBlock = useCallback((request: StartBlockRequest): StartBlockResult => {
    // A block under way is never interrupted from a task row - the running
    // block is already credited to something, and silently retargeting it would
    // move earned minutes onto a task they were not worked on.
    if (status === 'running' || status === 'paused') return 'busy'

    const minutesToRun = Math.max(1, Math.round(request.minutes))
    onSelectTask?.(request.taskId)
    if (request.label) setLabel(request.label)
    setPickedMinutes(minutesToRun)
    setCustomInput('')
    // Both updates land in one batch, so the countdown effect re-runs against
    // the new duration and credits the session for the right number of minutes.
    setTargetTime(Date.now() + minutesToRun * 60 * 1000)
    setStatus('running')
    onBlockStarted?.()
    return 'started'
  }, [status, onSelectTask, onBlockStarted])

  // Only the identity of the running block, never its remaining milliseconds -
  // a chip runs its own second hand, so this does not re-render the whole day
  // once a second.
  const pausedRemainingMs = status === 'paused' ? remainingMs : 0
  const activeBlock = useMemo<ActiveBlock | null>(() => {
    if (status === 'running' && targetTime != null) {
      // No remaining time here: a running block is described by the instant it
      // lands on, and whoever draws a countdown reads its own clock. Putting a
      // live figure in this object would re-render the day once a second.
      return {
        taskId: selectedTask?.id,
        status: 'running',
        endsAt: targetTime,
        remainingMs: 0,
        totalMinutes: durationMinutes,
      }
    }
    if (status === 'paused') {
      return {
        taskId: selectedTask?.id,
        status: 'paused',
        endsAt: null,
        remainingMs: pausedRemainingMs,
        totalMinutes: durationMinutes,
      }
    }
    return null
  }, [status, targetTime, selectedTask?.id, durationMinutes, pausedRemainingMs])

  return {
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
    activeBlock,
    selectTask,
    setPreset,
    setCustom,
    start,
    pause,
    resume,
    reset,
    startBlock,
  }
}

/** Keeps a callback fresh inside an interval without restarting it. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
