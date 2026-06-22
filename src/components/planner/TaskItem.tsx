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
import { ArrowUp, ArrowDown, MoreVertical } from 'lucide-react'

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
  onUpdateTask?: (patch: { scheduledAt?: string; durationMinutes?: number; title?: string; isShallow?: boolean }) => void
  /** Move this task to the not-doing list (global). */
  onMoveToNotDoing?: () => void
  /** Consciously abandon this task (Drucker: abandonment as a success). */
  onAbandon?: () => void
  /** Subtask only: open the parent picker to move to a different parent or promote. */
  onMoveToAnotherParent?: () => void
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
      className="h-4 w-4 shrink-0 text-share-onSurfaceVariant/60"
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
  onMoveToNotDoing,
  onAbandon,
  onMoveToAnotherParent,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: TaskItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const gripRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  // Focus + select the inline title editor when it opens.
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [isEditing])

  const trimmedTitle = task.title.trim()
  const isUrl = /^https?:\/\/\S+$/i.test(trimmedTitle)
  const textClasses = `text-sm ${
    task.isDone ? 'text-share-onSurfaceVariant/60 line-through decoration-share-outlineVariant/60' : 'text-share-onSurface'
  }`
  const isReorderable = typeof onDragStart === 'function' && typeof onDrop === 'function'
  const canEditTime = typeof onUpdateTask === 'function'
  const showContextMenu = Boolean(
    onUpdateTask ?? onAddTaskAbove ?? onAddTaskBelow ?? onAddSubtask ?? onMoveToNotDoing ?? onAbandon ?? onDelete ?? onMoveToAnotherParent,
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

  // Keep the menu inside the viewport: the menu is min-w-[10rem] (160px) and its
  // height grows with the number of items, so clamp against estimated dimensions.
  const clampMenu = (x: number, y: number) => {
    const MENU_WIDTH = 160
    const MENU_HEIGHT = 320
    const PAD = 8
    const maxX = Math.max(PAD, window.innerWidth - MENU_WIDTH - PAD)
    const maxY = Math.max(PAD, window.innerHeight - MENU_HEIGHT - PAD)
    return {
      x: Math.min(Math.max(x, PAD), maxX),
      y: Math.min(Math.max(y, PAD), maxY),
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!showContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    setMenu(clampMenu(e.clientX, e.clientY))
  }

  const handleMenuButtonClick = () => {
    if (!showContextMenu) return
    const rect = menuBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setMenu(clampMenu(rect.left, rect.bottom + 4))
    }
  }

  const startEditing = () => {
    if (!onUpdateTask) return
    setDraftTitle(task.title)
    setIsEditing(true)
  }

  const commitEditing = () => {
    const trimmed = draftTitle.trim()
    if (trimmed !== '' && trimmed !== task.title) {
      onUpdateTask?.({ title: trimmed })
    }
    setIsEditing(false)
  }

  const cancelEditing = () => {
    setDraftTitle(task.title)
    setIsEditing(false)
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
    <div className={`relative ${isSubtask ? 'ml-6 border-l-2 border-share-outlineVariant/40 pl-2' : ''}`}>
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
            className="hidden cursor-grab touch-none rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant active:cursor-grabbing sm:block"
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
            className={`shrink-0 rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant ${isReorderable ? 'sm:hidden' : 'sm:opacity-0 sm:group-hover:opacity-100'}`}
            aria-label="Task options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
        {(onMoveUp !== undefined || onMoveDown !== undefined) && (
          <span className="flex shrink-0 items-center sm:hidden">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={onMoveUp === undefined}
              className="rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant disabled:opacity-25"
              aria-label="Move task up"
            ><ArrowUp className="h-3 w-3" /></button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={onMoveDown === undefined}
              className="rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant disabled:opacity-25"
              aria-label="Move task down"
            ><ArrowDown className="h-3 w-3" /></button>
          </span>
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={task.isDone}
            onChange={onToggle}
            className="h-5 w-5 shrink-0 rounded border-share-outlineVariant/50 bg-share-surfaceContainer text-share-primary focus:ring-share-primary sm:h-4 sm:w-4"
          />
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitEditing()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEditing()
                }
              }}
              onClick={(e) => e.preventDefault()}
              className="min-w-0 flex-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainer px-1.5 py-0.5 text-sm text-share-onSurface focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
              aria-label="Edit task title"
            />
          ) : isUrl ? (
            <a
              href={trimmedTitle}
              target="_blank"
              rel="noreferrer"
              className={`${textClasses} break-words underline decoration-sky-500/60 underline-offset-2 hover:text-sky-300`}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => {
                if (!onUpdateTask) return
                event.preventDefault()
                event.stopPropagation()
                startEditing()
              }}
            >
              {trimmedTitle}
            </a>
          ) : (
            <span
              className={`min-w-0 break-words ${textClasses}`}
              onDoubleClick={onUpdateTask ? () => startEditing() : undefined}
            >
              {task.title}
            </span>
          )}
          {task.isShallow && (
            <span className="ml-0.5 shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-400">
              shallow
            </span>
          )}
        </label>
        {canEditTime && (
          <span className="flex shrink-0 items-center gap-1">
            <div className="relative" title="Scheduled time (24h)">
              <input
                type="time"
                value={task.scheduledAt ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onUpdateTask?.({ scheduledAt: v ? normalizeHhmm(v) : undefined })
                }}
                className={`w-32 rounded border border-share-outlineVariant/40 bg-share-surfaceContainer px-2.5 py-1.5 text-sm tabular-nums [color-scheme:dark] ${task.scheduledAt ? 'text-share-onSurface' : 'text-transparent'}`}
                aria-label="Scheduled time"
              />
              {!task.scheduledAt && (
                <span className="pointer-events-none absolute inset-0 flex items-center px-2.5 text-sm text-share-onSurfaceVariant/50">
                  time
                </span>
              )}
            </div>
            <select
              value={task.durationMinutes ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                onUpdateTask?.({ durationMinutes: v })
              }}
              className="w-24 rounded border border-share-outlineVariant/40 bg-share-surfaceContainer px-1 py-1 text-sm tabular-nums text-share-onSurface"
              aria-label="Task duration"
              title="Duration (optional)"
            >
              <option value="">Duration</option>
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
          className="fixed z-50 min-w-[10rem] rounded-md border border-share-outlineVariant/50 bg-share-surfaceContainerHigh py-1 shadow-xl shadow-black/30"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {onUpdateTask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(startEditing)}
            >
              Edit
            </button>
          )}
          {onUpdateTask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-amber-300 hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(() => onUpdateTask?.({ isShallow: !task.isShallow }))}
            >
              {task.isShallow ? 'Mark as deep work' : 'Mark as shallow'}
            </button>
          )}
          {onAddTaskAbove && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onAddTaskAbove)}
            >
              Add task above
            </button>
          )}
          {onAddTaskBelow && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onAddTaskBelow)}
            >
              Add task below
            </button>
          )}
          {onAddSubtask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onAddSubtask)}
            >
              Add subtask
            </button>
          )}
          {onMoveToNotDoing && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-amber-300 hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onMoveToNotDoing)}
            >
              Move to Not Doing
            </button>
          )}
          {onMoveToAnotherParent && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onMoveToAnotherParent)}
            >
              Move to...
            </button>
          )}
          {onAbandon && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurfaceVariant hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onAbandon)}
            >
              Abandon
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-red-300 hover:bg-share-surfaceContainerHighest"
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

