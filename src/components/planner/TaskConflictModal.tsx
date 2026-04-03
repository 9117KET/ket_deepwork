/**
 * components/planner/TaskConflictModal.tsx
 *
 * Shown when a block duration change pushes scheduled tasks outside
 * the block's new time window. The user can keep the task time as-is,
 * clear the scheduled time, or move the task to the next block.
 */

import type { Task } from '../../domain/types'

interface TaskConflictModalProps {
  blockName: string
  newStart: string  // "HH:MM"
  newEnd: string    // "HH:MM"
  conflictingTasks: Task[]
  nextBlockName: string | null
  onKeep: () => void
  onClear: () => void
  onMove: (() => void) | null
}

export function TaskConflictModal({
  blockName,
  newStart,
  newEnd,
  conflictingTasks,
  nextBlockName,
  onKeep,
  onClear,
  onMove,
}: TaskConflictModalProps) {
  const count = conflictingTasks.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 text-amber-400">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {count} task{count !== 1 ? 's' : ''} outside new window
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {blockName} is now {newStart} - {newEnd}. The following task{count !== 1 ? 's are' : ' is'} scheduled outside this window:
            </p>
          </div>
        </div>

        <ul className="mb-4 space-y-1">
          {conflictingTasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
              <span className="font-mono text-slate-500">{t.scheduledAt}</span>
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            onClick={onKeep}
            className="w-full rounded-lg border border-slate-600 px-4 py-2 text-left text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            <span className="font-medium">Keep scheduled times</span>
            <span className="ml-2 text-slate-500">Task times stay unchanged</span>
          </button>
          <button
            onClick={onClear}
            className="w-full rounded-lg border border-slate-600 px-4 py-2 text-left text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            <span className="font-medium">Clear scheduled times</span>
            <span className="ml-2 text-slate-500">Remove time from conflicting tasks</span>
          </button>
          {onMove && nextBlockName && (
            <button
              onClick={onMove}
              className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-left text-xs text-sky-300 hover:bg-sky-500/20"
            >
              <span className="font-medium">Move to {nextBlockName}</span>
              <span className="ml-2 text-sky-400/60">Reassign tasks to the next block</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
