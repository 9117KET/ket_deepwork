/**
 * components/goals/GoalCascadeSection.tsx
 *
 * Collapsible section in the Monthly Tracking Dashboard showing the user's
 * long-horizon goal cascade from The ONE Thing (Gary Keller):
 *   Life → 5 Years → 1 Year → 6 Months → 3 Months
 *
 * Each level is click-to-edit inline.
 */

import { useState, useRef } from 'react'
import type { GoalCascade } from '../../domain/types'

interface GoalCascadeSectionProps {
  goalCascade: GoalCascade | undefined
  onUpdate: (cascade: GoalCascade) => void
}

const LEVELS: { key: keyof GoalCascade; label: string; sublabel: string; accent: string }[] = [
  { key: 'life',        label: 'Life',      sublabel: 'The direction',       accent: 'text-violet-300 bg-violet-500/20' },
  { key: 'fiveYear',    label: '5 Years',   sublabel: 'April 2031',          accent: 'text-indigo-300 bg-indigo-500/20' },
  { key: 'oneYear',     label: '1 Year',    sublabel: 'April 2027',          accent: 'text-blue-300 bg-blue-500/20' },
  { key: 'sixMonths',   label: '6 Months',  sublabel: 'October 2026',        accent: 'text-sky-300 bg-sky-500/20' },
  { key: 'threeMonths', label: '3 Months',  sublabel: 'July 2026',           accent: 'text-teal-300 bg-teal-500/20' },
]

interface CascadeRowProps {
  label: string
  sublabel: string
  accentClass: string
  value: string
  placeholder: string
  onSave: (value: string) => void
}

function CascadeRow({ label, sublabel, accentClass, value, placeholder, onSave }: CascadeRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function startEdit() {
    setDraft(value)
    setEditing(true)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  function save() {
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save()
  }

  return (
    <div className="flex gap-2 py-2 border-t border-slate-800 first:border-t-0 items-start">
      <div className="flex-none w-[70px]">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${accentClass}`}>
          {label}
        </span>
        <div className="mt-0.5 text-[9px] text-slate-600 leading-tight">{sublabel}</div>
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={placeholder}
              className="w-full resize-none rounded border border-violet-700 bg-slate-950 px-2 py-1 text-xs leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
            />
            <p className="text-[9px] text-slate-600">Ctrl+Enter · Esc</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit"
            className="w-full text-left"
          >
            {value ? (
              <span className="text-xs text-slate-300 leading-snug">{value}</span>
            ) : (
              <span className="text-xs text-slate-600 italic">{placeholder}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function GoalCascadeSection({ goalCascade, onUpdate }: GoalCascadeSectionProps) {
  const [collapsed, setCollapsed] = useState(true)
  const cascade = goalCascade ?? {}

  function handleSave(key: keyof GoalCascade, value: string) {
    onUpdate({ ...cascade, [key]: value })
  }

  return (
    <div className="mb-3 rounded border border-violet-900/40 bg-slate-950 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{collapsed ? '▸' : '▾'}</span>
          <span className="text-xs font-semibold text-violet-300">Goal Cascade</span>
          <span className="text-[10px] text-slate-500">Life → 5yr → 1yr → 6mo → 3mo</span>
        </div>
      </button>

      {!collapsed && (
        <div className="mt-2">
          {LEVELS.map(({ key, label, sublabel, accent }) => (
            <CascadeRow
              key={key}
              label={label}
              sublabel={sublabel}
              accentClass={accent}
              value={cascade[key] ?? ''}
              placeholder={`Your ONE thing for ${label.toLowerCase()}...`}
              onSave={(v) => handleSave(key, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
