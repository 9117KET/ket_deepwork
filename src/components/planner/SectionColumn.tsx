/**
 * components/planner/SectionColumn.tsx
 *
 * Renders a single section (e.g. Morning routine, High Priority) with its tasks.
 * Manages drag state for reordering within the section.
 */

import { useState } from 'react'
import type { Task, TaskSection, TaskSectionId } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  /** When true, this section's time block is current (e.g. 5–9 morning, 9–5 focus). */
  isTimeBlockActive?: boolean
  /** Task currently being dragged (for cross-section drag); used to show drop targets and isDragging. */
  draggedTask?: { sectionId: TaskSectionId; taskId: string } | null
  onDragStart?: (sectionId: TaskSectionId, taskId: string) => void
  onDragEnd?: () => void
  /** Called when a task is dropped in this section at the given insert index (0 = before first task). */
  onDrop?: (insertIndex: number) => void
  onAddTask: (title: string) => void
  onAddTaskBelow?: (afterTaskId: string) => void
  onAddSubtask?: (parentTaskId: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onUpdateTask: (
    taskId: string,
    patch: { scheduledAt?: string; durationMinutes?: number; title?: string },
  ) => void
  taskIdsDueNow: Set<string>
}

type DropPosition = 'above' | 'below'

export function SectionColumn({
  section,
  tasks,
  isTimeBlockActive = false,
  draggedTask = null,
  onDragStart,
  onDragEnd,
  onDrop,
  onAddTask,
  onAddTaskBelow,
  onAddSubtask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  taskIdsDueNow,
}: SectionColumnProps) {
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(
    null,
  )

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
      <header className="mb-2">
        <h3 className="text-sm sm:text-base font-semibold text-slate-100">{section.title}</h3>
        {section.description ? (
          <p className="text-xs text-slate-400">{section.description}</p>
        ) : null}
      </header>
      <div className="space-y-1">
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
        ) : (
          tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              isSubtask={Boolean(task.parentId)}
              isDragging={draggedTask?.sectionId === section.id && draggedTask?.taskId === task.id}
              showDropAbove={dropTarget?.index === index && dropTarget?.position === 'above'}
              showDropBelow={dropTarget?.index === index && dropTarget?.position === 'below'}
              isDueNow={taskIdsDueNow.has(task.id)}
              onToggle={() => onToggleTask(task.id)}
              onDelete={() => onDeleteTask(task.id)}
              onAddTaskBelow={onAddTaskBelow ? () => onAddTaskBelow(task.id) : undefined}
              onAddSubtask={onAddSubtask ? () => onAddSubtask(task.id) : undefined}
              onUpdateTask={(patch) => onUpdateTask(task.id, patch)}
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(position) => handleDragOver(index, position)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
      <AddTaskInput placeholder="Add task" onAdd={onAddTask} />
    </section>
  )
}

