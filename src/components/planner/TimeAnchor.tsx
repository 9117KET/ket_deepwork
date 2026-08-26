/**
 * components/planner/TimeAnchor.tsx
 *
 * The opt-in clock time on a task.
 *
 * Most tasks do not want one. The day's sections already say when work happens,
 * so a per-task time duplicates that schedule and, by mid-morning, turns the
 * plan into a list of things you are late for. What a task owns instead is a
 * duration - a cost, which stays true whatever time it is.
 *
 * A minority of tasks genuinely have an externally fixed time: a lecture, a
 * flight, a call someone else booked. Those are commitments rather than
 * estimates, and this is where they live. Anchored tasks keep everything that
 * depends on a clock time - the due-now nudges, conflict detection, and the
 * push to Google Calendar - while unanchored tasks stay out of all of it.
 */

import { Clock } from 'lucide-react'
import { normalizeHhmm } from '../../domain/dateUtils'

interface TimeAnchorProps {
  value?: string
  onChange: (next: string | undefined) => void
  /** Editing is owned by the parent so a menu item elsewhere can open it. */
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
  /**
   * Show a quiet button for adding an anchor when there is none. Surfaces with
   * a task menu leave this off and offer it there instead.
   */
  showAddButton?: boolean
  size?: 'sm' | 'md'
}

export function TimeAnchor({
  value,
  onChange,
  isEditing,
  onEditingChange,
  showAddButton = false,
  size = 'sm',
}: TimeAnchorProps) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm'

  if (isEditing) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <input
          type="time"
          autoFocus
          value={value ?? ''}
          onChange={(event) => {
            const next = event.target.value
            onChange(next ? normalizeHhmm(next) : undefined)
          }}
          onBlur={() => onEditingChange(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault()
              onEditingChange(false)
            }
          }}
          aria-label="Anchor this task to a time"
          className={`w-[5.5rem] rounded border border-sky-500/50 bg-share-surfaceContainer px-1.5 py-1 tabular-nums text-share-onSurface [color-scheme:dark] ${text}`}
        />
        <button
          type="button"
          // Mouse down, not click: the input's blur would close the editor first.
          onMouseDown={(event) => {
            event.preventDefault()
            onChange(undefined)
            onEditingChange(false)
          }}
          aria-label="Remove time anchor"
          title="Remove time anchor"
          className="shrink-0 rounded px-1 py-0.5 text-xs text-share-onSurfaceVariant/60 hover:bg-share-surfaceContainerHigh hover:text-red-400"
        >
          ✕
        </button>
      </span>
    )
  }

  if (value) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onEditingChange(true)
        }}
        title="Fixed time - click to change"
        className={`flex shrink-0 items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 tabular-nums text-sky-300 hover:bg-sky-500/20 ${text}`}
      >
        <Clock className="h-3 w-3 shrink-0" />
        {value}
      </button>
    )
  }

  if (!showAddButton) return null

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onEditingChange(true)
      }}
      aria-label="Anchor to a time"
      title="Anchor to a time"
      className="shrink-0 rounded p-1 text-share-onSurfaceVariant/40 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant sm:opacity-0 sm:group-hover:opacity-100"
    >
      <Clock className="h-3.5 w-3.5" />
    </button>
  )
}
