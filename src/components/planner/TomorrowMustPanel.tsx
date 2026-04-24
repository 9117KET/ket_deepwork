/**
 * components/planner/TomorrowMustPanel.tsx
 *
 * Rendered at the bottom of the Night Routine section.
 * Lets you pre-set tomorrow's 3 MUSTs the night before so they're waiting
 * when you wake up — keeping the MUST block intentional rather than reactive.
 */

import { useState, useRef, useEffect } from 'react'
import type { Task } from '../../domain/types'

interface TomorrowMustPanelProps {
  tomorrowDate: string
  tasks: Task[]
  onAdd: (title: string) => void
  onDelete: (taskId: string) => void
  onEdit: (taskId: string, title: string) => void
}

const MAX_MUSTS = 3

export function TomorrowMustPanel({ tomorrowDate, tasks, onAdd, onDelete, onEdit }: TomorrowMustPanelProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [y, m, d] = tomorrowDate.split('-').map(Number)
  const tomorrowLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    .format(new Date(y!, m! - 1, d!))

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleAdd = () => {
    const trimmed = input.trim()
    if (!trimmed || tasks.length >= MAX_MUSTS) return
    onAdd(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') setOpen(false)
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditValue(task.title)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onEdit(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const allSet = tasks.length === MAX_MUSTS
  const noneSet = tasks.length === 0

  return (
    <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🌙</span>
          <div>
            <p className="text-xs font-semibold text-indigo-300">
              Set tomorrow's MUSTs
            </p>
            <p className="text-[10px] text-slate-500">
              {tomorrowLabel} · {tasks.length}/{MAX_MUSTS} set
              {allSet ? ' — ready ✓' : noneSet ? ' — not set yet' : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Pip indicators */}
          <span className="flex gap-1">
            {Array.from({ length: MAX_MUSTS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i < tasks.length ? 'bg-indigo-400' : 'bg-slate-700'
                }`}
              />
            ))}
          </span>
          <span className="text-xs text-slate-500">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {tasks.length === 0 && (
            <p className="text-[11px] italic text-slate-500">
              No MUSTs set for tomorrow yet. Add up to 3 below.
            </p>
          )}

          {tasks.map((task, idx) => (
            <div key={task.id} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-[10px] font-bold text-indigo-400">
                {idx + 1}
              </span>
              {editingId === task.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') { setEditingId(null) }
                  }}
                  className="min-w-0 flex-1 rounded border border-indigo-500/50 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(task)}
                  className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs text-slate-200 hover:bg-slate-800"
                  title="Click to edit"
                >
                  {task.title}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="shrink-0 rounded p-0.5 text-slate-600 hover:text-red-400"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          {tasks.length < MAX_MUSTS && (
            <div className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-[10px] font-bold text-slate-600">
                {tasks.length + 1}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What must get done tomorrow?"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!input.trim()}
                className="shrink-0 rounded border border-indigo-500/40 px-2 py-1 text-xs text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30"
              >
                Add
              </button>
            </div>
          )}

          {allSet && (
            <p className="pt-1 text-[10px] text-indigo-400/70">
              All 3 MUSTs locked in. Sleep well.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
