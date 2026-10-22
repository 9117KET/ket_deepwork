/**
 * components/planner/SectionColumn.tsx
 *
 * One list of tasks with its add field: reorder by drag (or arrows on touch),
 * subtasks, progress boxes, and the schedule chip. Time lives in the calendar
 * now, so the list no longer carries a block window, a capacity badge or a
 * "time block ended" prompt — only a nudge when it grows too long to finish.
 */

import { useState, useRef, useCallback } from 'react'
import type { DeepWorkSession, Task, TaskPatch, TaskSection, TaskSectionId } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import { getSectionCollapsed, setSectionCollapsed } from '../../storage/uiPrefs'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  /** When true, this section starts collapsed (user can still expand). */
  defaultCollapsed?: boolean
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
  onUpdateTask: (taskId: string, patch: TaskPatch) => void
  /** An accountability challenge is running: offer "hide from partner" on each task. */
  partnerVisible?: boolean
  /** Mobile reorder: move a root task up within this section. */
  onMoveTaskUp?: (taskId: string) => void
  /** Mobile reorder: move a root task down within this section. */
  onMoveTaskDown?: (taskId: string) => void
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
  /** Open the schedule sheet for a task. */
  onScheduleTask?: (taskId: string) => void
  /** Placeholder for the add field. */
  addPlaceholder?: string
}

type DropPosition = 'above' | 'below'

export function SectionColumn({
  section,
  tasks,
  defaultCollapsed = false,
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
  onMoveTaskUp,
  onMoveTaskDown,
  onAbandonTask,
  onReorderSubtask,
  onRequestMoveSubtask,
  overloadThreshold,
  deepWorkSessions,
  onStartBlock,
  onOpenProgressSheet,
  onScheduleTask,
  addPlaceholder = 'Add task',
  partnerVisible = false,
}: SectionColumnProps) {
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(
    null,
  )
  const [draggedSubtask, setDraggedSubtask] = useState<{ parentId: string; subtaskId: string } | null>(null)
  const draggedSubtaskRef = useRef<{ parentId: string; subtaskId: string } | null>(null)
  const [subtaskDropTarget, setSubtaskDropTarget] = useState<{ subtaskId: string; position: DropPosition } | null>(null)
  // A persisted user choice wins over the static default.
  const [collapsed, setCollapsed] = useState(() => getSectionCollapsed(section.id) ?? defaultCollapsed)

  const rootTasks = tasks.filter((t) => !t.parentId)
  const incompleteRootCount = rootTasks.filter((t) => !t.isDone).length
  const doneRootCount = rootTasks.filter((t) => t.isDone).length
  const isOverloaded = overloadThreshold !== undefined && incompleteRootCount > overloadThreshold

  const summary = (() => {
    if (rootTasks.length === 0) return null
    const estimatedMinutes = tasks
      .filter((t) => !t.isDone && t.durationMinutes)
      .reduce((sum, t) => sum + (t.durationMinutes ?? 0), 0)
    const parts = [
      doneRootCount > 0
        ? `${doneRootCount}/${rootTasks.length} done`
        : `${rootTasks.length} task${rootTasks.length !== 1 ? 's' : ''}`,
    ]
    if (estimatedMinutes > 0) {
      const h = Math.floor(estimatedMinutes / 60)
      const m = estimatedMinutes % 60
      parts.push(`~${h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`} left`)
    }
    return parts.join(' · ')
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
    <section className="rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainerLow p-3 sm:p-4">
      {/* One 44px-tall target: the button is stretched under the whole header,
          and the text on top lets taps fall through to it. The heading stays
          outside the button so it keeps its own name ("Tasks"). */}
      <header className="relative mb-1 flex min-h-11 items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => { setSectionCollapsed(section.id, !c); return !c })}
          className="absolute inset-0 flex w-full items-center rounded-lg text-share-onSurfaceVariant hover:text-share-onSurface focus:outline-none focus-visible:ring-1 focus-visible:ring-share-primary"
          aria-label={collapsed ? 'Expand section' : 'Collapse section'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <h3 className="pointer-events-none relative pl-6 text-[15px] font-semibold text-share-onBg">{section.title}</h3>
        {summary && <span className="pointer-events-none relative text-xs text-share-onSurfaceDim">{summary}</span>}
        {isOverloaded && (
          <span
            className="pointer-events-none relative ml-auto flex items-center gap-1 rounded bg-share-tertiary/15 px-1.5 py-0.5 text-[11px] font-medium text-share-tertiary"
            title={`${incompleteRootCount} incomplete tasks - trim to stay focused`}
          >
            <AlertTriangle className="h-3 w-3" /> {incompleteRootCount} open
          </span>
        )}
      </header>
      {!collapsed && <div className="space-y-1">
        {tasks.length === 0 ? (
          <div
            className={`min-h-[2.5rem] rounded-md border border-dashed ${
              draggedTask && dropTarget !== null
                ? 'border-amber-500/60 bg-amber-500/5'
                : 'border-transparent'
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
            <p className="text-xs italic text-share-onSurfaceVariant/60">Nothing here yet.</p>
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
                onToggle={() => onToggleTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onAddTaskAbove={onAddTaskAbove ? () => onAddTaskAbove(task.id) : undefined}
                onAddTaskBelow={onAddTaskBelow ? () => onAddTaskBelow(task.id) : undefined}
                onAddSubtask={!task.parentId && onAddSubtask ? () => onAddSubtask(task.id) : undefined}
                onUpdateTask={(patch) => onUpdateTask(task.id, patch)}
                partnerVisible={partnerVisible}
                deepWorkSessions={deepWorkSessions}
                onStartBlock={
                  onStartBlock ? (minutes) => onStartBlock(task.id, minutes) : undefined
                }
                onOpenProgressSheet={
                  onOpenProgressSheet ? () => onOpenProgressSheet(task.id) : undefined
                }
                onSchedule={onScheduleTask ? () => onScheduleTask(task.id) : undefined}
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
                onAbandon={!task.parentId && onAbandonTask ? () => onAbandonTask(task.id) : undefined}
                onMoveToAnotherParent={task.parentId && onRequestMoveSubtask ? () => onRequestMoveSubtask(task.id) : undefined}
              />
            )
          })
        })()}
      </div>}
      {!collapsed && <AddTaskInput placeholder={addPlaceholder} onAdd={onAddTask} />}
    </section>
  )
}
