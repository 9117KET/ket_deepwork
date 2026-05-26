import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskSection, TaskSectionId, SideQuestDef } from '../../domain/types'
import { SectionColumn } from './SectionColumn'
import { getSideQuestRank } from '../../domain/sideQuestAlgorithm'
import {
  Lock, ListChecks, Settings, Zap, Check,
  Gamepad2, BookOpen, Wrench,
  Sprout, Map, Sword, Trophy, Star,
} from 'lucide-react'

const UNLOCK_THRESHOLD = 0.9

type LucideIconComponent = React.ComponentType<{ className?: string }>

const CAT_ICON: Record<string, LucideIconComponent> = {
  fun: Gamepad2,
  serious: BookOpen,
  technical: Wrench,
}

const RANK_ICON: Record<string, LucideIconComponent> = {
  Curious: Sprout,
  Explorer: Map,
  Adventurer: Sword,
  Champion: Trophy,
  Legendary: Star,
}

interface SideQuestSectionProps {
  dayCompletionRatio: number
  section: TaskSection
  tasks: Task[]
  defs: SideQuestDef[]
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

  const todayDefs = selectedQuestIds
    .map(id => defs.find(d => d.id === id))
    .filter((d): d is SideQuestDef => Boolean(d))

  const { rank, xpToNext } = getSideQuestRank(xp)
  const RankIcon = RANK_ICON[rank] ?? Star

  return (
    <div className="relative">
      {!isLocked ? (
        <div className="space-y-2">
          {todayDefs.length > 0 && (
            <div className="rounded-lg border border-violet-900/30 bg-share-surfaceContainerLow p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-xs font-semibold text-violet-300">Today's Quests</span>
                  <span
                    title={xpToNext ? `${xp} XP, ${xpToNext} to next rank` : `${xp} XP, max rank`}
                    className="flex items-center gap-1 text-[10px] text-violet-400/60"
                  >
                    <RankIcon className="h-3 w-3" />
                    {rank}
                  </span>
                  {streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-400/70" title={`${streak}-day quest streak`}>
                      <Zap className="h-3 w-3" />{streak}d
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onManageDefs}
                  className="flex items-center gap-1 text-[10px] text-share-onSurfaceVariant/60 hover:text-share-onSurface transition-colors"
                >
                  <Settings className="h-3 w-3" /> Edit
                </button>
              </div>

              <div className="space-y-0.5">
                {todayDefs.map((def) => {
                  const done = completions[def.id] ?? false
                  const CatIcon = CAT_ICON[def.category ?? 'fun'] ?? Gamepad2
                  return (
                    <label
                      key={def.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-share-surfaceContainerHigh transition-colors"
                    >
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        done ? 'border-violet-500 bg-violet-500 text-white' : 'border-share-outlineVariant/50 bg-share-surfaceContainerHigh'
                      }`}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={(e) => onToggleCompletion(def.id, e.target.checked)}
                          className="sr-only"
                        />
                        {done && <Check className="h-3 w-3" />}
                      </div>
                      <span className={`flex-1 text-sm ${done ? 'text-share-onSurfaceVariant/50 line-through decoration-share-outlineVariant/60' : 'text-share-onSurface'}`}>
                        {def.title}
                      </span>
                      <CatIcon className="h-3.5 w-3.5 text-share-onSurfaceVariant/40 shrink-0" />
                    </label>
                  )
                })}
              </div>

              {xpToNext !== null && (
                <p className="mt-2 text-[9px] text-share-onSurfaceVariant/40">
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

      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-share-outlineVariant/30 bg-share-bg/90 px-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Lock className="h-6 w-6 text-share-onSurfaceVariant" />
            <p className="text-xs font-semibold text-share-onBg">Side Quest - locked</p>
            <p className="text-[11px] text-share-onSurfaceVariant/60">
              {needed - pct}% more to unlock, finish your core tasks first
            </p>
            {selectedQuestIds.length > 0 && (
              <p className="text-[11px] text-violet-400/80">
                {selectedQuestIds.length} quest{selectedQuestIds.length !== 1 ? 's' : ''} waiting...
              </p>
            )}
          </div>

          <div className="w-36">
            <div className="mb-1 flex justify-between text-[10px] text-share-onSurfaceVariant/50">
              <span>{pct}%</span>
              <span>{needed}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-share-outlineVariant/25">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onManageDefs() }}
            className="flex items-center gap-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-0.5 text-[10px] text-share-onSurfaceVariant/60 hover:border-violet-500/60 hover:text-share-onSurface transition-colors"
          >
            <Settings className="h-3 w-3" /> Manage quests
          </button>
        </div>
      )}

      {justUnlocked && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center">
          <div className="mt-2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
            <Gamepad2 className="h-3.5 w-3.5" />
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
