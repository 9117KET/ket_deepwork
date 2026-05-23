/**
 * components/planner/SideQuestSection.tsx
 *
 * Renders the Side Quest section below the core daily plan.
 * Locked with a progress overlay until 90% of the day's tasks are complete.
 *
 * When locked:
 *   - Shows progress toward unlock and a quest count teaser ("X quests waiting...")
 *   - "Manage quests" button is always accessible so you can set up your list without seeing it
 *
 * When unlocked:
 *   - Recurring quest defs appear as checkboxes (per-day completions, persistent defs)
 *   - Existing SectionColumn is shown below for ad-hoc tasks
 */

import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskSection, TaskSectionId, SideQuestDef } from '../../domain/types'
import { SectionColumn } from './SectionColumn'

const UNLOCK_THRESHOLD = 0.9

interface SideQuestSectionProps {
  dayCompletionRatio: number
  section: TaskSection
  tasks: Task[]
  defs: SideQuestDef[]
  completions: Record<string, boolean>
  onToggleCompletion: (id: string, value: boolean) => void
  onManageDefs: () => void
  draggedTask?: { sectionId: TaskSectionId; taskId: string } | null
  onDragStart?: (sectionId: TaskSectionId, taskId: string) => void
  onDragEnd?: () => void
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
  selectedTaskIds?: Set<string>
  onToggleSelect?: (taskId: string) => void
  headerAction?: ReactNode
  onMoveTaskUp?: (taskId: string) => void
  onMoveTaskDown?: (taskId: string) => void
  onMoveToNotDoing?: (taskId: string) => void
  onAbandonTask?: (taskId: string) => void
}

export function SideQuestSection({
  dayCompletionRatio,
  defs,
  completions,
  onToggleCompletion,
  onManageDefs,
  ...columnProps
}: SideQuestSectionProps) {
  const isLocked = dayCompletionRatio < UNLOCK_THRESHOLD
  const pct = Math.round(dayCompletionRatio * 100)
  const needed = Math.round(UNLOCK_THRESHOLD * 100)
  const fillPct = Math.min((pct / needed) * 100, 100)

  const wasLockedRef = useRef(true)
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    if (wasLockedRef.current && !isLocked) {
      wasLockedRef.current = false
      const t0 = setTimeout(() => setJustUnlocked(true), 0)
      const t1 = setTimeout(() => setJustUnlocked(false), 3000)
      return () => { clearTimeout(t0); clearTimeout(t1) }
    }
    if (isLocked) wasLockedRef.current = true
  }, [isLocked])

  return (
    <div className="relative">
      {/* Unlocked: recurring quest defs + ad-hoc section column */}
      {!isLocked ? (
        <div className="space-y-2">
          {defs.length > 0 && (
            <div className="rounded-lg border border-violet-900/30 bg-slate-900 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-300">📋 Recurring Quests</span>
                <button
                  type="button"
                  onClick={onManageDefs}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ⚙ Edit
                </button>
              </div>
              <div className="space-y-0.5">
                {defs.map((def) => {
                  const done = completions[def.id] ?? false
                  return (
                    <label
                      key={def.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => onToggleCompletion(def.id, e.target.checked)}
                        className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-violet-400 focus:ring-violet-500"
                      />
                      <span className={`text-sm ${done ? 'text-slate-500 line-through decoration-slate-600/60' : 'text-slate-200'}`}>
                        {def.title}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          <SectionColumn {...columnProps} />
        </div>
      ) : (
        /* Locked: SectionColumn underneath (hidden by overlay) */
        <SectionColumn {...columnProps} />
      )}

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-700/60 bg-slate-950/90 px-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-2xl">🔒</span>
            <p className="text-xs font-semibold text-slate-300">Side Quest — locked</p>
            <p className="text-[11px] text-slate-500">
              {needed - pct}% more to unlock · finish your core tasks first
            </p>
            {defs.length > 0 && (
              <p className="text-[11px] text-violet-400/80">
                {defs.length} quest{defs.length !== 1 ? 's' : ''} waiting...
              </p>
            )}
          </div>

          {/* Progress bar toward unlock */}
          <div className="w-36">
            <div className="mb-1 flex justify-between text-[10px] text-slate-600">
              <span>{pct}%</span>
              <span>{needed}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>

          {/* Manage button accessible even when locked */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onManageDefs() }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 hover:border-violet-700 hover:text-slate-300 transition-colors"
          >
            ⚙ Manage quests
          </button>
        </div>
      )}

      {/* First-unlock celebration banner */}
      {justUnlocked && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center">
          <div className="mt-2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
            <span>🎮</span>
            <span>
              Side Quest unlocked —{' '}
              {defs.length > 0 ? `${defs.length} quest${defs.length !== 1 ? 's' : ''} await!` : 'go explore!'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
