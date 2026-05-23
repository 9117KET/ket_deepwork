import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskSection, TaskSectionId, SideQuestDef } from '../../domain/types'
import { SectionColumn } from './SectionColumn'
import { getSideQuestRank } from '../../domain/sideQuestAlgorithm'

const UNLOCK_THRESHOLD = 0.9

const CAT_ICON: Record<string, string> = {
  fun: '🎮',
  serious: '📚',
  technical: '⚙',
}

interface SideQuestSectionProps {
  dayCompletionRatio: number
  section: TaskSection
  tasks: Task[]
  defs: SideQuestDef[]
  /** IDs of the 3 quests selected for today by the algorithm. */
  selectedQuestIds: string[]
  completions: Record<string, boolean>
  xp: number
  streak: number
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
  selectedQuestIds,
  completions,
  xp,
  streak,
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

  // Quests selected for today, resolved to full defs
  const todayDefs = selectedQuestIds
    .map(id => defs.find(d => d.id === id))
    .filter((d): d is SideQuestDef => Boolean(d))

  const { rank, emoji: rankEmoji, xpToNext } = getSideQuestRank(xp)

  return (
    <div className="relative">
      {!isLocked ? (
        <div className="space-y-2">
          {todayDefs.length > 0 && (
            <div className="rounded-lg border border-violet-900/30 bg-slate-900 p-3">
              {/* Header with rank + streak */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-violet-300">📋 Today's Quests</span>
                  <span
                    title={xpToNext ? `${xp} XP · ${xpToNext} to next rank` : `${xp} XP · Max rank!`}
                    className="text-[10px] text-violet-400/60"
                  >
                    {rankEmoji} {rank}
                  </span>
                  {streak > 0 && (
                    <span className="text-[10px] text-amber-400/70" title={`${streak}-day quest streak`}>
                      ⚡ {streak}d
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onManageDefs}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ⚙ Edit
                </button>
              </div>

              <div className="space-y-0.5">
                {todayDefs.map((def) => {
                  const done = completions[def.id] ?? false
                  const catIcon = CAT_ICON[def.category ?? 'fun'] ?? '🎮'
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
                      <span className={`flex-1 text-sm ${done ? 'text-slate-500 line-through decoration-slate-600/60' : 'text-slate-200'}`}>
                        {def.title}
                      </span>
                      <span className="text-[10px] text-slate-600" title={def.category ?? 'fun'}>
                        {catIcon}
                      </span>
                    </label>
                  )
                })}
              </div>

              {/* XP progress hint */}
              {xpToNext !== null && (
                <p className="mt-2 text-[9px] text-slate-600">
                  {xpToNext} quest{xpToNext !== 1 ? 's' : ''} to {getSideQuestRank(xp + xpToNext).rank}
                </p>
              )}
            </div>
          )}
          <SectionColumn {...columnProps} />
        </div>
      ) : (
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
            {selectedQuestIds.length > 0 && (
              <p className="text-[11px] text-violet-400/80">
                {selectedQuestIds.length} quest{selectedQuestIds.length !== 1 ? 's' : ''} waiting...
              </p>
            )}
          </div>

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
              Side Quest unlocked -{' '}
              {todayDefs.length > 0 ? `${todayDefs.length} quest${todayDefs.length !== 1 ? 's' : ''} await!` : 'go explore!'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
