/**
 * components/planner/SectionColumn.tsx
 *
 * One list of tasks with its add field: reorder by mouse drag, finger drag
 * (press and hold, `useTouchReorder`), the sheet, or Alt+Arrow on the grip;
 * subtasks, progress boxes, and the schedule chip. Time lives in the calendar
 * now, so the list no longer carries a block window, a capacity badge or a
 * "time block ended" prompt — only a nudge when it grows too long to finish.
 */

import { useState, useRef, useCallback } from 'react'
import type { DeepWorkSession, Task, TaskPatch, TaskSection, TaskSectionId } from '../../domain/types'
import { AddTaskInput, type AddTaskOptions } from './AddTaskInput'
import { TaskItem, type TaskItemTouch } from './TaskItem'
import {
  emptyListData,
  rootRowData,
  subtaskRowData,
  type TouchReorder,
} from '../../hooks/useTouchReorder'
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
  onAddTask: (title: string, options?: AddTaskOptions) => void
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
  /** Phone sheet: move a root, with its subtasks, to the end of the Top 3. */
  onMoveToTop3?: (taskId: string) => void
  /** The finger drag shared by every list on Today (`useTouchReorder`). */
  touch?: TouchReorder
  /** A subtask's mouse drag began / ended, so a drop elsewhere can be refused out loud. */
  onSubtaskDragStart?: (subtaskId: string) => void
  onSubtaskDragEnd?: () => void
  /** A subtask was dropped on another parent's subtask. */
  onSubtaskDropRefused?: () => void
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
  onMoveToTop3,
  touch,
  onSubtaskDragStart,
  onSubtaskDragEnd,
  onSubtaskDropRefused,
}: SectionColumnProps) {
  /** What the keyboard reorder last did, read out by the live region. */
  const [announcement, setAnnouncement] = useState('')
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
    onSubtaskDragStart?.(subtaskId)
  }, [onSubtaskDragStart])

  const handleSubtaskDragOver = useCallback((subtaskId: string, position: DropPosition) => {
    setSubtaskDropTarget({ subtaskId, position })
  }, [])

  const handleSubtaskDragLeave = useCallback(() => setSubtaskDropTarget(null), [])

  const handleSubtaskDrop = useCallback((targetSubtaskId: string, parentAfterIndex: number) => {
    const payload = draggedSubtaskRef.current ?? draggedSubtask
    if (!payload) {
      // A root (or a subtask from another list) dropped on a subtask row:
      // treat it as a drop just after that subtask's whole parent.
      onDrop?.(parentAfterIndex)
      setSubtaskDropTarget(null)
      return
    }
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
    } else if (fromIndex >= 0) {
      // Another parent's subtask: subtasks never change parent by drag.
      onSubtaskDropRefused?.()
    }
    draggedSubtaskRef.current = null
    setDraggedSubtask(null)
    setSubtaskDropTarget(null)
  }, [draggedSubtask, subtaskDropTarget, tasks, onReorderSubtask, onSubtaskDropRefused, onDrop])

  const handleSubtaskDragEnd = useCallback(() => {
    draggedSubtaskRef.current = null
    setDraggedSubtask(null)
    setSubtaskDropTarget(null)
    onSubtaskDragEnd?.()
  }, [onSubtaskDragEnd])

  // Each root's place in the ordered list (`tasks`, subtasks included):
  // `before` is the root's own index, `after` the index past its last subtask.
  // These are the insert indices the planner's drop handler takes.
  const rootBounds = new Map<string, { before: number; after: number }>()
  {
    const rootIndices: number[] = []
    for (let i = 0; i < tasks.length; i++) if (!tasks[i]!.parentId) rootIndices.push(i)
    rootIndices.forEach((before, k) => {
      rootBounds.set(tasks[before]!.id, { before, after: rootIndices[k + 1] ?? tasks.length })
    })
  }

  const touchItem = touch?.state.item ?? null
  const touchTarget = touch?.state.target ?? null
  const rootLineAt =
    touchTarget?.kind === 'root' && touchTarget.sectionId === section.id ? touchTarget.index : null
  const subtaskLine = touchTarget?.kind === 'subtask' ? touchTarget : null

  /** Alt+Arrow on the grip, with a spoken result ("Moved up. 2 of 5."). */
  const keyboardMove = (taskId: string, rootIdx: number, rootCount: number, direction: 'up' | 'down') => {
    if (direction === 'up') {
      if (rootIdx <= 0) return setAnnouncement(`Already first. 1 of ${rootCount}.`)
      onMoveTaskUp?.(taskId)
      setAnnouncement(`Moved up. ${rootIdx} of ${rootCount}.`)
    } else {
      if (rootIdx >= rootCount - 1) return setAnnouncement(`Already last. ${rootCount} of ${rootCount}.`)
      onMoveTaskDown?.(taskId)
      setAnnouncement(`Moved down. ${rootIdx + 2} of ${rootCount}.`)
    }
  }

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
            {...emptyListData(section.id)}
            className={`min-h-[2.5rem] rounded-md border border-dashed ${
              (draggedTask && dropTarget !== null) || rootLineAt === 0
                ? 'border-share-primary/70 bg-share-primary/5'
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
            const isLast = index === tasks.length - 1
            // Where this row sits for the finger drag, and which lines it draws.
            let rowTouch: TaskItemTouch | undefined
            if (touch) {
              if (task.parentId) {
                const siblings = tasks.filter((t) => t.parentId === task.parentId)
                const siblingIdx = siblings.findIndex((t) => t.id === task.id)
                const parentAfter = rootBounds.get(task.parentId)?.after ?? tasks.length
                const ownSiblings = subtaskLine?.parentId === task.parentId
                rowTouch = {
                  binding: touch.bind({ taskId: task.id, sectionId: section.id, parentId: task.parentId }),
                  data: subtaskRowData(section.id, task.parentId, siblingIdx, parentAfter),
                  lifted: touchItem?.taskId === task.id,
                  lineAbove: ownSiblings && subtaskLine.index === siblingIdx,
                  lineBelow:
                    (ownSiblings && siblingIdx === siblings.length - 1 && subtaskLine.index === siblings.length) ||
                    (isLast && rootLineAt === tasks.length),
                }
              } else {
                const bounds = rootBounds.get(task.id) ?? { before: index, after: index + 1 }
                rowTouch = {
                  binding: touch.bind({ taskId: task.id, sectionId: section.id }),
                  data: rootRowData(section.id, bounds.before, bounds.after),
                  lifted: touchItem?.taskId === task.id,
                  lineAbove: rootLineAt === bounds.before,
                  lineBelow: isLast && rootLineAt === tasks.length,
                }
              }
            }
            const parentAfterIndex = task.parentId
              ? (rootBounds.get(task.parentId)?.after ?? tasks.length)
              : index + 1
            return (
              <TaskItem
                key={task.id}
                task={task}
                touch={rowTouch}
                onMoveToTop3={
                  !task.parentId && onMoveToTop3 ? () => onMoveToTop3(task.id) : undefined
                }
                onKeyboardMove={
                  !task.parentId && (onMoveTaskUp || onMoveTaskDown)
                    ? (direction) => keyboardMove(task.id, rootIdx, roots.length, direction)
                    : undefined
                }
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
                    ? () => handleSubtaskDrop(task.id, parentAfterIndex)
                    : !task.parentId ? handleDrop : undefined
                }
                onDragEnd={
                  task.parentId && onReorderSubtask
                    ? handleSubtaskDragEnd
                    : !task.parentId ? handleDragEnd : undefined
                }
                // A parent moves with its subtasks: they are grouped under it
                // by `parentId`, wherever the parent lands.
                onMoveUp={onMoveTaskUp && rootIdx > 0 ? () => onMoveTaskUp(task.id) : undefined}
                onMoveDown={onMoveTaskDown && rootIdx >= 0 && rootIdx < roots.length - 1 ? () => onMoveTaskDown(task.id) : undefined}
                onAbandon={!task.parentId && onAbandonTask ? () => onAbandonTask(task.id) : undefined}
                onMoveToAnotherParent={task.parentId && onRequestMoveSubtask ? () => onRequestMoveSubtask(task.id) : undefined}
              />
            )
          })
        })()}
      </div>}
      {!collapsed && <AddTaskInput placeholder={addPlaceholder} onAdd={onAddTask} />}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  )
}
