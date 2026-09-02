/**
 * The undo offer.
 *
 * Sits above the mobile tab bar rather than over it, because the one thing
 * worse than no undo is an undo you cannot reach. It withdraws itself on a
 * timer and the moment anything else changes the state — see
 * `useUndoableActions` — so this only ever draws a live offer.
 */

import { Undo2, X } from 'lucide-react'
import type { UndoEntry } from '../../hooks/useUndoableActions'

interface UndoToastProps {
  entry: UndoEntry | null
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ entry, onUndo, onDismiss }: UndoToastProps) {
  if (!entry) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 lg:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-[min(100%,26rem)] items-center gap-3 rounded-xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-4 py-2.5 shadow-lg shadow-black/40">
        <span className="min-w-0 flex-1 truncate text-sm text-share-onSurface">{entry.label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="touch-target-coarse flex shrink-0 items-center gap-1.5 rounded-lg border border-share-primary/60 bg-share-primary/15 px-3 py-1.5 text-sm font-semibold text-share-primary transition-colors hover:bg-share-primary/25"
        >
          <Undo2 className="h-4 w-4" />
          Undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="touch-target-coarse flex shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant transition-colors hover:text-share-onBg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
