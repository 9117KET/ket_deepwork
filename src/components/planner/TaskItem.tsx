/**
 * components/planner/TaskItem.tsx
 *
 * Single task row with checkbox, optional drag handle for reorder.
 * Right-click on grip opens context menu: Edit, Add task below, Add subtask, Delete.
 * Delete is only via this menu (no ✕ button) to avoid accidental removal.
 */

import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../domain/types'
import { normalizeHhmm } from '../../domain/dateUtils'

const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]

interface TaskItemProps {
  task: Task
  isSubtask?: boolean
  isDragging?: boolean
  showDropAbove?: boolean
  showDropBelow?: boolean
  isDueNow?: boolean
  onToggle: () => void
  onDelete: () => void
  onAddTaskBelow?: () => void
  onAddSubtask?: () => void
  onUpdateTask?: (patch: { scheduledAt?: string; durationMinutes?: number; title?: string }) => void
  onDragStart?: () => void
  onDragOver?: (position: 'above' | 'below') => void
  onDragLeave?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}

function GripIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-slate-500"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  )
}

/** French/24h time: 1 PM = 13, 2 PM = 14, etc. Always shows 00–23 for hour. */
function Time24({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const [h, m] = (value ?? '').split(':').map((n) => parseInt(n, 10))
  const hour = Number.isInteger(h) && h >= 0 && h <= 23 ? h : null
  const minute = Number.isInteger(m) && m >= 0 && m <= 59 ? m : 0

  const setTime = (newH: number | null, newM: number) => {
    if (newH == null) {
      onChange(undefined)
      return
    }
    onChange(normalizeHhmm(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`))
  }

  return (
    <span className="flex items-center gap-0.5">
      <select
        value={hour ?? ''}
        onChange={(e) => setTime(e.target.value === '' ? null : Number(e.target.value), minute)}
        className="w-11 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
        title="Heure (24h)"
      >
        <option value="">—</option>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-slate-500">h</span>
      <select
        value={minute}
        onChange={(e) => setTime(hour, Number(e.target.value))}
        className="w-11 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
        title="Minute"
      >
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
    </span>
  )
}

export function TaskItem({
  task,
  isSubtask = false,
  isDragging = false,
  showDropAbove = false,
  showDropBelow = false,
  isDueNow = false,
  onToggle,
  onDelete,
  onAddTaskBelow,
  onAddSubtask,
  onUpdateTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: TaskItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const gripRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (gripRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const trimmedTitle = task.title.trim()
  const isUrl = /^https?:\/\/\S+$/i.test(trimmedTitle)
  const textClasses = `text-sm ${
    task.isDone ? 'text-slate-400 line-through decoration-slate-500/60' : 'text-slate-100'
  }`
  const isReorderable = typeof onDragStart === 'function' && typeof onDrop === 'function'
  const canEditTime = typeof onUpdateTask === 'function'
  const showContextMenu = Boolean(
    onUpdateTask ?? onAddTaskBelow ?? onAddSubtask ?? onDelete,
  )

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
    onDragStart?.()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!showContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isReorderable || !onDragOver) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    onDragOver(e.clientY < mid ? 'above' : 'below')
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!isReorderable) return
    e.preventDefault()
    onDrop?.()
  }

  const closeAnd = (fn: (() => void) | undefined) => {
    setMenu(null)
    fn?.()
  }

  return (
    <div className={`relative ${isSubtask ? 'pl-6' : ''}`}>
      {showDropAbove && (
        <div
          className="absolute left-0 right-0 top-0 h-0.5 rounded-full bg-sky-500"
          aria-hidden
        />
      )}
      <div
        className={`flex flex-wrap items-center gap-2 py-1.5 ${isDragging ? 'opacity-50' : ''} ${isDueNow ? 'rounded-md border border-amber-500/70 bg-amber-500/10' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        {isReorderable ? (
          <div
            ref={gripRef}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            onContextMenu={handleContextMenu}
            className="cursor-grab touch-none rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 active:cursor-grabbing"
            aria-label="Drag to reorder; right-click for menu"
          >
            <GripIcon />
          </div>
        ) : null}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={task.isDone}
            onChange={onToggle}
            className="h-4 w-4 shrink-0 rounded border-slate-800 bg-slate-900 text-sky-400 focus:ring-sky-500"
          />
          {isUrl ? (
            <a
              href={trimmedTitle}
              target="_blank"
              rel="noreferrer"
              className={`${textClasses} break-words underline decoration-sky-500/60 underline-offset-2 hover:text-sky-300`}
              onClick={(event) => event.stopPropagation()}
            >
              {trimmedTitle}
            </a>
          ) : (
            <span className={`min-w-0 break-words ${textClasses}`}>{task.title}</span>
          )}
        </label>
        {canEditTime && (
          <span className="flex shrink-0 items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <span className="sr-only">Heure (24h, ex. 13h00 = 1 PM)</span>
              <Time24
                value={task.scheduledAt}
                onChange={(v) => onUpdateTask?.({ scheduledAt: v })}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <span className="sr-only">Duration (minutes)</span>
              <select
                value={task.durationMinutes ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  onUpdateTask?.({ durationMinutes: v })
                }}
                className="w-14 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
                title="Duration (minutes)"
              >
                <option value="">—</option>
                {task.durationMinutes != null &&
                  !DURATION_OPTIONS.includes(task.durationMinutes) && (
                    <option value={task.durationMinutes}>{task.durationMinutes}m</option>
                  )}
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}m
                  </option>
                ))}
              </select>
            </label>
          </span>
        )}
      </div>
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[10rem] rounded-md border border-slate-700 bg-slate-800 py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {onUpdateTask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
              onClick={() => {
                const newTitle = window.prompt('Edit task title:', task.title)
                if (newTitle != null && newTitle.trim() !== '') {
                  closeAnd(() => onUpdateTask?.({ title: newTitle.trim() }))
                } else {
                  setMenu(null)
                }
              }}
            >
              Edit
            </button>
          )}
          {onAddTaskBelow && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
              onClick={() => closeAnd(onAddTaskBelow)}
            >
              Add task below
            </button>
          )}
          {onAddSubtask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
              onClick={() => closeAnd(onAddSubtask)}
            >
              Add subtask
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-red-300 hover:bg-slate-700"
              onClick={() => closeAnd(onDelete)}
            >
              Delete
            </button>
          )}
        </div>
      )}
      {showDropBelow && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-sky-500"
          aria-hidden
        />
      )}
    </div>
  )
}

