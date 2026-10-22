/**
 * components/planner/TaskActionSheet.tsx
 *
 * Everything you can do to a task, on a phone.
 *
 * A phone row carries a checkbox, a title, one chip and a ⋮. Every other
 * action lives here, as a thumb-sized row with a label, because a phone has
 * no hover to reveal a control, no right-click to open a menu and no drag to
 * reorder. The header repeats the title in full, so a row whose title was
 * clamped to two lines can always be read.
 *
 * The sheet only offers what its caller passes: an action without a callback
 * is not shown, and Move up / Move down are shown but disabled at the ends.
 * Delete goes through the caller's own delete, which is the undoable one.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarClock,
  Clock,
  CornerUpRight,
  Eye,
  EyeOff,
  Layers,
  ListPlus,
  Pencil,
  Timer,
  Trash2,
} from 'lucide-react'
import type { Task, TaskPatch } from '../../domain/types'

interface TaskActionSheetProps {
  task: Task
  onClose: () => void
  /** Edit the title in place on the row. */
  onEdit?: () => void
  /** Open the schedule sheet (which on phones also carries the duration). */
  onSchedule?: () => void
  /** Subtasks: open the schedule sheet only to set how long the task takes. */
  onSetDuration?: () => void
  /** Open the progress sheet. Pass only for a task big enough to track. */
  onOpenProgress?: () => void
  /** Show Move up / Move down. Each is disabled when its callback is missing. */
  showReorder?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** Root tasks only. */
  onAddSubtask?: () => void
  /** Subtasks only: open the parent picker. */
  onMoveToAnotherParent?: () => void
  /** Shallow / deep, and partner visibility. */
  onUpdateTask?: (patch: TaskPatch) => void
  /** An accountability challenge is running: offer hiding the task from the partner. */
  partnerVisible?: boolean
  onAbandon?: () => void
  /** The caller's undoable delete. */
  onDelete?: () => void
}

interface Action {
  key: string
  label: string
  icon: React.ReactNode
  run?: () => void
  tone?: 'danger' | 'quiet'
}

const ICON = 'h-5 w-5 shrink-0'

export function TaskActionSheet({
  task,
  onClose,
  onEdit,
  onSchedule,
  onSetDuration,
  onOpenProgress,
  showReorder = false,
  onMoveUp,
  onMoveDown,
  onAddSubtask,
  onMoveToAnotherParent,
  onUpdateTask,
  partnerVisible = false,
  onAbandon,
  onDelete,
}: TaskActionSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus moves into the sheet, so a keyboard or screen reader lands on it.
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const actions: Action[] = []
  if (onEdit) actions.push({ key: 'edit', label: 'Edit title', icon: <Pencil className={ICON} />, run: onEdit })
  if (onSchedule) {
    actions.push({
      key: 'schedule',
      label: task.scheduledAt ? 'Reschedule…' : 'Schedule…',
      icon: <CalendarClock className={ICON} />,
      run: onSchedule,
    })
  }
  if (onSetDuration) {
    actions.push({ key: 'duration', label: 'Set duration…', icon: <Clock className={ICON} />, run: onSetDuration })
  }
  if (onOpenProgress) {
    actions.push({ key: 'progress', label: 'Start a block / Log time', icon: <Timer className={ICON} />, run: onOpenProgress })
  }
  if (showReorder) {
    actions.push({ key: 'up', label: 'Move up', icon: <ArrowUp className={ICON} />, run: onMoveUp })
    actions.push({ key: 'down', label: 'Move down', icon: <ArrowDown className={ICON} />, run: onMoveDown })
  }
  if (onAddSubtask) actions.push({ key: 'subtask', label: 'Add subtask', icon: <ListPlus className={ICON} />, run: onAddSubtask })
  if (onMoveToAnotherParent) {
    actions.push({
      key: 'reparent',
      label: 'Move to another parent',
      icon: <CornerUpRight className={ICON} />,
      run: onMoveToAnotherParent,
    })
  }
  if (onUpdateTask) {
    actions.push({
      key: 'shallow',
      label: task.isShallow ? 'Mark as deep work' : 'Mark as shallow',
      icon: <Layers className={ICON} />,
      run: () => onUpdateTask({ isShallow: !task.isShallow }),
    })
    if (partnerVisible) {
      actions.push({
        key: 'private',
        label: task.isPrivate ? 'Show to partner' : 'Hide from partner',
        icon: task.isPrivate ? <Eye className={ICON} /> : <EyeOff className={ICON} />,
        run: () => onUpdateTask({ isPrivate: !task.isPrivate }),
      })
    }
  }
  if (onAbandon) actions.push({ key: 'abandon', label: 'Abandon', icon: <Ban className={ICON} />, run: onAbandon, tone: 'quiet' })
  if (onDelete) actions.push({ key: 'delete', label: 'Delete', icon: <Trash2 className={ICON} />, run: onDelete, tone: 'danger' })

  const sheet = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-action-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 pt-3 pb-safe-nav shadow-2xl focus:outline-none sm:rounded-2xl sm:pb-3"
        data-testid="task-action-sheet"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-share-outlineVariant/50 sm:hidden" aria-hidden />
        <div className="px-2">
          <p className="overline">Task</p>
          {/* In full: the row may have clamped it to two lines. */}
          <h2
            id="task-action-sheet-title"
            className="mt-1 break-words font-shareHeadline text-[17px] font-bold leading-snug text-share-onBg"
          >
            {task.title}
          </h2>
        </div>

        <div role="menu" aria-label="Task actions" className="mt-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={!action.run}
              onClick={() => {
                if (!action.run) return
                // Close first: several actions open another sheet in its place.
                onClose()
                action.run()
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] transition-colors hover:bg-share-surfaceContainerHighest disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                action.tone === 'danger'
                  ? 'text-red-400'
                  : action.tone === 'quiet'
                    ? 'text-share-onSurfaceVariant'
                    : 'text-share-onSurface'
              }`}
            >
              <span className={action.tone === 'danger' ? 'text-red-400' : 'text-share-onSurfaceVariant'}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Portalled: a parent with a backdrop filter (the Top 3 card) would otherwise
  // become the containing block of this fixed layer and clip it.
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body)
}
