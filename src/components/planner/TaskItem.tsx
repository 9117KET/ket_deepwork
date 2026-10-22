/**
 * components/planner/TaskItem.tsx
 *
 * Single task row with checkbox, optional drag handle for reorder.
 * Right-click on grip opens context menu: Edit, Add task below, Add subtask, Delete.
 * Delete is only via this menu (no ✕ button) to avoid accidental removal.
 *
 * Two anatomies, chosen by the primary pointer rather than the width:
 *  - a finger (`useCoarsePointer`): checkbox, title, one chip, ⋮. The ⋮ opens
 *    `TaskActionSheet`, which holds every other action, and the progress row is
 *    one button under the title that opens the progress sheet. Nothing depends
 *    on hover, right-click, double-tap or drag, none of which a phone has.
 *  - a cursor: the desktop row, unchanged: grip, popup menu, inline duration
 *    picker, progress chips, drag-and-drop.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DeepWorkSession, Task, TaskPatch } from '../../domain/types'
import { computeTaskProgress, formatMinutes } from '../../domain/taskProgress'
import { ArrowUp, ArrowDown, MoreVertical } from 'lucide-react'
import { TaskProgressBar, TaskProgressBoxes } from './TaskProgressBoxes'
import { TaskDurationPicker } from './TaskDurationPicker'
import { ScheduleChip } from './ScheduleChip'
import { TaskActionSheet } from './TaskActionSheet'
import { TouchCheckbox } from './TouchCheckbox'
import { useFocusBlocks } from './focusBlockContext'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'

interface TaskItemProps {
  task: Task
  isSubtask?: boolean
  isDragging?: boolean
  showDropAbove?: boolean
  showDropBelow?: boolean
  onToggle: () => void
  onDelete: () => void
  onAddTaskAbove?: () => void
  onAddTaskBelow?: () => void
  onAddSubtask?: () => void
  onUpdateTask?: (patch: TaskPatch) => void
  /** An accountability challenge is running: offer "hide from partner" in the menu. */
  partnerVisible?: boolean
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
  /** The day's deep work sessions, used to fill this task's progress boxes. */
  deepWorkSessions?: DeepWorkSession[]
  /** Start a focus block on this task. Omitted where no timer is in reach. */
  onStartBlock?: (minutes: number) => void
  /** Open the progress actions sheet (hand-logging and undo). */
  onOpenProgressSheet?: () => void
  /** Open the schedule sheet: put this task on the calendar. */
  onSchedule?: () => void
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
  onToggle,
  onDelete,
  onAddTaskAbove,
  onAddTaskBelow,
  onAddSubtask,
  onUpdateTask,
  onAbandon,
  onMoveToAnotherParent,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  deepWorkSessions,
  onStartBlock,
  onOpenProgressSheet,
  onSchedule,
  partnerVisible = false,
}: TaskItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isCoarse = useCoarsePointer()
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

  // Done tasks keep their row - it is the record of what the work actually
  // cost, which is the only way the next estimate gets better.
  const { blockMinutes } = useFocusBlocks()
  const progress = useMemo(
    () => computeTaskProgress(task, deepWorkSessions ?? [], blockMinutes),
    [task, deepWorkSessions, blockMinutes],
  )
  const showContextMenu = Boolean(
    onUpdateTask ?? onAddTaskAbove ?? onAddTaskBelow ?? onAddSubtask ?? onAbandon ?? onDelete ?? onMoveToAnotherParent,
  )

  const handleDragStart = (e: React.DragEvent) => {
    // The whole row is draggable, but a drag must NOT start when the gesture
    // begins on an interactive control — let the checkbox, time/duration pickers,
    // inline editor, links, and the menu button behave normally. The grip is a
    // role="button" <div> (not matched here), so it still initiates a drag.
    const target = e.target as HTMLElement | null
    if (target?.closest('input, select, textarea, button, a')) {
      e.preventDefault()
      return
    }
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

  const badgeSize = isCoarse ? 'text-[11px]' : 'text-[10px]'
  const badges = (
    <>
      {task.isShallow && (
        <span className={`ml-0.5 shrink-0 rounded border border-share-tertiary/40 bg-share-tertiary/10 px-1 py-0.5 ${badgeSize} text-share-tertiary`}>
          shallow
        </span>
      )}
      {task.isPrivate && partnerVisible && (
        <span
          className={`ml-0.5 shrink-0 rounded border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-1 py-0.5 ${badgeSize} text-share-onSurfaceVariant`}
          title="Hidden from your challenge partner (counted, never titled)"
        >
          private
        </span>
      )}
    </>
  )

  const editInput = (
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
  )

  // ── Phone: checkbox, title, one chip, ⋮ ─────────────────────────────────
  if (isCoarse) {
    const chipText = task.scheduledAt ?? (task.durationMinutes ? formatMinutes(task.durationMinutes) : null)
    const chipOpensSchedule = Boolean(onSchedule) && !isSubtask && !task.isDone
    const chipPill = chipText ? (
      <span
        className={`inline-flex h-8 items-center rounded-lg bg-share-hairline px-2 text-xs tabular-nums ${
          task.scheduledAt ? 'text-share-primary' : 'text-share-onSurfaceVariant'
        }`}
      >
        {chipText}
      </span>
    ) : null
    const titleTone = task.isDone
      ? 'text-share-onSurfaceDim line-through decoration-share-outlineVariant/60'
      : 'text-share-onSurface'

    return (
      <div data-task-id={task.id} className={isSubtask ? 'ml-6 border-l-2 border-share-hairline pl-1' : ''}>
        <div className="group flex items-center gap-1">
          <TouchCheckbox checked={task.isDone} onChange={onToggle} label={task.title} />
          {/* Tapping the title opens the action sheet: the title is the
              biggest thing on the row, and the sheet shows it in full. */}
          {!isEditing && !isUrl && showContextMenu ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary"
            >
              <span className={`line-clamp-2 break-words text-[15px] leading-snug ${titleTone}`}>{task.title}</span>
              {(task.isShallow || (task.isPrivate && partnerVisible)) && (
                <span className="mt-0.5 flex items-center gap-1">{badges}</span>
              )}
            </button>
          ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-center py-1.5">
            {isEditing ? (
              editInput
            ) : isUrl ? (
              <a
                href={trimmedTitle}
                target="_blank"
                rel="noreferrer"
                className={`line-clamp-2 flex min-h-11 items-center break-all text-[15px] leading-snug underline decoration-share-primary/60 underline-offset-2 ${titleTone}`}
              >
                {trimmedTitle}
              </a>
            ) : (
              <span className={`line-clamp-2 break-words text-[15px] leading-snug ${titleTone}`}>{task.title}</span>
            )}
            {(task.isShallow || (task.isPrivate && partnerVisible)) && (
              <span className="mt-0.5 flex items-center gap-1">{badges}</span>
            )}
          </div>
          )}
          {chipPill &&
            (chipOpensSchedule ? (
              <button
                type="button"
                onClick={onSchedule}
                className="touch-target inline-flex shrink-0 items-center justify-center"
                aria-label={task.scheduledAt ? `Scheduled at ${task.scheduledAt}. Change` : `${chipText}. Schedule`}
              >
                {chipPill}
              </button>
            ) : (
              <span className="shrink-0">{chipPill}</span>
            ))}
          {showContextMenu && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="touch-target flex shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh"
              aria-label="Task options"
              aria-haspopup="dialog"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          )}
        </div>
        {progress && (
          <div className="pl-11 pr-2">
            <TaskProgressBar progress={progress} taskId={task.id} onOpen={onOpenProgressSheet} />
          </div>
        )}
        {sheetOpen && (
          <TaskActionSheet
            task={task}
            onClose={() => setSheetOpen(false)}
            onEdit={onUpdateTask ? startEditing : undefined}
            onSchedule={onSchedule && !isSubtask ? onSchedule : undefined}
            // A subtask is never scheduled, but its length is still set in
            // the schedule sheet ("Save length only").
            onSetDuration={onSchedule && isSubtask ? onSchedule : undefined}
            onOpenProgress={progress ? onOpenProgressSheet : undefined}
            showReorder={!isSubtask && (onMoveUp !== undefined || onMoveDown !== undefined)}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onAddSubtask={isSubtask ? undefined : onAddSubtask}
            onMoveToAnotherParent={isSubtask ? onMoveToAnotherParent : undefined}
            onUpdateTask={onUpdateTask}
            partnerVisible={partnerVisible}
            onAbandon={onAbandon}
            onDelete={onDelete}
          />
        )}
      </div>
    )
  }

  // ── Desktop (fine pointer): grip, popup menu, chips, drag ────────────────
  return (
    <div className={`relative ${isSubtask ? 'ml-6 border-l-2 border-share-hairline pl-2' : ''}`}>
      {showDropAbove && (
        <div
          className="absolute left-0 right-0 top-0 h-0.5 rounded-full bg-share-primary"
          aria-hidden
        />
      )}
      <div
        tabIndex={0}
        draggable={isReorderable}
        onDragStart={isReorderable ? handleDragStart : undefined}
        onDragEnd={isReorderable ? onDragEnd : undefined}
        className={`group flex flex-wrap items-center gap-2 py-1.5 ${isReorderable ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        {isReorderable ? (
          <div
            ref={gripRef}
            role="button"
            tabIndex={0}
            onContextMenu={handleContextMenu}
            className="hidden shrink-0 touch-none rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant sm:block"
            aria-label="Drag to reorder; right-click for menu"
          >
            <GripIcon />
          </div>
        ) : null}
        {/* Fine pointer only (this branch never renders under a finger): the
            hover reveal below needs a cursor to work. */}
        {showContextMenu && (
          <button
            ref={menuBtnRef}
            type="button"
            onClick={handleMenuButtonClick}
            className={`touch-target-coarse flex shrink-0 items-center justify-center rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant ${isReorderable ? 'sm:hidden' : 'sm:opacity-0 sm:group-hover:opacity-100'}`}
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
        {/* A hard min-width gives the title a floor to stand on: with `flex-1`
            alone it once shrank to a character per line ("Revie / w pull").
            basis-0 lets it share the line with the schedule chip, and the row
            still wraps below 8rem. */}
        <label className="flex min-w-[8rem] flex-1 basis-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={task.isDone}
            onChange={onToggle}
            className="h-5 w-5 shrink-0 rounded border-share-outlineVariant/50 bg-share-surfaceContainer text-share-primary focus:ring-share-primary sm:h-4 sm:w-4"
          />
          {isEditing ? (
            editInput
          ) : isUrl ? (
            <a
              href={trimmedTitle}
              target="_blank"
              rel="noreferrer"
              className={`${textClasses} break-words underline decoration-share-primary/60 underline-offset-2 hover:text-share-primary`}
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
          {badges}
        </label>
        {canEditTime && (
          <span className="flex shrink-0 items-center gap-1">
            {onSchedule && !isSubtask && !task.isDone && (
              <ScheduleChip scheduledAt={task.scheduledAt} onClick={onSchedule} />
            )}
            <TaskDurationPicker
              value={task.durationMinutes}
              onChange={(minutes) => onUpdateTask?.({ durationMinutes: minutes })}
              className={onSchedule && !isSubtask ? "hidden w-[7.5rem] sm:block" : "w-[7.5rem]"}
            />
          </span>
        )}
        {progress && (
          <TaskProgressBoxes
            progress={progress}
            taskId={task.id}
            onStartBlock={onStartBlock}
            onOpenActions={onOpenProgressSheet}
          />
        )}
      </div>
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-[10rem] rounded-md border border-share-outlineVariant/50 bg-share-surfaceContainerHigh py-1 shadow-xl shadow-black/30"
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
              className="w-full px-3 py-1.5 text-left text-sm text-share-tertiary hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(() => onUpdateTask?.({ isShallow: !task.isShallow }))}
            >
              {task.isShallow ? 'Mark as deep work' : 'Mark as shallow'}
            </button>
          )}
          {onUpdateTask && partnerVisible && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(() => onUpdateTask?.({ isPrivate: !task.isPrivate }))}
              title="Only the challenge partner's view is affected"
            >
              {task.isPrivate ? 'Show to partner' : 'Hide from partner'}
            </button>
          )}
          {onSchedule && !isSubtask && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-sm text-share-onSurface hover:bg-share-surfaceContainerHighest"
              onClick={() => closeAnd(onSchedule)}
            >
              {task.scheduledAt ? 'Reschedule…' : 'Schedule…'}
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
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-share-primary"
          aria-hidden
        />
      )}
    </div>
  )
}

