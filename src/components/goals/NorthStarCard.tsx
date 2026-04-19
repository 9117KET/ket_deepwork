/**
 * components/goals/NorthStarCard.tsx
 *
 * Sidebar card showing the user's North Star — the fixed life-direction
 * statement from The ONE Thing framework (Gary Keller).
 *
 * Collapsed by default to a truncated first line. Click to expand/collapse.
 * Click the text to enter inline edit mode (same pattern as HabitChecklist identity statement).
 */

import { useState, useRef } from 'react'

interface NorthStarCardProps {
  northStar: string
  onSetNorthStar: (value: string) => void
}

export function NorthStarCard({ northStar, onSetNorthStar }: NorthStarCardProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [editing, setEditing] = useState(false)
  // draft is initialised from prop when edit mode opens; no useEffect needed
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function startEditing() {
    setDraft(northStar)
    setEditing(true)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(northStar.length, northStar.length)
      }
    }, 0)
  }

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed !== northStar) onSetNorthStar(trimmed)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setEditing(false)
    }
    // Ctrl/Cmd+Enter saves
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave()
  }

  const truncated = northStar.length > 80 ? northStar.slice(0, 80).trimEnd() + '…' : northStar

  return (
    <div className="rounded-lg border border-indigo-900/40 bg-slate-900 p-3 text-xs">
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <span className="text-[10px] leading-none">{collapsed ? '▸' : '▾'}</span>
          North Star
        </button>
        {!collapsed && !editing && (
          <button
            type="button"
            onClick={() => { setCollapsed(false); startEditing() }}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Body */}
      {collapsed ? (
        <button
          type="button"
          className="w-full text-left text-slate-400 hover:text-slate-300 transition-colors leading-relaxed"
          onClick={() => setCollapsed(false)}
          title="Click to expand"
        >
          {northStar ? (
            <span className="italic">{truncated}</span>
          ) : (
            <span className="text-slate-600 italic">Your fixed life direction — click to set...</span>
          )}
        </button>
      ) : editing ? (
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="The fixed direction that guides every decision..."
            className="w-full resize-none rounded border border-indigo-700 bg-slate-950 px-2 py-1.5 text-xs leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <p className="text-[9px] text-slate-600">Ctrl+Enter to save · Esc to cancel</p>
        </div>
      ) : (
        <button
          type="button"
          className="w-full text-left leading-relaxed text-slate-300 hover:text-slate-200 transition-colors italic"
          onClick={startEditing}
          title="Click to edit"
        >
          {northStar || (
            <span className="text-slate-600 not-italic">Your fixed life direction — click to set...</span>
          )}
        </button>
      )}
    </div>
  )
}
