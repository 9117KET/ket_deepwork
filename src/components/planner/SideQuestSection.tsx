/**
 * components/planner/SideQuestSection.tsx
 *
 * Renders the Side Quest section below the core daily plan.
 * Locked with a progress overlay until 90% of the day's tasks are complete.
 * When unlocked, behaves like a standard SectionColumn for curiosity-driven
 * exploration tasks that don't belong in the core priority stack.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskSection, TaskSectionId } from '../../domain/types'
import { SectionColumn } from './SectionColumn'

const UNLOCK_THRESHOLD = 0.9

interface SideQuestSectionProps {
  dayCompletionRatio: number
  section: TaskSection
  tasks: Task[]
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

export function SideQuestSection({ dayCompletionRatio, ...columnProps }: SideQuestSectionProps) {
  const isLocked = dayCompletionRatio < UNLOCK_THRESHOLD
  const pct = Math.round(dayCompletionRatio * 100)
  const needed = Math.round(UNLOCK_THRESHOLD * 100)
  const fillPct = Math.min((pct / needed) * 100, 100)

  // Track first-unlock for celebratory flash
  const wasLockedRef = useRef(true)
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    if (wasLockedRef.current && !isLocked) {
      setJustUnlocked(true)
      const t = setTimeout(() => setJustUnlocked(false), 3000)
      wasLockedRef.current = false
      return () => clearTimeout(t)
    }
    if (isLocked) wasLockedRef.current = true
  }, [isLocked])

  return (
    <div className="relative">
      <SectionColumn {...columnProps} />

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-700/60 bg-slate-950/90 px-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-2xl">🔒</span>
            <p className="text-xs font-semibold text-slate-300">Side Quest — locked</p>
            <p className="text-[11px] text-slate-500">
              {needed - pct}% more to unlock · finish your core tasks first
            </p>
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
        </div>
      )}

      {/* First-unlock celebration banner */}
      {justUnlocked && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center">
          <div className="mt-2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
            <span>🎮</span>
            <span>Side Quest unlocked — go explore!</span>
          </div>
        </div>
      )}
    </div>
  )
}
