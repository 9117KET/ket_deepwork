/**
 * components/planner/BlockDurationEditor.tsx
 *
 * Pencil-icon button that opens an inline popover for adjusting a single
 * block's duration in 15-minute steps. The adjacent block absorbs the delta.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'

interface BlockDurationEditorProps {
  /** Duration of THIS block (minutes). */
  currentDuration: number
  /** Minimum allowed duration for this block (minutes). */
  minDuration: number
  /** Name of the adjacent block that will absorb the delta (shown in preview). */
  adjacentLabel: string
  /** Duration of the adjacent block -- used to compute its preview value. */
  adjacentDuration: number
  /** Minimum allowed duration for the adjacent block (minutes). */
  adjacentMin: number
  /** Whether shrinking this block would affect sleep instead of an adjacent block. */
  affectsSleep?: boolean
  /** Current sleep minutes (only relevant when affectsSleep=true). */
  sleepMinutes?: number
  onConfirm: (newDurationMinutes: number) => void
}

function formatDur(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function BlockDurationEditor({
  currentDuration,
  minDuration,
  adjacentLabel,
  adjacentDuration,
  adjacentMin,
  affectsSleep = false,
  sleepMinutes = 0,
  onConfirm,
}: BlockDurationEditorProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(currentDuration)
  const containerRef = useRef<HTMLDivElement>(null)


  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setDraft(currentDuration)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, currentDuration])

  const STEP = 15
  const delta = draft - currentDuration

  // How the adjacent block / sleep would look after this change
  const adjacentPreview = affectsSleep
    ? sleepMinutes - delta
    : adjacentDuration - delta

  const adjacentPreviewMin = affectsSleep ? 6 * 60 : adjacentMin
  const canDecrease = draft - STEP >= minDuration
  const canIncrease = affectsSleep
    ? sleepMinutes - STEP >= 6 * 60
    : adjacentDuration - delta - STEP >= adjacentMin

  const sleepWarn = affectsSleep && adjacentPreview < 7 * 60

  const handleConfirm = () => {
    onConfirm(draft)
    setOpen(false)
  }

  const handleCancel = useCallback(() => {
    setDraft(currentDuration)
    setOpen(false)
  }, [currentDuration])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setDraft(currentDuration); setOpen((v) => !v) }}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-400"
        title="Adjust block duration"
      >
        <MaterialIcon name="edit" className="text-sm" />
        Edit
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 w-[min(100vw-2rem,18rem)] min-w-[16rem] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          {/* Current duration stepper */}
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Duration
          </p>
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setDraft((d) => d - STEP)}
              disabled={!canDecrease}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-400 disabled:opacity-30 disabled:pointer-events-none"
            >
              <MaterialIcon name="remove" className="text-base" />
            </button>
            <span className="min-w-[5.5rem] flex-1 text-center font-mono text-xl font-semibold tabular-nums text-slate-100">
              {formatDur(draft)}
            </span>
            <button
              onClick={() => setDraft((d) => d + STEP)}
              disabled={!canIncrease}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-400 disabled:opacity-30 disabled:pointer-events-none"
            >
              <MaterialIcon name="add" className="text-base" />
            </button>
          </div>

          {/* Adjacent block preview */}
          {delta !== 0 && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${sleepWarn ? 'border border-amber-500/30 bg-amber-500/10' : 'bg-slate-800'}`}>
              <span className="text-slate-400">{adjacentLabel} will adjust to </span>
              <span className={`font-semibold ${adjacentPreview < adjacentPreviewMin ? 'text-red-400' : sleepWarn ? 'text-amber-300' : 'text-sky-300'}`}>
                {formatDur(Math.max(0, adjacentPreview))}
              </span>
              {sleepWarn && (
                <p className="mt-1 text-amber-400">
                  Sleep below 7h affects performance. Are you sure?
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={delta === 0}
              className="flex-1 rounded-lg bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 rounded-lg border border-slate-700 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
