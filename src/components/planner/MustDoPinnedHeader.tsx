/**
 * components/planner/MustDoPinnedHeader.tsx
 *
 * Renders the day's top 3 tasks as a pinned bar inside the sticky date header.
 * - While any is incomplete: tasks show as interactive checkboxes, always visible.
 * - When ALL are done: collapses to a compact "Top 3 complete" banner and
 *   becomes a regular (non-sticky) scrollable section below.
 *
 * This keeps your daily intentions visible at all times without needing to scroll
 * back up, and rewards completion with a clean collapse.
 */

import { useState } from 'react'
import type { DeepWorkSession, Task } from '../../domain/types'
import { computeTaskProgress } from '../../domain/taskProgress'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronUp, ChevronDown, GripVertical, X } from 'lucide-react'
import { TaskProgressBoxes } from './TaskProgressBoxes'
import { TaskDurationPicker } from './TaskDurationPicker'
import { TimeAnchor } from './TimeAnchor'
import { useFocusBlocks } from './focusBlockContext'

interface MustDoPinnedHeaderProps {
  tasks: Task[]
  /** The day's deep work sessions, used to fill each MUST's progress boxes. */
  deepWorkSessions?: DeepWorkSession[]
  /** Start a focus block on a MUST. */
  onStartBlock?: (taskId: string, minutes: number) => void
  /** Open the progress actions sheet for a MUST. */
  onOpenProgressSheet?: (taskId: string) => void
  onToggle: (taskId: string) => void
  onAdd: (title: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, patch: { scheduledAt?: string; durationMinutes?: number; title?: string }) => void
  /** Reorder: the three are ranked, so first really means first. */
  onDragStart?: (taskId: string) => void
  onDragEnd?: () => void
  /** Drop the dragged MUST at this index among the three. */
  onDropAt?: (insertIndex: number) => void
  /** Touch fallback for the drag handle (drag events never fire on a phone). */
  onMoveUp?: (taskId: string) => void
  onMoveDown?: (taskId: string) => void
  /** Id of the MUST currently being dragged, if any. */
  draggedTaskId?: string | null
}

const MAX = 3

export function MustDoPinnedHeader({
  tasks,
  onToggle,
  onAdd,
  onDelete,
  onUpdate,
  deepWorkSessions,
  onStartBlock,
  onOpenProgressSheet,
  onDragStart,
  onDragEnd,
  onDropAt,
  onMoveUp,
  onMoveDown,
  draggedTaskId,
}: MustDoPinnedHeaderProps) {
  const { blockMinutes } = useFocusBlocks()

  const canReorder = typeof onDragStart === 'function' && typeof onDropAt === 'function'

  /** Start a drag, unless the gesture began on a control that owns the pointer. */
  const handleRowDragStart = (taskId: string) => (e: React.DragEvent) => {
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
    } catch {
      // dataTransfer is null or throws in some browsers; the drag still works.
    }
    onDragStart?.(taskId)
  }

  /** Half-height hit test: above the midpoint inserts before this row, below after. */
  const handleRowDragOver = (idx: number) => (e: React.DragEvent) => {
    if (!canReorder) return
    e.preventDefault()
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    } catch {
      // ignore
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1)
  }

  const handleRowDrop = (e: React.DragEvent) => {
    if (!canReorder) return
    e.preventDefault()
    e.stopPropagation()
    if (dropIndex !== null) onDropAt?.(dropIndex)
    setDropIndex(null)
    onDragEnd?.()
  }

  const handleRowDragEnd = () => {
    setDropIndex(null)
    onDragEnd?.()
  }

  /** The progress row for a MUST, or null when it is too short to track. */
  const renderProgress = (task: Task) => {
    const progress = computeTaskProgress(task, deepWorkSessions ?? [], blockMinutes)
    if (!progress) return null
    return (
      <TaskProgressBoxes
        progress={progress}
        taskId={task.id}
        onStartBlock={onStartBlock ? (minutes) => onStartBlock(task.id, minutes) : undefined}
        onOpenActions={onOpenProgressSheet ? () => onOpenProgressSheet(task.id) : undefined}
      />
    )
  }

  const rootTasks = tasks.filter(t => !t.parentId)
  const allDone = rootTasks.length > 0 && rootTasks.every(t => t.isDone)
  const donePct = rootTasks.length === 0 ? 0 : Math.round((rootTasks.filter(t => t.isDone).length / rootTasks.length) * 100)

  const [showAdd, setShowAdd] = useState(false)
  /** MUST whose time anchor is being edited, if any. */
  const [timeEditTaskId, setTimeEditTaskId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)
  // Collapses when all 3 slots are filled; user can re-expand by clicking the header row.
  // Triggered in handleAdd (not useEffect) to satisfy react-hooks/set-state-in-effect.
  const [listCollapsed, setListCollapsed] = useState(() => rootTasks.length >= MAX)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** Insert index the drop indicator is currently sitting on. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const commitTitleEdit = (taskId: string) => {
    const trimmed = editingTitle.trim()
    if (trimmed) onUpdate(taskId, { title: trimmed })
    setEditingId(null)
  }

  const handleAdd = () => {
    const trimmed = input.trim()
    if (!trimmed || rootTasks.length >= MAX) return
    onAdd(trimmed)
    setInput('')
    if (rootTasks.length + 1 >= MAX) {
      setShowAdd(false)
      setListCollapsed(true)
    }
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
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Top Three Priorities complete</span>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-share-onSurfaceVariant/60">
            {rootTasks.length}/{rootTasks.length} done
            {doneExpanded ? <ChevronUp className="h-3.5 w-3.5 text-emerald-600/70" /> : <ChevronDown className="h-3.5 w-3.5 text-emerald-600/70" />}
          </span>
        </button>

        {/* Expandable task list */}
        {doneExpanded && (
          <div className="border-t border-emerald-500/20 px-3 pb-3 pt-2 space-y-1">
            {rootTasks.map((task, idx) => (
              <div key={task.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 group">
                <span className="w-4 shrink-0 text-center text-[10px] font-bold text-emerald-700">
                  {idx + 1}
                </span>
                <label className="flex min-w-0 flex-1 basis-[55%] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.isDone}
                    onChange={() => onToggle(task.id)}
                    className="h-4 w-4 shrink-0 rounded border-emerald-700 bg-share-surfaceContainerHigh text-emerald-400 focus:ring-emerald-500"
                  />
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => commitTitleEdit(task.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitTitleEdit(task.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="min-w-0 flex-1 rounded border border-share-primary bg-share-surfaceContainerHigh px-1 py-0.5 text-sm text-share-onBg focus:outline-none focus:ring-1 focus:ring-share-primary"
                    />
                  ) : (
                    <span
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setEditingId(task.id); setEditingTitle(task.title) }}
                      className="min-w-0 truncate text-sm cursor-text text-share-onSurfaceVariant/60 line-through decoration-share-outlineVariant/60"
                    >
                      {task.title}
                    </span>
                  )}
                </label>
                <span className="flex shrink-0 items-center gap-1">
                  <TimeAnchor
                    value={task.scheduledAt}
                    onChange={next => onUpdate(task.id, { scheduledAt: next })}
                    isEditing={timeEditTaskId === task.id}
                    onEditingChange={editing => setTimeEditTaskId(editing ? task.id : null)}
                    showAddButton
                    size="md"
                  />
                  <TaskDurationPicker
                    value={task.durationMinutes}
                    onChange={minutes => onUpdate(task.id, { durationMinutes: minutes })}
                    className="w-[7.5rem]"
                  />
                </span>
                {renderProgress(task)}
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="shrink-0 rounded p-0.5 text-transparent group-hover:text-share-outlineVariant hover:!text-red-400 transition-colors"
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
    <div className="mt-2 rounded-lg border border-share-outlineVariant/30 bg-share-surfaceContainerLow/95 px-3 py-2 backdrop-blur-sm">
      {/* Header row — click to collapse/expand task list */}
      <button
        type="button"
        onClick={() => setListCollapsed(c => !c)}
        className="mb-1 flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-share-onSurfaceVariant">
            Your Top Three Priorities for today
          </span>
          {/* Progress pips */}
          <span className="flex gap-1">
            {Array.from({ length: MAX }).map((_, i) => {
              const task = rootTasks[i]
              return (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full transition-colors duration-300 ${
                    !task ? 'bg-share-outlineVariant/40'
                    : task.isDone ? 'bg-emerald-500'
                    : 'bg-sky-500'
                  }`}
                />
              )
            })}
          </span>
          <span className="text-[10px] text-share-onSurfaceVariant/60">{donePct}%</span>
        </div>
        <div className="flex items-center gap-2">
          {rootTasks.length < MAX && !showAdd && !listCollapsed && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); setShowAdd(true) }}
              className="touch-target-coarse inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] text-share-onSurfaceVariant/60 hover:bg-share-surfaceContainerHigh hover:text-share-onSurface"
            >
              + Add
            </span>
          )}
          {listCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-share-outlineVariant" /> : <ChevronUp className="h-3.5 w-3.5 text-share-outlineVariant" />}
        </div>
      </button>

      {/* Task rows — hidden when collapsed */}
      {!listCollapsed && <div
        className="space-y-1"
        onDragLeave={canReorder ? () => setDropIndex(null) : undefined}
      >
        {rootTasks.map((task, idx) => (
          <div
            key={task.id}
            draggable={canReorder ? true : undefined}
            onDragStart={canReorder ? handleRowDragStart(task.id) : undefined}
            onDragOver={canReorder ? handleRowDragOver(idx) : undefined}
            onDrop={canReorder ? handleRowDrop : undefined}
            onDragEnd={canReorder ? handleRowDragEnd : undefined}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 group ${
              canReorder ? 'cursor-grab active:cursor-grabbing' : ''
            } ${draggedTaskId === task.id ? 'opacity-50' : ''} ${
              dropIndex === idx ? 'border-t border-sky-400' : dropIndex === idx + 1 ? 'border-b border-sky-400' : 'border-y border-transparent'
            }`}
          >
            {canReorder && (
              <span
                aria-hidden="true"
                className="hidden shrink-0 touch-none text-share-onSurfaceVariant/40 sm:block"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            )}
            {(onMoveUp || onMoveDown) && (
              <span className="flex shrink-0 items-center sm:hidden">
                <button
                  type="button"
                  onClick={() => onMoveUp?.(task.id)}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant disabled:opacity-25"
                  aria-label={`Move "${task.title}" up`}
                ><ArrowUp className="h-3 w-3" /></button>
                <button
                  type="button"
                  onClick={() => onMoveDown?.(task.id)}
                  disabled={idx === rootTasks.length - 1}
                  className="rounded p-0.5 text-share-onSurfaceVariant/50 hover:bg-share-surfaceContainerHigh hover:text-share-onSurfaceVariant disabled:opacity-25"
                  aria-label={`Move "${task.title}" down`}
                ><ArrowDown className="h-3 w-3" /></button>
              </span>
            )}
            <span className="w-4 shrink-0 text-center text-[10px] font-bold text-share-onSurfaceVariant/50">
              {idx + 1}
            </span>
            <label className="flex min-w-0 flex-1 basis-[55%] cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={task.isDone}
                onChange={() => onToggle(task.id)}
                className="h-4 w-4 shrink-0 rounded border-share-outlineVariant/40 bg-share-surfaceContainerHigh text-emerald-400 focus:ring-emerald-500"
              />
              {editingId === task.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  onBlur={() => commitTitleEdit(task.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitTitleEdit(task.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="min-w-0 flex-1 rounded border border-sky-500 bg-share-surfaceContainerHigh px-1 py-0.5 text-sm text-share-onBg focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              ) : (
                <span
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setEditingId(task.id); setEditingTitle(task.title) }}
                  className={`min-w-0 truncate text-sm cursor-text ${
                    task.isDone
                      ? 'text-share-onSurfaceVariant/60 line-through decoration-share-outlineVariant/60'
                      : 'text-share-onBg'
                  }`}
                >
                  {task.title}
                </span>
              )}
            </label>
            <span className="flex shrink-0 items-center gap-1">
              <TimeAnchor
                  value={task.scheduledAt}
                  onChange={next => onUpdate(task.id, { scheduledAt: next })}
                  isEditing={timeEditTaskId === task.id}
                  onEditingChange={editing => setTimeEditTaskId(editing ? task.id : null)}
                  showAddButton
                  size="md"
                />
              <TaskDurationPicker
                value={task.durationMinutes}
                onChange={minutes => onUpdate(task.id, { durationMinutes: minutes })}
                className="w-[7.5rem]"
              />
            </span>
            {renderProgress(task)}
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="shrink-0 rounded p-0.5 text-transparent group-hover:text-share-onSurfaceVariant/50 hover:!text-red-400 transition-colors"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Empty slots */}
        {rootTasks.length === 0 && (
          <p className="text-xs italic text-share-onSurfaceVariant/50 px-1">
            No priorities set. Add up to 3 for today.
          </p>
        )}

        {/* Inline add input */}
        {showAdd && rootTasks.length < MAX && (
          <div className="flex items-center gap-2 pt-0.5">
            <span className="w-4 shrink-0 text-center text-[10px] font-bold text-share-onSurfaceVariant/50">
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
              placeholder="Add a top priority for today…"
              className="min-w-0 flex-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
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
              className="shrink-0 text-xs text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant"
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>
        )}
      </div>}
    </div>
  )
}
