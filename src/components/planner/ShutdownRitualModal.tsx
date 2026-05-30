/**
 * components/planner/ShutdownRitualModal.tsx
 *
 * Cal Newport's shutdown ritual (Deep Work, ch. "Work Deeply").
 * Three steps:
 *   1. Day journal entry (note + focus hijacker) — skip if already filled
 *   2. Incomplete task triage — carry to tomorrow or drop
 *   3. Confirm tomorrow's Must-Dos + closing phrase
 *
 * Completing the ritual sets DayState.shutdownCompletedAt.
 */

import { useState, useRef, useCallback } from 'react'
import type { Task, FocusHijacker } from '../../domain/types'
import { CheckCircle, ArrowRight, Trash2, Calendar } from 'lucide-react'

const HIJACKER_OPTIONS: { value: FocusHijacker; label: string }[] = [
  { value: 'none', label: 'None — day went as planned' },
  { value: 'meetings', label: 'Meetings / calls' },
  { value: 'shallow', label: 'Shallow work / admin' },
  { value: 'distraction', label: 'Distractions / social' },
  { value: 'personal', label: 'Personal matters' },
  { value: 'rest', label: 'Rest / low energy' },
]

interface ShutdownRitualModalProps {
  /** Incomplete tasks from today (non-Must-Do, non-done). */
  incompleteTasks: Task[]
  /** Tomorrow's Must-Do tasks already set. */
  tomorrowMustDos: Task[]
  /** Today's current journal state. */
  dayNote: string | undefined
  focusHijacker: FocusHijacker | undefined
  /** Today's deep work minutes. */
  deepWorkMinutesToday: number
  /** Today's habit completion fraction (0–1). */
  habitFraction: number
  onSaveJournal: (note: string, hijacker: FocusHijacker) => void
  onCarryTask: (task: Task) => void
  onDropTask: (task: Task) => void
  onComplete: () => void
  onClose: () => void
}

type Step = 'journal' | 'triage' | 'close'

export function ShutdownRitualModal({
  incompleteTasks,
  tomorrowMustDos,
  dayNote,
  focusHijacker,
  deepWorkMinutesToday,
  habitFraction,
  onSaveJournal,
  onCarryTask,
  onDropTask,
  onComplete,
  onClose,
}: ShutdownRitualModalProps) {
  const [step, setStep] = useState<Step>('journal')
  const [note, setNote] = useState(dayNote ?? '')
  const [hijacker, setHijacker] = useState<FocusHijacker>(focusHijacker ?? 'none')
  const [triaged, setTriaged] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dwhLabel = (() => {
    const h = Math.floor(deepWorkMinutesToday / 60)
    const m = deepWorkMinutesToday % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return m > 0 ? `${m}m` : '0 min'
  })()

  const pendingTriage = incompleteTasks.filter(t => !triaged.has(t.id))

  function handleCarry(task: Task) {
    onCarryTask(task)
    setTriaged(prev => new Set([...prev, task.id]))
  }

  function handleDrop(task: Task) {
    onDropTask(task)
    setTriaged(prev => new Set([...prev, task.id]))
  }

  const handleNoteChange = useCallback((value: string) => {
    setNote(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSaveJournal(value, hijacker), 400)
  }, [hijacker, onSaveJournal])

  const handleHijackerChange = useCallback((value: FocusHijacker) => {
    setHijacker(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSaveJournal(note, value), 400)
  }, [note, onSaveJournal])

  function nextStep() {
    onSaveJournal(note, hijacker)
    setStep(step === 'journal' ? 'triage' : 'close')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-share-onSurfaceVariant/50">
              {step === 'journal' ? '1 of 3' : step === 'triage' ? '2 of 3' : '3 of 3'}
            </p>
            <h3 className="text-sm font-semibold text-share-onBg">
              {step === 'journal' && 'How did today actually go?'}
              {step === 'triage' && 'Incomplete tasks — decide now'}
              {step === 'close' && 'Shutdown complete ✓'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHighest hover:text-share-onBg"
          >
            Close
          </button>
        </div>

        {/* Step 1: Journal */}
        {step === 'journal' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-share-onSurfaceVariant">
                What actually happened vs. the plan?
              </label>
              <textarea
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                rows={3}
                placeholder="Deep work strong / got pulled off track by... / ONE Thing protected..."
                className="w-full resize-none rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-xs leading-relaxed text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-share-onSurfaceVariant">
                What most hijacked your focus block?
              </label>
              <select
                value={hijacker}
                onChange={e => handleHijackerChange(e.target.value as FocusHijacker)}
                className="w-full rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
              >
                {HIJACKER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={nextStep}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-share-primary/60 bg-share-primary/10 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step 2: Task triage */}
        {step === 'triage' && (
          <div className="space-y-3">
            {pendingTriage.length === 0 ? (
              <p className="text-center text-xs text-share-onSurfaceVariant py-4">
                All tasks are either done or triaged. ✓
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {pendingTriage.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 rounded border border-share-outlineVariant/30 bg-share-surfaceContainerLow p-2"
                  >
                    <p className="flex-1 text-xs text-share-onSurface leading-snug">{task.title}</p>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => handleCarry(task)}
                        title="Carry to tomorrow"
                        className="flex items-center gap-0.5 rounded border border-sky-700/50 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/20"
                      >
                        <Calendar className="h-2.5 w-2.5" /> Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDrop(task)}
                        title="Drop it"
                        className="flex items-center gap-0.5 rounded border border-red-700/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-2.5 w-2.5" /> Drop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tomorrowMustDos.length > 0 && (
              <div className="rounded border border-share-outlineVariant/20 bg-share-surfaceContainerLow px-3 py-2">
                <p className="mb-1 text-[10px] font-medium text-share-onSurfaceVariant">Tomorrow's Must-Dos</p>
                {tomorrowMustDos.map(t => (
                  <p key={t.id} className="text-xs text-share-onSurface">• {t.title}</p>
                ))}
              </div>
            )}
            {tomorrowMustDos.length === 0 && (
              <p className="text-[10px] text-amber-300/80 italic">
                ⚠ No Must-Dos set for tomorrow yet — add them in the planner before shutting down.
              </p>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-share-primary/60 bg-share-primary/10 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step 3: Closing */}
        {step === 'close' && (
          <div className="space-y-4 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-400" />

            <div className="space-y-1">
              <p className="text-sm font-semibold text-share-onBg">Work is done for today.</p>
              <p className="text-xs text-share-onSurfaceVariant italic">
                "Shutdown complete."
              </p>
            </div>

            {/* Today's summary */}
            <div className="flex justify-center gap-4 rounded border border-share-outlineVariant/20 bg-share-surfaceContainerLow px-4 py-2 text-xs">
              <div className="text-center">
                <p className="font-semibold text-teal-300">{dwhLabel}</p>
                <p className="text-share-onSurfaceVariant/60">deep work</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-sky-300">{Math.round(habitFraction * 100)}%</p>
                <p className="text-share-onSurfaceVariant/60">habits</p>
              </div>
            </div>

            <p className="text-[10px] text-share-onSurfaceVariant/50">
              Cal Newport: The shutdown ritual signals to your brain that work is truly done — preventing the cognitive residue that bleeds into rest.
            </p>

            <button
              type="button"
              onClick={() => { onComplete(); onClose() }}
              className="w-full rounded border border-emerald-600 bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              Close the day ✓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
