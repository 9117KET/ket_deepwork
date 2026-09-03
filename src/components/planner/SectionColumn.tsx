/**
 * components/planner/SectionColumn.tsx
 *
 * Renders a single section (e.g. Morning routine, High Priority) with its tasks.
 * Manages drag state for reordering within the section.
 */

import { useState, useEffect, useRef, type ReactNode, useCallback } from 'react'
import type { DeepWorkSession, Task, TaskSection, TaskSectionId } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import { getSectionCollapsed, setSectionCollapsed } from '../../storage/uiPrefs'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  /** When true, this section starts collapsed (user can still expand). */
  defaultCollapsed?: boolean
  /** When true, this section's time block is current (e.g. 5–9 morning, 9–5 focus). */
  isTimeBlockActive?: boolean
  /** Human-readable timeframe label for this section (already adjusted for any global offset). */
  timeframeLabel?: string | null
  /** Short note rendered next to the timeframe label (e.g. "+1h30m Top 3" on the high-priority block). */
  timeframeNote?: string | null
  /** Task currently being dragged (for cross-section drag); used to show drop targets and isDragging. */
  draggedTask?: { sectionId: TaskSectionId; taskId: string } | null
  onDragStart?: (sectionId: TaskSectionId, taskId: string) => void
  onDragEnd?: () => void
  /** Called when a task is dropped in this section at the given insert index (0 = before first task). */
  onDrop?: (insertIndex: number) => void
  onAddTask: (title: string) => void
  onAddTaskAbove?: (beforeTaskId: string) => void
  onAddTaskBelow?: (afterTaskId: string) => void
  onAddSubtask?: (parentTaskId: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onUpdateTask: (
    taskId: string,
    patch: { scheduledAt?: string; durationMinutes?: number; title?: string; isShallow?: boolean },
  ) => void
  taskIdsDueNow: Set<string>
  /** Task ids that are part of multi-selection (Ctrl+Click). */
  selectedTaskIds?: Set<string>
  /** Toggle task in multi-selection. */
  onToggleSelect?: (taskId: string) => void
  /** Optional element rendered in the section header (e.g. Edit schedule button). */
  headerAction?: ReactNode
  /** Mobile reorder: move a root task up within this section. */
  onMoveTaskUp?: (taskId: string) => void
  /** Mobile reorder: move a root task down within this section. */
  onMoveTaskDown?: (taskId: string) => void
  /** Move a task to the global not-doing list. */
  onMoveToNotDoing?: (taskId: string) => void
  /** Consciously abandon a task (Drucker). */
  onAbandonTask?: (taskId: string) => void
  /** Reorder a subtask within its parent (same parent). */
  onReorderSubtask?: (parentId: string, subtaskId: string, insertIndex: number) => void
  /** Open the parent picker for a subtask so the user can move it elsewhere. */
  onRequestMoveSubtask?: (subtaskId: string) => void
  /**
   * Max incomplete root tasks before showing an overload nudge.
   * Undefined = no nudge for this section.
   */
  overloadThreshold?: number
  /** The day's deep work sessions, passed down so each task can fill its progress boxes. */
  deepWorkSessions?: DeepWorkSession[]
  /** Start a focus block on a task. */
  onStartBlock?: (taskId: string, minutes: number) => void
  /** Open the progress actions sheet for a task. */
  onOpenProgressSheet?: (taskId: string) => void
  /** Capacity-aware planned task minutes for this section (Top 3 folded into High). */
  plannedMinutes?: number
  /** Capacity-aware allocated window minutes for this section's time block. */
  windowMinutes?: number
  /**
   * True when auto-sizing deliberately compressed this block to its minimum to make
   * the day fit. Its planned > window is then expected (not an alarm), so the badge
   * reads as a neutral "squeezed" pill rather than amber "over capacity".
   */
  compressed?: boolean
}

type DropPosition = 'above' | 'below'

/** Compact "1h 20m" / "45m" minute formatter for capacity labels. */
function formatBlockMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h <= 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function SectionColumn({
  section,
  tasks,
  defaultCollapsed = false,
  isTimeBlockActive = false,
  timeframeLabel = null,
  timeframeNote = null,
  draggedTask = null,
  onDragStart,
  onDragEnd,
  onDrop,
  onAddTask,
  onAddTaskAbove,
  onAddTaskBelow,
  onAddSubtask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  taskIdsDueNow,
  selectedTaskIds = new Set(),
  onToggleSelect,
  headerAction,
  onMoveTaskUp,
  onMoveTaskDown,
  onMoveToNotDoing,
  onAbandonTask,
  onReorderSubtask,
  onRequestMoveSubtask,
  overloadThreshold,
  plannedMinutes,
  windowMinutes,
  compressed = false,
  deepWorkSessions,
  onStartBlock,
  onOpenProgressSheet,
}: SectionColumnProps) {
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(
    null,
  )
  const [draggedSubtask, setDraggedSubtask] = useState<{ parentId: string; subtaskId: string } | null>(null)
  const draggedSubtaskRef = useRef<{ parentId: string; subtaskId: string } | null>(null)
  const [subtaskDropTarget, setSubtaskDropTarget] = useState<{ subtaskId: string; position: DropPosition } | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    // Active time block always opens the section; otherwise a persisted user
    // choice wins over the static default, falling back to defaultCollapsed.
    if (isTimeBlockActive) return false
    const persisted = getSectionCollapsed(section.id)
    return persisted ?? defaultCollapsed
  })
  const [pendingCollapse, setPendingCollapse] = useState<'done' | 'timeEnd' | null>(null)
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  // Persist the collapse choice (device-local UI pref; never touches AppState
  // / Convex sync). Layers on top of auto-expand-on-active and the prompt.
  const persistCollapsed = useCallback((value: boolean) => {
    setSectionCollapsed(section.id, value)
  }, [section.id])

  const rootTasks = tasks.filter((t) => !t.parentId)
  const incompleteRootCount = rootTasks.filter((t) => !t.isDone).length
  const doneRootCount = rootTasks.filter((t) => t.isDone).length
  const allRootsDone = rootTasks.length > 0 && incompleteRootCount === 0

  // Prompt to collapse when all tasks are done; dismiss if tasks are unchecked
  const prevAllDoneRef = useRef(allRootsDone)
  useEffect(() => {
    if (!prevAllDoneRef.current && allRootsDone) {
      if (!collapsedRef.current) setPendingCollapse('done')
    } else if (prevAllDoneRef.current && !allRootsDone) {
      setPendingCollapse(null)
    }
    prevAllDoneRef.current = allRootsDone
  }, [allRootsDone])

  // Auto-expand when block becomes active; prompt to collapse when block ends
  const prevActiveRef = useRef(isTimeBlockActive)
  useEffect(() => {
    if (!prevActiveRef.current && isTimeBlockActive) {
      setCollapsed(false)
      setPendingCollapse(null)
    } else if (prevActiveRef.current && !isTimeBlockActive) {
      if (!collapsedRef.current) setPendingCollapse('timeEnd')
    }
    prevActiveRef.current = isTimeBlockActive
  }, [isTimeBlockActive])
  const isOverloaded = overloadThreshold !== undefined && incompleteRootCount > overloadThreshold
  // Critical overload: more than 2x the threshold — renders a stronger visual warning
  const isCriticalOverload = overloadThreshold !== undefined && incompleteRootCount > overloadThreshold * 2

  // Capacity highlight: planned task minutes vs the block's allocated window.
  // Amber when the section's work won't fit its window (5-min tolerance).
  const showCapacity =
    plannedMinutes != null && windowMinutes != null && windowMinutes > 0 && plannedMinutes > 0
  const overCapacity = showCapacity && plannedMinutes! > windowMinutes! + 5

  // Dynamic description: live stats shown instead of the static section.description string
  const dynamicDescription = (() => {
    if (rootTasks.length === 0) return section.description ?? null
    const estimatedMinutes = tasks
      .filter((t) => !t.isDone && t.durationMinutes)
      .reduce((sum, t) => sum + (t.durationMinutes ?? 0), 0)
    const parts: string[] = []
    if (doneRootCount > 0) {
      parts.push(`${doneRootCount}/${rootTasks.length} done`)
    } else {
      parts.push(`${rootTasks.length} task${rootTasks.length !== 1 ? 's' : ''}`)
    }
    if (estimatedMinutes > 0) {
      const h = Math.floor(estimatedMinutes / 60)
      const m = estimatedMinutes % 60
      const est = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
      parts.push(`~${est} remaining`)
    }
    return parts.join(' / ')
  })()

  const handleDragStart = (taskId: string) => {
    onDragStart?.(section.id, taskId)
  }
  const handleDragOver = (index: number, position: DropPosition) =>
    setDropTarget({ index, position })
  const handleDragLeave = () => setDropTarget(null)
  const handleDrop = () => {
    if (!dropTarget) return
    const insertIndex = dropTarget.position === 'above' ? dropTarget.index : dropTarget.index + 1
    onDrop?.(insertIndex)
    setDropTarget(null)
  }
  const handleDragEnd = () => {
    setDropTarget(null)
    onDragEnd?.()
  }

  const handleSubtaskDragStart = useCallback((parentId: string, subtaskId: string) => {
    draggedSubtaskRef.current = { parentId, subtaskId }
    setDraggedSubtask({ parentId, subtaskId })
  }, [])

  const handleSubtaskDragOver = useCallback((subtaskId: string, position: DropPosition) => {
    setSubtaskDropTarget({ subtaskId, position })
  }, [])

  const handleSubtaskDragLeave = useCallback(() => setSubtaskDropTarget(null), [])

  const handleSubtaskDrop = useCallback((targetSubtaskId: string) => {
    const payload = draggedSubtaskRef.current ?? draggedSubtask
    if (!payload) return
    const target = subtaskDropTarget
    if (!target) {
      draggedSubtaskRef.current = null
      setDraggedSubtask(null)
      return
    }
    const siblings = tasks.filter(t => t.parentId === payload.parentId)
    const fromIndex = siblings.findIndex(t => t.id === payload.subtaskId)
    const targetIndex = siblings.findIndex(t => t.id === targetSubtaskId)
    if (fromIndex >= 0 && targetIndex >= 0) {
      const insertIndex = target.position === 'above' ? targetIndex : targetIndex + 1
      onReorderSubtask?.(payload.parentId, payload.subtaskId, insertIndex)
    }
    draggedSubtaskRef.current = null
    setDraggedSubtask(null)
    setSubtaskDropTarget(null)
  }, [draggedSubtask, subtaskDropTarget, tasks, onReorderSubtask])

  const handleSubtaskDragEnd = useCallback(() => {
    draggedSubtaskRef.current = null
    setDraggedSubtask(null)
    setSubtaskDropTarget(null)
  }, [])

  return (
    <section
      /*
       * The running block wears the one accent, not amber. Amber means a
       * warning here — over capacity, a missed habit — and a block being the
       * one you are in is not a warning. Critical overload still outranks it:
       * a list too long to execute is the more urgent thing to say.
       */
      className={`rounded-lg border p-3 sm:p-4 ${
        isCriticalOverload
          ? 'border-red-500/50 bg-red-500/5'
          : isTimeBlockActive
          ? 'border-share-primary/50 bg-share-primary/5'
          : 'border-share-outlineVariant/25 bg-share-surfaceContainerLow'
      }`}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            onClick={() => { setCollapsed((c) => { persistCollapsed(!c); return !c }); setPendingCollapse(null) }}
            className="touch-target-coarse -ml-2 mt-0.5 flex shrink-0 items-center justify-center text-share-onSurfaceVariant hover:text-share-onSurface sm:ml-0"
            aria-label={collapsed ? 'Expand section' : 'Collapse section'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-share-onBg">{section.title}</h3>
              {collapsed && tasks.length > 0 && (
                <span className="rounded-full bg-share-outlineVariant/40 px-1.5 py-0.5 text-xs text-share-onSurfaceVariant">
                  {tasks.filter(t => !t.parentId).length} task{tasks.filter(t => !t.parentId).length !== 1 ? 's' : ''}
                </span>
              )}
              {isCriticalOverload ? (
                <span
                  className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
                  title={`${incompleteRootCount} tasks - this list is too long to execute. Cut it now.`}
                >
                  <AlertTriangle className="h-3 w-3" /> {incompleteRootCount} tasks - cut this list
                </span>
              ) : isOverloaded ? (
                <span
                  className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                  title={`${incompleteRootCount} incomplete tasks - trim to stay focused`}
                >
                  <AlertTriangle className="h-3 w-3" /> {incompleteRootCount} tasks
                </span>
              ) : null}
              {overCapacity && compressed && (
                <span
                  className="flex items-center gap-1 rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-teal-300"
                  aria-label={`Squeezed: ${formatBlockMins(plannedMinutes!)} of work fitted into a ${formatBlockMins(windowMinutes!)} window so the day still makes bedtime`}
                  title={`Squeezed to fit: ${formatBlockMins(plannedMinutes!)} of work in a ${formatBlockMins(windowMinutes!)} window so the day still makes bedtime`}
                >
                  squeezed {formatBlockMins(windowMinutes!)}
                </span>
              )}
              {overCapacity && !compressed && (
                <span
                  className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-300"
                  aria-label={`Over capacity: ${formatBlockMins(plannedMinutes!)} of work for a ${formatBlockMins(windowMinutes!)} window. Trim it or the day runs later`}
                  title={`Planned ${formatBlockMins(plannedMinutes!)} of work for a ${formatBlockMins(windowMinutes!)} window. Trim it or the day runs later`}
                >
                  <AlertTriangle className="h-3 w-3" /> {formatBlockMins(plannedMinutes!)} / {formatBlockMins(windowMinutes!)}
                </span>
              )}
            </div>
            {timeframeLabel ? (
              <p className="text-xs text-share-onSurfaceVariant">
                {timeframeLabel}
                {timeframeNote ? (
                  <span className="ml-1 text-teal-400" title="Time reserved for today's Top Three Priorities">
                    {timeframeNote}
                  </span>
                ) : null}
                {dynamicDescription ? ` / ${dynamicDescription}` : null}
              </p>
            ) : dynamicDescription ? (
              <p className="text-xs text-share-onSurfaceVariant/70">{dynamicDescription}</p>
            ) : null}
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </header>
      {!collapsed && pendingCollapse && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 py-1.5 text-xs text-share-onSurface">
          <span>
            {pendingCollapse === 'done' ? 'All tasks done!' : 'Time block ended.'} Collapse this section?
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setPendingCollapse(null)}
              className="rounded px-2 py-0.5 hover:bg-share-surfaceContainerHighest"
            >
              Keep open
            </button>
            <button
              type="button"
              onClick={() => { setCollapsed(true); persistCollapsed(true); setPendingCollapse(null) }}
              className="rounded bg-teal-800/60 px-2 py-0.5 text-teal-200 hover:bg-teal-700/60"
            >
              Collapse
            </button>
          </div>
        </div>
      )}
      {!collapsed && <div className="space-y-1">
        {tasks.length === 0 ? (
          <div
            className={`min-h-[2.5rem] rounded-md border border-dashed ${
              draggedTask && dropTarget !== null
                ? 'border-amber-500/60 bg-amber-500/5'
                : 'border-share-outlineVariant/30 border-transparent'
            } flex items-center justify-center`}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (draggedTask) setDropTarget({ index: 0, position: 'below' })
            }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault()
              onDrop?.(0)
              setDropTarget(null)
            }}
          >
            <p className="text-xs text-share-onSurfaceVariant/60 italic">No tasks yet. Drop a task here.</p>
          </div>
        ) : (() => {
          const roots = tasks.filter((t) => !t.parentId)
          return tasks.map((task, index) => {
            const rootIdx = task.parentId ? -1 : roots.findIndex((r) => r.id === task.id)
            const isParent = tasks.some((t) => t.parentId === task.id)
            return (
              <TaskItem
                key={task.id}
                task={task}
                isSubtask={Boolean(task.parentId)}
                isDragging={
                  task.parentId
                    ? draggedSubtask?.subtaskId === task.id
                    : draggedTask?.sectionId === section.id && draggedTask?.taskId === task.id
                }
                showDropAbove={
                  task.parentId
                    ? subtaskDropTarget?.subtaskId === task.id && subtaskDropTarget.position === 'above'
                    : dropTarget?.index === index && dropTarget?.position === 'above'
                }
                showDropBelow={
                  task.parentId
                    ? subtaskDropTarget?.subtaskId === task.id && subtaskDropTarget.position === 'below'
                    : dropTarget?.index === index && dropTarget?.position === 'below'
                }
                isDueNow={taskIdsDueNow.has(task.id)}
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(task.id) : undefined}
                onToggle={() => onToggleTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onAddTaskAbove={onAddTaskAbove ? () => onAddTaskAbove(task.id) : undefined}
                onAddTaskBelow={onAddTaskBelow ? () => onAddTaskBelow(task.id) : undefined}
                onAddSubtask={!task.parentId && onAddSubtask ? () => onAddSubtask(task.id) : undefined}
                onUpdateTask={(patch) => onUpdateTask(task.id, patch)}
                deepWorkSessions={deepWorkSessions}
                onStartBlock={
                  onStartBlock ? (minutes) => onStartBlock(task.id, minutes) : undefined
                }
                onOpenProgressSheet={
                  onOpenProgressSheet ? () => onOpenProgressSheet(task.id) : undefined
                }
                onDragStart={
                  task.parentId && onReorderSubtask
                    ? () => handleSubtaskDragStart(task.parentId!, task.id)
                    : !task.parentId ? () => handleDragStart(task.id) : undefined
                }
                onDragOver={
                  task.parentId && onReorderSubtask
                    ? (position) => handleSubtaskDragOver(task.id, position)
                    : !task.parentId ? (position) => handleDragOver(index, position) : undefined
                }
                onDragLeave={
                  task.parentId && onReorderSubtask
                    ? handleSubtaskDragLeave
                    : !task.parentId ? handleDragLeave : undefined
                }
                onDrop={
                  task.parentId && onReorderSubtask
                    ? () => handleSubtaskDrop(task.id)
                    : !task.parentId ? handleDrop : undefined
                }
                onDragEnd={
                  task.parentId && onReorderSubtask
                    ? handleSubtaskDragEnd
                    : !task.parentId ? handleDragEnd : undefined
                }
                onMoveUp={onMoveTaskUp && rootIdx > 0 && !isParent ? () => onMoveTaskUp(task.id) : undefined}
                onMoveDown={onMoveTaskDown && rootIdx >= 0 && rootIdx < roots.length - 1 && !isParent ? () => onMoveTaskDown(task.id) : undefined}
                onMoveToNotDoing={!task.parentId && onMoveToNotDoing ? () => onMoveToNotDoing(task.id) : undefined}
                onAbandon={!task.parentId && onAbandonTask ? () => onAbandonTask(task.id) : undefined}
                onMoveToAnotherParent={task.parentId && onRequestMoveSubtask ? () => onRequestMoveSubtask(task.id) : undefined}
              />
            )
          })
        })()}
      </div>}
      {!collapsed && <AddTaskInput placeholder="Add task" onAdd={onAddTask} />}
    </section>
  )
}

