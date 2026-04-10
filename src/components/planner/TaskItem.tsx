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

const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480]

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h${minutes % 60}m`
}

interface TaskItemProps {
  task: Task
  isSubtask?: boolean
  isDragging?: boolean
  showDropAbove?: boolean
  showDropBelow?: boolean
  isDueNow?: boolean
  /** When true, task is part of multi-selection (Ctrl+Click). */
  isSelected?: boolean
  /** Called when user Ctrl/Cmd+clicks the task to toggle selection. */
  onToggleSelect?: () => void
  onToggle: () => void
  onDelete: () => void
  onAddTaskAbove?: () => void
  onAddTaskBelow?: () => void
  onAddSubtask?: () => void
  onUpdateTask?: (patch: { scheduledAt?: string; durationMinutes?: number; title?: string }) => void
  onDragStart?: () => void
  onDragOver?: (position: 'above' | 'below') => void
  onDragLeave?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
  /** Mobile: move this task up within its section. Undefined = already first. */
  onMoveUp?: () => void
  /** Mobile: move this task down within its section. Undefined = already last. */
  onMoveDown?: () => void
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


export function TaskItem({
  task,
  isSubtask = false,
  isDragging = false,
  showDropAbove = false,
  showDropBelow = false,
  isDueNow = false,
  isSelected = false,
  onToggleSelect,
  onToggle,
  onDelete,
  onAddTaskAbove,
  onAddTaskBelow,
  onAddSubtask,
  onUpdateTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: TaskItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const gripRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        gripRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        menuBtnRef.current?.contains(target)
      ) return
      setMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [menu])

  const trimmedTitle = task.title.trim()
  const isUrl = /^https?:\/\/\S+$/i.test(trimmedTitle)
  const textClasses = `text-sm ${
    task.isDone ? 'text-slate-400 line-through decoration-slate-500/60' : 'text-slate-100'
  }`
  const isReorderable = typeof onDragStart === 'function' && typeof onDrop === 'function'
  const canEditTime = typeof onUpdateTask === 'function'
  const showContextMenu = Boolean(
    onUpdateTask ?? onAddTaskAbove ?? onAddTaskBelow ?? onAddSubtask ?? onDelete,
  )

  const handleDragStart = (e: React.DragEvent) => {
    try {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', '')
      }
      onDragStart?.()
    } catch {
      // dataTransfer can be null or throw in some browsers (e.g. Safari, touch, production).
      onDragStart?.()
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!showContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMenuButtonClick = () => {
    if (!showContextMenu) return
    const rect = menuBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setMenu({ x: rect.left, y: rect.bottom + 4 })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isReorderable || !onDragOver) return
    try {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      onDragOver(e.clientY < mid ? 'above' : 'below')
    } catch {
      e.preventDefault()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!isReorderable) return
    try {
      e.preventDefault()
      e.stopPropagation()
      onDrop?.()
    } catch {
      e.preventDefault()
    }
  }

  const closeAnd = (fn: (() => void) | undefined) => {
    setMenu(null)
    fn?.()
  }

  const handleRowClickCapture = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      onToggleSelect?.()
    }
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
        tabIndex={0}
        onClickCapture={handleRowClickCapture}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggleSelect?.()
          }
        }}
        className={`group flex flex-wrap items-center gap-2 py-1.5 ${isDragging ? 'opacity-50' : ''} ${isDueNow ? 'rounded-md border border-amber-500/70 bg-amber-500/10' : ''} ${isSelected ? 'rounded-md bg-sky-500/20 ring-1 ring-sky-500/50' : ''} ${onToggleSelect ? 'cursor-default' : ''}`}
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
            className="hidden cursor-grab touch-none rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 active:cursor-grabbing sm:block"
            aria-label="Drag to reorder; right-click for menu"
          >
            <GripIcon />
          </div>
        ) : null}
        {showContextMenu && (
          <button
            ref={menuBtnRef}
            type="button"
            onClick={handleMenuButtonClick}
            className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Task options"
          >
            ⋮
          </button>
        )}
        {(onMoveUp !== undefined || onMoveDown !== undefined) && (
          <span className="flex shrink-0 items-center sm:hidden">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={onMoveUp === undefined}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:opacity-25"
              aria-label="Move task up"
            >↑</button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={onMoveDown === undefined}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:opacity-25"
              aria-label="Move task down"
            >↓</button>
          </span>
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={task.isDone}
            onChange={onToggle}
            className="h-5 w-5 shrink-0 rounded border-slate-800 bg-slate-900 text-sky-400 focus:ring-sky-500 sm:h-4 sm:w-4"
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
          <span className="flex shrink-0 items-center gap-1">
            <input
              type="time"
              value={task.scheduledAt ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onUpdateTask?.({ scheduledAt: v ? normalizeHhmm(v) : undefined })
              }}
              className="w-[5.5rem] rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs tabular-nums text-slate-300 [color-scheme:dark]"
              title="Scheduled time (24h)"
            />
            <select
              value={task.durationMinutes ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                onUpdateTask?.({ durationMinutes: v })
              }}
              className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs tabular-nums text-slate-300"
              title="Duration (optional)"
            >
              <option value="">—</option>
              {task.durationMinutes != null && !DURATION_OPTIONS.includes(task.durationMinutes) && (
                <option value={task.durationMinutes}>{formatDuration(task.durationMinutes)}</option>
              )}
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>{formatDuration(m)}</option>
              ))}
            </select>
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
          {onAddTaskAbove && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
              onClick={() => closeAnd(onAddTaskAbove)}
            >
              Add task above
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

