/**
 * components/planner/SectionColumn.tsx
 *
 * Renders a single section (e.g. Morning routine, High Priority) with its tasks.
 * Manages drag state for reordering within the section.
 */

import { useState } from 'react'
import type { Task, TaskSection } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  /** When true, this section's time block is current (e.g. 5–9 morning, 9–5 focus). */
  isTimeBlockActive?: boolean
  onAddTask: (title: string) => void
  onAddTaskBelow?: (afterTaskId: string) => void
  onAddSubtask?: (parentTaskId: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
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
  onAddTask,
  onAddTaskBelow,
  onAddSubtask,
  onToggleTask,
  onDeleteTask,
  onReorder,
  onUpdateTask,
  taskIdsDueNow,
}: SectionColumnProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(
    null,
  )

  const handleDragStart = (index: number) => setDraggedIndex(index)
  const handleDragOver = (index: number, position: DropPosition) =>
    setDropTarget({ index, position })
  const handleDragLeave = () => setDropTarget(null)
  const handleDrop = () => {
    if (draggedIndex == null || !dropTarget) return
    const toIndex =
      dropTarget.position === 'above' ? dropTarget.index : dropTarget.index + 1
    if (draggedIndex !== toIndex) onReorder(draggedIndex, toIndex)
    setDraggedIndex(null)
    setDropTarget(null)
  }
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDropTarget(null)
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
          <p className="text-xs text-slate-400 italic">No tasks yet.</p>
        ) : (
          tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              isSubtask={Boolean(task.parentId)}
              isDragging={draggedIndex === index}
              showDropAbove={dropTarget?.index === index && dropTarget?.position === 'above'}
              showDropBelow={dropTarget?.index === index && dropTarget?.position === 'below'}
              isDueNow={taskIdsDueNow.has(task.id)}
              onToggle={() => onToggleTask(task.id)}
              onDelete={() => onDeleteTask(task.id)}
              onAddTaskBelow={onAddTaskBelow ? () => onAddTaskBelow(task.id) : undefined}
              onAddSubtask={onAddSubtask ? () => onAddSubtask(task.id) : undefined}
              onUpdateTask={(patch) => onUpdateTask(task.id, patch)}
              onDragStart={() => handleDragStart(index)}
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

