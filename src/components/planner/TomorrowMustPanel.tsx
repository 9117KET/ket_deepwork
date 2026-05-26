/**
 * components/planner/TomorrowMustPanel.tsx
 *
 * Rendered at the bottom of the Night Routine section.
 * Lets you pre-set tomorrow's 3 MUSTs the night before so they're waiting
 * when you wake up — keeping the MUST block intentional rather than reactive.
 */

import { useState, useRef, useEffect } from 'react'
import type { Task } from '../../domain/types'
import { normalizeHhmm } from '../../domain/dateUtils'
import { Moon, ChevronUp, ChevronDown, X } from 'lucide-react'

const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480]

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h${minutes % 60}m`
}

interface TomorrowMustPanelProps {
  tomorrowDate: string
  tasks: Task[]
  onAdd: (title: string) => void
  onDelete: (taskId: string) => void
  onEdit: (taskId: string, title: string) => void
  onUpdate: (taskId: string, patch: { scheduledAt?: string; durationMinutes?: number }) => void
}

const MAX_MUSTS = 3

export function TomorrowMustPanel({ tomorrowDate, tasks, onAdd, onDelete, onEdit, onUpdate }: TomorrowMustPanelProps) {
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
          <Moon className="h-4 w-4 shrink-0 text-indigo-400" />
          <div>
            <p className="text-xs font-semibold text-indigo-300">
              Set tomorrow's MUSTs
            </p>
            <p className="text-[10px] text-share-onSurfaceVariant/60">
              {tomorrowLabel}, {tasks.length}/{MAX_MUSTS} set
              {allSet ? ' - ready' : noneSet ? ' - not set yet' : ''}
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
                  i < tasks.length ? 'bg-indigo-400' : 'bg-share-outlineVariant/40'
                }`}
              />
            ))}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-share-onSurfaceVariant/60" /> : <ChevronDown className="h-4 w-4 text-share-onSurfaceVariant/60" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {tasks.length === 0 && (
            <p className="text-[11px] italic text-share-onSurfaceVariant/60">
              No MUSTs set for tomorrow yet. Add up to 3 below.
            </p>
          )}

          {tasks.map((task, idx) => (
            <div key={task.id} className="flex flex-wrap items-center gap-2">
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
                  className="min-w-0 flex-1 rounded border border-indigo-500/50 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onBg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(task)}
                  className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs text-share-onSurface hover:bg-share-surfaceContainerHigh"
                  title="Click to edit"
                >
                  {task.title}
                </button>
              )}
              <span className="flex shrink-0 items-center gap-1">
                <div className="relative" title="Scheduled time">
                  <input
                    type="time"
                    value={task.scheduledAt ?? ''}
                    onChange={e => onUpdate(task.id, { scheduledAt: e.target.value ? normalizeHhmm(e.target.value) : undefined })}
                    className={`w-24 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-1 py-0.5 text-xs tabular-nums [color-scheme:dark] ${task.scheduledAt ? 'text-share-onSurface' : 'text-transparent'}`}
                  />
                  {!task.scheduledAt && (
                    <span className="pointer-events-none absolute inset-0 flex items-center px-1 text-xs text-share-onSurfaceVariant/50">time</span>
                  )}
                </div>
                <select
                  value={task.durationMinutes ?? ''}
                  onChange={e => onUpdate(task.id, { durationMinutes: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-16 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-1 py-0.5 text-xs tabular-nums text-share-onSurface"
                  title="Duration"
                >
                  <option value="">dur</option>
                  {DURATION_OPTIONS.map(m => <option key={m} value={m}>{formatDuration(m)}</option>)}
                </select>
              </span>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="shrink-0 rounded p-0.5 text-share-onSurfaceVariant/40 hover:text-red-400"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {tasks.length < MAX_MUSTS && (
            <div className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-[10px] font-bold text-share-onSurfaceVariant/50">
                {tasks.length + 1}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What must get done tomorrow?"
                className="min-w-0 flex-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
