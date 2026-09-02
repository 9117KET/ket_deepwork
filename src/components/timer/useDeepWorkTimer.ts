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
import {
  AWAY_BLOCK_MAX_AGE_MS,
  clearActiveBlock,
  readActiveBlock,
  writeActiveBlock,
} from '../../storage/activeBlock'

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

/**
 * A block that ran to completion while the app was closed - started before you
 * left, landed while you were out.
 *
 * These minutes are earned rather than self-reported: a wall clock measured an
 * interval you committed to in advance, which is exactly what the timer does
 * when you sit and watch it. They are still confirmed rather than recorded
 * silently, because only you know whether you actually did the thing.
 */
export interface AwayBlock {
  dayIso: string
  taskId?: string
  label: string
  minutes: number
  startedAt: string
  finishedAt: string
}

interface UseDeepWorkTimerOptions {
  onSessionComplete?: (label: string, durationMinutes: number, taskId?: string) => void
  taskOptions?: TimerTaskOption[]
  selectedTaskId?: string
  onSelectTask?: (taskId: string | undefined) => void
  /** The configured block length - the timer's default and its highlighted preset. */
  blockMinutes?: number
  /** Called when a block starts from somewhere other than the timer itself. */
  onBlockStarted?: () => void
  /** The day a block started now belongs to. */
  dayIso?: string
  /** Record a block that ran out while the app was closed, once confirmed. */
  onAwayBlockConfirmed?: (block: AwayBlock) => void
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
  /** A block that finished while the app was closed, waiting to be claimed. */
  pendingAwayBlock: AwayBlock | null
  /** Record the pending away block as earned time. */
  confirmAwayBlock: () => void
  /** Throw the pending away block away - you did not do the work. */
  discardAwayBlock: () => void
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
  dayIso,
  onAwayBlockConfirmed,
}: UseDeepWorkTimerOptions): DeepWorkTimerController {
  const blockMinutes = normalizeFocusBlockMinutes(blockMinutesInput)
  /**
   * Whatever was running when the page last went away, read once at mount.
   *
   * Read into the initial state rather than applied by an effect: the restored
   * countdown is not a change to react to, it is what the timer already was.
   * Reaching for it here means the first render is already correct - no frame
   * showing an idle 45:00 over a block that is halfway through.
   */
  const [restored] = useState(restoreTimer)

  const [label, setLabel] = useState(restored.label ?? 'Deep work block')
  /**
   * The length the user picked for this block, or null to follow the configured
   * block length. Derived rather than synced, so changing the setting moves an
   * untouched timer without an effect writing state back into render.
   */
  const [pickedMinutes, setPickedMinutes] = useState<number | null>(restored.minutes ?? null)
  const durationMinutes = pickedMinutes ?? blockMinutes
  const [customInput, setCustomInput] = useState('')
  const [status, setStatus] = useState<TimerStatus>(restored.status)
  const [targetTime, setTargetTime] = useState<number | null>(restored.targetTime)
  const [remainingMs, setRemainingMs] = useState<number>(restored.remainingMs)
  const [pendingAwayBlock, setPendingAwayBlock] = useState<AwayBlock | null>(restored.awayBlock)
  /**
   * When the running block began. Kept in a ref rather than state because
   * nothing renders it - it exists so a session records the interval it
   * actually covered, including one restored after the tab was gone.
   */
  const startedAtRef = useRef<string | null>(restored.startedAt)

  const options = useMemo(() => taskOptions ?? [], [taskOptions])
  // A task deleted mid-session leaves a dangling id behind; fall back to an
  // unattributed session rather than crediting work to something that is gone.
  const selectedTask = options.find((option) => option.id === selectedTaskId)
  // The attribution is locked once a session is under way. Swapping tasks
  // mid-block would credit the whole block to whichever task happened to be
  // selected when the countdown ended.
  const isAttributionLocked = status === 'running' || status === 'paused'

  const onSessionCompleteRef = useLatest(onSessionComplete)

  /**
   * Tell the planner which task the restored block belongs to. This is the one
   * part of picking a block back up that cannot be an initial value: the
   * selection lives in the parent, and it has to be told.
   */
  const hasAnnouncedRestoreRef = useRef(false)
  useEffect(() => {
    if (hasAnnouncedRestoreRef.current) return
    hasAnnouncedRestoreRef.current = true
    if (restored.taskId) onSelectTask?.(restored.taskId)
  }, [restored.taskId, onSelectTask])

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
    startedAtRef.current = new Date().toISOString()
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
    startedAtRef.current = null
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
    startedAtRef.current = new Date().toISOString()
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

  /**
   * Mirror the countdown into storage so it outlives the tab.
   *
   * Only the identity of the block and the instant it lands on are written -
   * never a decrementing figure - so this fires on state changes rather than
   * once a second. While paused the frozen remainder is the only thing worth
   * keeping, and `pausedRemainingMs` is zero unless we are actually paused, so
   * a running countdown does not drag this effect along with it.
   */
  useEffect(() => {
    if (status === 'running' && targetTime != null) {
      writeActiveBlock({
        dayIso: dayIso ?? new Date().toISOString().slice(0, 10),
        taskId: selectedTask?.id,
        label,
        totalMinutes: durationMinutes,
        startedAt: startedAtRef.current ?? new Date().toISOString(),
        status: 'running',
        endsAt: targetTime,
        remainingMs: 0,
      })
      return
    }
    if (status === 'paused') {
      writeActiveBlock({
        dayIso: dayIso ?? new Date().toISOString().slice(0, 10),
        taskId: selectedTask?.id,
        label,
        totalMinutes: durationMinutes,
        startedAt: startedAtRef.current ?? new Date().toISOString(),
        status: 'paused',
        endsAt: null,
        remainingMs: pausedRemainingMs,
      })
      return
    }
    // Idle or finished: nothing left to restore. An unanswered away claim is
    // the exception - its record is what keeps the prompt alive across a
    // reload, so it is only cleared once the claim is resolved.
    if (!pendingAwayBlock) clearActiveBlock()
  }, [
    status,
    targetTime,
    pausedRemainingMs,
    label,
    durationMinutes,
    selectedTask?.id,
    dayIso,
    pendingAwayBlock,
  ])

  const confirmAwayBlock = useCallback(() => {
    // Read the claim rather than resolving it inside the updater: StrictMode
    // runs updaters twice, and this one records a session.
    if (!pendingAwayBlock) return
    onAwayBlockConfirmed?.(pendingAwayBlock)
    setPendingAwayBlock(null)
    clearActiveBlock()
  }, [pendingAwayBlock, onAwayBlockConfirmed])

  const discardAwayBlock = useCallback(() => {
    setPendingAwayBlock(null)
    clearActiveBlock()
  }, [])

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
    pendingAwayBlock,
    confirmAwayBlock,
    discardAwayBlock,
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

/** The shape of a timer picked back up from storage. */
interface RestoredTimer {
  status: TimerStatus
  targetTime: number | null
  remainingMs: number
  label?: string
  minutes?: number
  taskId?: string
  startedAt: string | null
  awayBlock: AwayBlock | null
}

const IDLE_TIMER: RestoredTimer = {
  status: 'idle',
  targetTime: null,
  remainingMs: 0,
  startedAt: null,
  awayBlock: null,
}

/**
 * Turn the stored block into the state the timer should mount with.
 *
 * Three outcomes. A block still in flight comes back live against its original
 * landing instant, so walking away mid-block and coming back is seamless. A
 * paused one comes back paused: it was frozen at an unknown moment and measures
 * nothing until you resume it. One that ran out while the app was closed comes
 * back as a claim rather than a session - the clock is evidence the interval
 * passed, not that you spent it working, and only you know which.
 */
function restoreTimer(): RestoredTimer {
  const stored = readActiveBlock()
  if (!stored) return IDLE_TIMER

  const shape = {
    label: stored.label,
    minutes: stored.totalMinutes,
    taskId: stored.taskId,
    startedAt: stored.startedAt,
  }

  if (stored.status === 'running' && stored.endsAt != null && stored.endsAt > Date.now()) {
    return {
      ...shape,
      status: 'running',
      targetTime: stored.endsAt,
      remainingMs: Math.max(0, stored.endsAt - Date.now()),
      awayBlock: null,
    }
  }

  if (stored.status === 'paused') {
    return {
      ...shape,
      status: 'paused',
      targetTime: null,
      remainingMs: stored.remainingMs,
      awayBlock: null,
    }
  }

  const finishedAt = stored.endsAt ?? Date.now()
  if (Date.now() - finishedAt > AWAY_BLOCK_MAX_AGE_MS) {
    // Too long ago for "did you work it?" to have an honest answer - you were
    // asleep, or the tab sat open for two days.
    clearActiveBlock()
    return IDLE_TIMER
  }

  return {
    ...IDLE_TIMER,
    // The stored record deliberately survives until the claim is answered, so a
    // reload cannot throw away an hour of work by losing the prompt.
    awayBlock: {
      dayIso: stored.dayIso,
      taskId: stored.taskId,
      label: stored.label,
      minutes: stored.totalMinutes,
      startedAt: stored.startedAt,
      finishedAt: new Date(finishedAt).toISOString(),
    },
  }
}
