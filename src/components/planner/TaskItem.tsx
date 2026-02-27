/**
 * components/planner/TaskItem.tsx
 *
 * Single task row with checkbox and delete action.
 */

import type { Task } from '../../domain/types'

interface TaskItemProps {
  task: Task
  onToggle: () => void
  onDelete: () => void
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const trimmedTitle = task.title.trim()
  const isUrl = /^https?:\/\/\S+$/i.test(trimmedTitle)
  const textClasses = `text-sm ${
    task.isDone ? 'text-slate-400 line-through decoration-slate-500/60' : 'text-slate-100'
  }`

  return (
    <div className="flex items-center gap-2 py-1.5">
      <label className="flex flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={task.isDone}
          onChange={onToggle}
          className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-sky-400 focus:ring-sky-500"
        />
        {isUrl ? (
          <a
            href={trimmedTitle}
            target="_blank"
            rel="noreferrer"
            className={`${textClasses} break-words underline decoration-sky-500/60 underline-offset-2 hover:text-sky-300`}
            onClick={(event) => event.stopPropagation()}
          >
            {trimmedTitle}
          </a>
        ) : (
          <span className={textClasses}>{task.title}</span>
        )}
      </label>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-900 hover:text-sky-400"
      >
        ✕
      </button>
    </div>
  )
}

