/**
 * components/planner/MustDoPinnedHeader.tsx
 *
 * The day's Top 3, as a card under the calendar on Today.
 * - While any is open: the three are ranked rows you can tick, edit, schedule
 *   and start a block on.
 * - When ALL are done: the card collapses to a compact "Top 3 complete"
 *   banner that expands to show them.
 *
 * Two row anatomies, chosen by the primary pointer like `TaskItem`:
 *  - a finger: checkbox, rank and title, one chip, ⋮. The ⋮ opens the same
 *    `TaskActionSheet` as the list, so Delete, Hide from partner, Schedule,
 *    Start and Move are all reachable by touch. The progress row is one button
 *    under the title that opens the progress sheet.
 *  - a cursor: the desktop row, unchanged: grip and drag, click-to-edit
 *    title, duration picker, progress chips, hover Eye and Remove.
 */

import { useState } from 'react'
import type { DeepWorkSession, Task, TaskPatch } from '../../domain/types'
import { computeTaskProgress, formatMinutes } from '../../domain/taskProgress'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronUp, ChevronDown, Eye, EyeOff, GripVertical, MoreVertical, X } from 'lucide-react'
import { TaskProgressBar, TaskProgressBoxes } from './TaskProgressBoxes'
import { TaskDurationPicker } from './TaskDurationPicker'
import { ScheduleChip } from './ScheduleChip'
import { TaskActionSheet } from './TaskActionSheet'
import { TouchCheckbox } from './TouchCheckbox'
import { useFocusBlocks } from './focusBlockContext'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'

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
  onUpdate: (taskId: string, patch: TaskPatch) => void
  /** Consciously abandon a MUST (offered in the phone action sheet). */
  onAbandon?: (taskId: string) => void
  /** An accountability challenge is running: offer "hide from partner" on each MUST. */
  partnerVisible?: boolean
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
  /** Open the schedule sheet for a MUST. */
  onSchedule?: (taskId: string) => void
}

const MAX = 3

export function MustDoPinnedHeader({
  tasks,
  onToggle,
  onAdd,
  onDelete,
  onUpdate,
  onAbandon,
  deepWorkSessions,
  onStartBlock,
  onOpenProgressSheet,
  onDragStart,
  onDragEnd,
  onDropAt,
  onMoveUp,
  onMoveDown,
  draggedTaskId,
  onSchedule,
  partnerVisible = false,
}: MustDoPinnedHeaderProps) {
  const { blockMinutes } = useFocusBlocks()
  const isCoarse = useCoarsePointer()

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
  const [input, setInput] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)
  // Open by default: on Today the three are the content, not a pinned summary.
  const [listCollapsed, setListCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** Insert index the drop indicator is currently sitting on. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  /** The MUST whose action sheet is open (phones). */
  const [sheetTaskId, setSheetTaskId] = useState<string | null>(null)
  const sheetTask = rootTasks.find((t) => t.id === sheetTaskId) ?? null

  const commitTitleEdit = (taskId: string) => {
    const trimmed = editingTitle.trim()
    if (trimmed) onUpdate(taskId, { title: trimmed })
    setEditingId(null)
  }

  const startTitleEdit = (task: Task) => {
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const handleAdd = () => {
    const trimmed = input.trim()
    if (!trimmed || rootTasks.length >= MAX) return
    onAdd(trimmed)
    setInput('')
    if (rootTasks.length + 1 >= MAX) setShowAdd(false)
  }

  /** Inline title editor, shared by every row shape. */
  const renderTitleEditor = (task: Task) => (
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
  )

  /**
   * The phone row: checkbox, rank and title, one chip, then ⋮ (or, in the
   * all-done list, a visible Remove). The progress bar sits under the title.
   */
  const renderPhoneRow = (task: Task, idx: number, trailing: 'menu' | 'remove') => {
    const progress = computeTaskProgress(task, deepWorkSessions ?? [], blockMinutes)
    const chipText = task.scheduledAt ?? (task.durationMinutes ? formatMinutes(task.durationMinutes) : null)
    const chipPill = chipText ? (
      <span
        className={`inline-flex h-8 items-center rounded-lg bg-share-hairline px-2 text-xs tabular-nums ${
          task.scheduledAt ? 'text-share-primary' : 'text-share-onSurfaceVariant'
        }`}
      >
        {chipText}
      </span>
    ) : null
    return (
      <div key={task.id} data-task-id={task.id}>
        <div className="group flex items-center gap-1">
          <TouchCheckbox checked={task.isDone} onChange={() => onToggle(task.id)} label={task.title} />
          <div className="flex min-w-0 flex-1 items-center py-1.5">
            {editingId === task.id ? (
              renderTitleEditor(task)
            ) : (
              <span
                className={`line-clamp-2 break-words text-[15px] leading-snug ${
                  task.isDone
                    ? 'text-share-onSurfaceDim line-through decoration-share-outlineVariant/60'
                    : 'text-share-onBg'
                }`}
              >
                {/* inline-block, so a done row's strike-through skips the rank */}
                <span className="mr-1.5 inline-block text-xs font-bold tabular-nums text-share-onSurfaceDim">
                  {idx + 1}
                </span>
                {task.title}
              </span>
            )}
          </div>
          {chipPill &&
            (onSchedule && !task.isDone ? (
              <button
                type="button"
                onClick={() => onSchedule(task.id)}
                className="touch-target inline-flex shrink-0 items-center justify-center"
                aria-label={task.scheduledAt ? `Scheduled at ${task.scheduledAt}. Change` : `${chipText}. Schedule`}
              >
                {chipPill}
              </button>
            ) : (
              <span className="shrink-0">{chipPill}</span>
            ))}
          {trailing === 'menu' ? (
            <button
              type="button"
              onClick={() => setSheetTaskId(task.id)}
              className="touch-target flex shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh"
              aria-label="Task options"
              aria-haspopup="dialog"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="touch-target flex shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant hover:text-red-400"
              aria-label="Remove"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {progress && (
          <div className="pl-11 pr-2">
            <TaskProgressBar
              progress={progress}
              taskId={task.id}
              onOpen={onOpenProgressSheet ? () => onOpenProgressSheet(task.id) : undefined}
            />
          </div>
        )}
      </div>
    )
  }

  const actionSheet = sheetTask && (() => {
    const idx = rootTasks.findIndex((t) => t.id === sheetTask.id)
    const trackable = computeTaskProgress(sheetTask, deepWorkSessions ?? [], blockMinutes) != null
    return (
      <TaskActionSheet
        task={sheetTask}
        onClose={() => setSheetTaskId(null)}
        onEdit={() => startTitleEdit(sheetTask)}
        onSchedule={onSchedule ? () => onSchedule(sheetTask.id) : undefined}
        onOpenProgress={trackable && onOpenProgressSheet ? () => onOpenProgressSheet(sheetTask.id) : undefined}
        showReorder={Boolean(onMoveUp || onMoveDown)}
        onMoveUp={onMoveUp && idx > 0 ? () => onMoveUp(sheetTask.id) : undefined}
        onMoveDown={onMoveDown && idx < rootTasks.length - 1 ? () => onMoveDown(sheetTask.id) : undefined}
        onUpdateTask={(patch) => onUpdate(sheetTask.id, patch)}
        partnerVisible={partnerVisible}
        onAbandon={onAbandon ? () => onAbandon(sheetTask.id) : undefined}
        onDelete={() => onDelete(sheetTask.id)}
      />
    )
  })()

  // ── Collapsed "all done" state ────────────────────────────────────────────
  // Emerald is kept here on purpose: completion is the one place the design
  // README allows it.
  if (allDone) {
    return (
      <div className="mt-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
        {/* Summary row — always visible, click to expand */}
        <button
          type="button"
          onClick={() => setDoneExpanded(o => !o)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left touch:min-h-11"
          aria-expanded={doneExpanded}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Top Three Priorities complete</span>
          <span className="ml-auto flex items-center gap-2 text-xs text-share-onSurfaceVariant">
            {rootTasks.length}/{rootTasks.length} done
            {doneExpanded ? <ChevronUp className="h-3.5 w-3.5 text-emerald-600/70" /> : <ChevronDown className="h-3.5 w-3.5 text-emerald-600/70" />}
          </span>
        </button>

        {/* Expandable task list */}
        {doneExpanded && (
          <div className="border-t border-emerald-500/20 px-3 pb-3 pt-2 space-y-1">
            {isCoarse
              ? rootTasks.map((task, idx) => renderPhoneRow(task, idx, 'remove'))
              : rootTasks.map((task, idx) => (
              <div key={task.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 group">
                <span className="w-4 shrink-0 text-center text-[10px] font-bold text-emerald-700">
                  {idx + 1}
                </span>
                <label className="flex min-w-0 flex-1 basis-[55%] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.isDone}
                    onChange={() => onToggle(task.id)}
                    className="h-4 w-4 shrink-0 rounded border-emerald-700 bg-share-surfaceContainerHigh accent-share-primary text-share-primary focus:ring-share-primary"
                  />
                  {editingId === task.id ? (
                    renderTitleEditor(task)
                  ) : (
                    <span
                      onClick={e => { e.preventDefault(); e.stopPropagation(); startTitleEdit(task) }}
                      className="min-w-0 truncate text-sm cursor-text text-share-onSurfaceVariant/60 line-through decoration-share-outlineVariant/60"
                    >
                      {task.title}
                    </span>
                  )}
                </label>
                <span className="flex shrink-0 items-center gap-1">
                  <TaskDurationPicker
                    value={task.durationMinutes}
                    onChange={minutes => onUpdate(task.id, { durationMinutes: minutes })}
                    className={onSchedule ? "hidden w-[7.5rem] sm:block" : "w-[7.5rem]"}
                  />
                </span>
                {renderProgress(task)}
                {/* Fine pointer only: revealed on hover. Phones get the
                    visible 44px Remove in the row above. */}
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
        {actionSheet}
      </div>
    )
  }

  // ── Active state ──────────────────────────────────────────────────────────
  return (
    <div className="mt-2 rounded-2xl border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-3 py-2">
      {/* Header row — click to collapse/expand task list */}
      <button
        type="button"
        onClick={() => setListCollapsed(c => !c)}
        className="mb-1 flex w-full items-center justify-between gap-2 text-left touch:min-h-11"
        aria-expanded={!listCollapsed}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="overline">Top 3</span>
          {/* Progress pips */}
          <span className="flex gap-1">
            {Array.from({ length: MAX }).map((_, i) => {
              const task = rootTasks[i]
              return (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full transition-colors duration-300 ${
                    task?.isDone ? 'bg-share-primary' : 'bg-share-hairline'
                  }`}
                />
              )
            })}
          </span>
          <span className="text-xs tabular-nums text-share-onSurfaceDim">{donePct}%</span>
        </div>
        <div className="flex items-center gap-2">
          {rootTasks.length < MAX && !showAdd && !listCollapsed && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); setShowAdd(true) }}
              className="touch-target-coarse inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface"
            >
              + Add
            </span>
          )}
          {listCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-share-outlineVariant" /> : <ChevronUp className="h-3.5 w-3.5 text-share-outlineVariant" />}
        </div>
      </button>

      {/* Task rows — hidden when collapsed */}
      {!listCollapsed && isCoarse && (
        <div>{rootTasks.map((task, idx) => renderPhoneRow(task, idx, 'menu'))}</div>
      )}
      {!listCollapsed && !isCoarse && <div
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
              dropIndex === idx ? 'border-t border-share-primary' : dropIndex === idx + 1 ? 'border-b border-share-primary' : 'border-y border-transparent'
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
            <label className="flex min-w-[8rem] flex-1 basis-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={task.isDone}
                onChange={() => onToggle(task.id)}
                className="h-4 w-4 shrink-0 rounded border-share-outlineVariant/40 bg-share-surfaceContainerHigh accent-share-primary text-share-primary focus:ring-share-primary"
              />
              {editingId === task.id ? (
                renderTitleEditor(task)
              ) : (
                <span
                  onClick={e => { e.preventDefault(); e.stopPropagation(); startTitleEdit(task) }}
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
              {onSchedule && !task.isDone && (
                <ScheduleChip scheduledAt={task.scheduledAt} onClick={() => onSchedule(task.id)} />
              )}
              <TaskDurationPicker
                value={task.durationMinutes}
                onChange={minutes => onUpdate(task.id, { durationMinutes: minutes })}
                className={onSchedule ? "hidden w-[7.5rem] sm:block" : "w-[7.5rem]"}
              />
            </span>
            {renderProgress(task)}
            {/* Fine pointer only (this branch never renders under a finger):
                the Eye and Remove below are revealed on hover. Phones reach
                both through the ⋮ action sheet. */}
            {partnerVisible && (
              <button
                type="button"
                onClick={() => onUpdate(task.id, { isPrivate: !task.isPrivate })}
                className={`shrink-0 rounded p-0.5 transition-colors ${
                  task.isPrivate
                    ? 'text-share-onSurfaceVariant hover:text-share-onSurface'
                    : 'text-transparent group-hover:text-share-onSurfaceVariant/50 hover:!text-share-onSurface'
                }`}
                aria-label={task.isPrivate ? 'Show to partner' : 'Hide from partner'}
                title={task.isPrivate ? 'Hidden from your challenge partner — show it' : 'Hide from your challenge partner (counted, never titled)'}
              >
                {task.isPrivate ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
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
      </div>}

      {!listCollapsed && (
        <div className="space-y-1">
          {/* Empty slots */}
          {rootTasks.length === 0 && (
            <p className="text-xs italic text-share-onSurfaceVariant/50 px-1">
              No priorities set. Add up to 3 for today.
            </p>
          )}

          {/* Inline add input */}
          {showAdd && rootTasks.length < MAX && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="w-4 shrink-0 text-center text-xs font-bold text-share-onSurfaceDim">
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
                className="touch-target-coarse shrink-0 rounded border border-share-primary/40 px-2 py-1 text-xs text-share-primary hover:bg-share-primary/10 disabled:opacity-30"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setInput('') }}
                className="touch-target-coarse shrink-0 text-xs text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      {actionSheet}
    </div>
  )
}
