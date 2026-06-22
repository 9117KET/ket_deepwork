/**
 * components/planner/DayJournalCard.tsx
 *
 * Time-block journal — end-of-day reflection card (Cal Newport time-block
 * journaling + Laura Vanderkam "168 Hours" actual vs. planned tracking).
 *
 * Hybrid: a free-text note ("what actually happened vs. the plan") plus a
 * focus-hijacker dropdown ("what most disrupted the deep work block").
 * Answers autosave on change. Collapsible.
 */

import { useState, useRef, useCallback } from 'react'
import type { FocusHijacker } from '../../domain/types'
import { BookOpen } from 'lucide-react'

const HIJACKER_OPTIONS: { value: FocusHijacker; label: string }[] = [
  { value: 'none', label: 'None. Day went as planned' },
  { value: 'meetings', label: 'Meetings / calls' },
  { value: 'shallow', label: 'Shallow work / admin' },
  { value: 'distraction', label: 'Distractions / social' },
  { value: 'personal', label: 'Personal matters' },
  { value: 'rest', label: 'Rest / low energy' },
]

interface DayJournalCardProps {
  dayNote: string | undefined
  focusHijacker: FocusHijacker | undefined
  onSaveNote: (note: string) => void
  onSaveHijacker: (hijacker: FocusHijacker) => void
}

export function DayJournalCard({
  dayNote,
  focusHijacker,
  onSaveNote,
  onSaveHijacker,
}: DayJournalCardProps) {
  const [collapsed, setCollapsed] = useState(!dayNote && !focusHijacker)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNoteChange = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onSaveNote(value), 400)
    },
    [onSaveNote],
  )

  const hasSomething = Boolean(dayNote || (focusHijacker && focusHijacker !== 'none'))

  return (
    <div className="mt-3 rounded border border-share-outlineVariant/30 bg-share-surfaceContainerLow p-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-share-onSurfaceVariant/60" />
        <span className="flex-1 text-xs font-medium text-share-onSurface">
          Day journal
        </span>
        {hasSomething && collapsed && (
          <span className="rounded-full bg-share-surfaceContainerHigh px-1.5 py-0.5 text-[9px] text-share-onSurfaceVariant/70">
            ✓ logged
          </span>
        )}
        <span className="text-[10px] text-share-onSurfaceVariant/40">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-share-onSurfaceVariant">
              What actually happened vs. the plan today?
            </label>
            <textarea
              defaultValue={dayNote ?? ''}
              onChange={e => handleNoteChange(e.target.value)}
              rows={3}
              placeholder="Deep work was strong / got pulled into calls / focused well on the ONE Thing..."
              className="w-full resize-none rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-xs leading-relaxed text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-share-onSurfaceVariant">
              What most hijacked your High Priority / deep work block?
            </label>
            <select
              value={focusHijacker ?? 'none'}
              onChange={e => onSaveHijacker(e.target.value as FocusHijacker)}
              className="w-full rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
            >
              {HIJACKER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <p className="text-[9px] text-share-onSurfaceVariant/40 italic">
            Cal Newport: "Track not just what you planned, but what actually happened. The gap is where the insight lives."
          </p>
        </div>
      )}
    </div>
  )
}
