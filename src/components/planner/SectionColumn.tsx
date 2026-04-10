/**
 * components/planner/SectionColumn.tsx
 *
 * Renders a single section (e.g. Morning routine, High Priority) with its tasks.
 * Manages drag state for reordering within the section.
 */

import { useState, type ReactNode } from 'react'
import type { Task, TaskSection, TaskSectionId } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  /** When true, this section's time block is current (e.g. 5–9 morning, 9–5 focus). */
  isTimeBlockActive?: boolean
  /** Human-readable timeframe label for this section (already adjusted for any global offset). */
  timeframeLabel?: string | null
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
    patch: { scheduledAt?: string; durationMinutes?: number; title?: string },
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
  /**
   * Max incomplete root tasks before showing an overload nudge.
   * Undefined = no nudge for this section.
   */
  overloadThreshold?: number
}

type DropPosition = 'above' | 'below'

export function SectionColumn({
  section,
  tasks,
  isTimeBlockActive = false,
  timeframeLabel = null,
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
  overloadThreshold,
}: SectionColumnProps) {
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(
    null,
  )
  const [collapsed, setCollapsed] = useState(false)

  const incompleteRootCount = tasks.filter((t) => !t.parentId && !t.isDone).length
  const isOverloaded = overloadThreshold !== undefined && incompleteRootCount > overloadThreshold

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

  return (
    <section
      className={`rounded-lg border p-3 sm:p-4 ${
        isTimeBlockActive
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900'
      }`}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-200 sm:hidden"
            aria-label={collapsed ? 'Expand section' : 'Collapse section'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-slate-100">{section.title}</h3>
              {collapsed && tasks.length > 0 && (
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300 sm:hidden">
                  {tasks.filter(t => !t.parentId).length}
                </span>
              )}
              {isOverloaded && (
                <span
                  className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                  title={`${incompleteRootCount} incomplete tasks — trim to stay focused`}
                >
                  ⚠ {incompleteRootCount} tasks
                </span>
              )}
            </div>
            {timeframeLabel ? (
              <p className="text-xs text-slate-400">
                Timeframe: {timeframeLabel}
                {section.description ? ` (${section.description})` : null}
              </p>
            ) : section.description ? (
              <p className="text-xs text-slate-500">{section.description}</p>
            ) : null}
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </header>
      {!collapsed && <div className="space-y-1">
        {tasks.length === 0 ? (
          <div
            className={`min-h-[2.5rem] rounded-md border border-dashed ${
              draggedTask && dropTarget !== null
                ? 'border-amber-500/60 bg-amber-500/5'
                : 'border-slate-700/60 border-transparent'
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
            <p className="text-xs text-slate-400 italic">No tasks yet. Drop a task here.</p>
          </div>
        ) : (() => {
          const roots = tasks.filter((t) => !t.parentId)
          return tasks.map((task, index) => {
            const rootIdx = task.parentId ? -1 : roots.findIndex((r) => r.id === task.id)
            return (
              <TaskItem
                key={task.id}
                task={task}
                isSubtask={Boolean(task.parentId)}
                isDragging={draggedTask?.sectionId === section.id && draggedTask?.taskId === task.id}
                showDropAbove={dropTarget?.index === index && dropTarget?.position === 'above'}
                showDropBelow={dropTarget?.index === index && dropTarget?.position === 'below'}
                isDueNow={taskIdsDueNow.has(task.id)}
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(task.id) : undefined}
                onToggle={() => onToggleTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onAddTaskAbove={onAddTaskAbove ? () => onAddTaskAbove(task.id) : undefined}
                onAddTaskBelow={onAddTaskBelow ? () => onAddTaskBelow(task.id) : undefined}
                onAddSubtask={onAddSubtask ? () => onAddSubtask(task.id) : undefined}
                onUpdateTask={(patch) => onUpdateTask(task.id, patch)}
                onDragStart={() => handleDragStart(task.id)}
                onDragOver={(position) => handleDragOver(index, position)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMoveUp={onMoveTaskUp && rootIdx > 0 ? () => onMoveTaskUp(task.id) : undefined}
                onMoveDown={onMoveTaskDown && rootIdx >= 0 && rootIdx < roots.length - 1 ? () => onMoveTaskDown(task.id) : undefined}
                onMoveToNotDoing={onMoveToNotDoing ? () => onMoveToNotDoing(task.id) : undefined}
                onAbandon={onAbandonTask ? () => onAbandonTask(task.id) : undefined}
              />
            )
          })
        })()}
      </div>}
      {!collapsed && <AddTaskInput placeholder="Add task" onAdd={onAddTask} />}
    </section>
  )
}

