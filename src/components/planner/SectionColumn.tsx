/**
 * components/planner/SectionColumn.tsx
 *
 * Renders a single section (e.g. Morning routine, High Priority) with its tasks.
 */

import type { Task, TaskSection } from '../../domain/types'
import { AddTaskInput } from './AddTaskInput'
import { TaskItem } from './TaskItem'

interface SectionColumnProps {
  section: TaskSection
  tasks: Task[]
  onAddTask: (title: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
}

export function SectionColumn({
  section,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: SectionColumnProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
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
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => onToggleTask(task.id)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))
        )}
      </div>
      <AddTaskInput placeholder="Add task" onAdd={onAddTask} />
    </section>
  )
}

