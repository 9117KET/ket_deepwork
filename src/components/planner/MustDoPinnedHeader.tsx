/**
 * components/planner/MustDoPinnedHeader.tsx
 *
 * Renders the 3 MUST Do tasks as a pinned bar inside the sticky date header.
 * - While any MUST is incomplete: tasks show as interactive checkboxes, always visible.
 * - When ALL are done: collapses to a compact "All MUSTs complete" banner and
 *   becomes a regular (non-sticky) scrollable section below.
 *
 * This keeps your daily intentions visible at all times without needing to scroll
 * back up, and rewards completion with a clean collapse.
 */

import { useState } from 'react'
import type { Task } from '../../domain/types'

interface MustDoPinnedHeaderProps {
  tasks: Task[]
  onToggle: (taskId: string) => void
  onAdd: (title: string) => void
  onDelete: (taskId: string) => void
}

const MAX = 3

export function MustDoPinnedHeader({ tasks, onToggle, onAdd, onDelete }: MustDoPinnedHeaderProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [input, setInput] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)

  const rootTasks = tasks.filter(t => !t.parentId)
  const allDone = rootTasks.length > 0 && rootTasks.every(t => t.isDone)
  const donePct = rootTasks.length === 0 ? 0 : Math.round((rootTasks.filter(t => t.isDone).length / rootTasks.length) * 100)

  const handleAdd = () => {
    const trimmed = input.trim()
    if (!trimmed || rootTasks.length >= MAX) return
    onAdd(trimmed)
    setInput('')
    if (rootTasks.length + 1 >= MAX) setShowAdd(false)
  }

  // ── Collapsed "all done" state ────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10">
        {/* Summary row — always visible, click to expand */}
        <button
          type="button"
          onClick={() => setDoneExpanded(o => !o)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <span className="text-sm">✅</span>
          <span className="text-xs font-medium text-emerald-400">All MUSTs complete</span>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
            {rootTasks.length}/{rootTasks.length} done
            <span className="text-[10px] text-emerald-600/70">{doneExpanded ? '▲' : '▼'}</span>
          </span>
        </button>

        {/* Expandable task list */}
        {doneExpanded && (
          <div className="border-t border-emerald-500/20 px-3 pb-3 pt-2 space-y-1">
            {rootTasks.map((task, idx) => (
              <div key={task.id} className="flex items-center gap-2 group">
                <span className="w-4 shrink-0 text-center text-[10px] font-bold text-emerald-700">
                  {idx + 1}
                </span>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.isDone}
                    onChange={() => onToggle(task.id)}
                    className="h-4 w-4 shrink-0 rounded border-emerald-700 bg-slate-800 text-emerald-400 focus:ring-emerald-500"
                  />
                  <span className="min-w-0 truncate text-sm text-slate-400 line-through decoration-slate-600/60">
                    {task.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="shrink-0 rounded p-0.5 text-transparent group-hover:text-slate-600 hover:!text-red-400 transition-colors"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Active pinned state ───────────────────────────────────────────────────
  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 backdrop-blur-sm">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            3 MUSTs today
          </span>
          {/* Progress pips */}
          <span className="flex gap-1">
            {Array.from({ length: MAX }).map((_, i) => {
              const task = rootTasks[i]
              return (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full transition-colors duration-300 ${
                    !task ? 'bg-slate-800'
                    : task.isDone ? 'bg-emerald-500'
                    : 'bg-sky-500'
                  }`}
                />
              )
            })}
          </span>
          <span className="text-[10px] text-slate-500">{donePct}%</span>
        </div>
        {rootTasks.length < MAX && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            + Add
          </button>
        )}
      </div>

      {/* Task rows */}
      <div className="space-y-1">
        {rootTasks.map((task, idx) => (
          <div key={task.id} className="flex items-center gap-2 group">
            <span className="w-4 shrink-0 text-center text-[10px] font-bold text-slate-600">
              {idx + 1}
            </span>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={task.isDone}
                onChange={() => onToggle(task.id)}
                className="h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-800 text-emerald-400 focus:ring-emerald-500"
              />
              <span className={`min-w-0 truncate text-sm ${
                task.isDone
                  ? 'text-slate-500 line-through decoration-slate-600/60'
                  : 'text-slate-100'
              }`}>
                {task.title}
              </span>
            </label>
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="shrink-0 rounded p-0.5 text-transparent group-hover:text-slate-600 hover:!text-red-400 transition-colors"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Empty slots */}
        {rootTasks.length === 0 && (
          <p className="text-xs italic text-slate-600 px-1">
            No MUSTs set — add up to 3 for today.
          </p>
        )}

        {/* Inline add input */}
        {showAdd && rootTasks.length < MAX && (
          <div className="flex items-center gap-2 pt-0.5">
            <span className="w-4 shrink-0 text-center text-[10px] font-bold text-slate-600">
              {rootTasks.length + 1}
            </span>
            <input
              autoFocus
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') { setShowAdd(false); setInput('') }
              }}
              placeholder="What must get done today?"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!input.trim()}
              className="shrink-0 rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-400 hover:bg-sky-500/10 disabled:opacity-30"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setInput('') }}
              className="shrink-0 text-xs text-slate-600 hover:text-slate-400"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
