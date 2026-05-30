import { Flame, Timer, Zap, Calendar, Scale, Moon } from 'lucide-react'

interface DayHeaderProps {
  dateLabel: string
  completionRatio?: number
  completedTaskCount?: number
  totalTaskCount?: number
  streak?: number
  bestStreak?: number
  daysMissed?: number
  totalDays?: number
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  deepWorkMinutesToday?: number
  depthPhilosophy?: 'rhythmic' | 'journalistic' | 'bimodal'
  shutdownCompleted?: boolean
  onShutdown?: () => void
}

export function DayHeader({
  dateLabel,
  completionRatio = 0,
  completedTaskCount = 0,
  totalTaskCount = 0,
  streak,
  bestStreak,
  daysMissed,
  totalDays,
  onPrevDay,
  onNextDay,
  onToday,
  deepWorkMinutesToday,
  depthPhilosophy,
  shutdownCompleted,
  onShutdown,
}: DayHeaderProps) {
  const percentage =
    totalTaskCount <= 0 ? 0 : Math.max(0, Math.min(100, Math.round(completionRatio * 1000) / 10))
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="text-xs uppercase tracking-wide text-share-primary/70">Today&apos;s plan</p>
          {streak != null && streak > 0 && (
            <span className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
              <Flame className="h-3 w-3" />
              {streak} day streak
              {bestStreak != null && bestStreak > 0 && streak >= bestStreak ? ' (best)' : ''}
            </span>
          )}
          {bestStreak != null &&
            bestStreak > 0 &&
            streak != null &&
            streak > 0 &&
            bestStreak > streak && (
              <span
                className="rounded border border-violet-500/50 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-200"
                title="Longest consecutive streak you have recorded"
              >
                Best {bestStreak} days
              </span>
            )}
          {daysMissed != null && daysMissed === 0 && totalDays != null && totalDays > 0 && (
            <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
              0 days missed
            </span>
          )}
          {daysMissed != null && daysMissed > 0 && (
            <span className="rounded border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
              {daysMissed} day{daysMissed !== 1 ? 's' : ''} missed
            </span>
          )}
          {totalDays != null && totalDays > 0 && (
            <span className="rounded border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-2 py-0.5 text-xs text-share-onSurfaceVariant">
              {totalDays} day{totalDays !== 1 ? 's' : ''} since 1st use
            </span>
          )}
          {deepWorkMinutesToday != null && deepWorkMinutesToday > 0 && (() => {
            const h = Math.floor(deepWorkMinutesToday / 60)
            const m = deepWorkMinutesToday % 60
            return (
              <span className="flex items-center gap-1 rounded border border-teal-500/50 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-300">
                <Timer className="h-3 w-3" />
                {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''} deep today
              </span>
            )
          })()}
          {depthPhilosophy && (
            <span className="flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
              {depthPhilosophy === 'rhythmic' ? (
                <><Zap className="h-3 w-3" /> Rhythmic</>
              ) : depthPhilosophy === 'journalistic' ? (
                <><Calendar className="h-3 w-3" /> Journalistic</>
              ) : (
                <><Scale className="h-3 w-3" /> Bimodal</>
              )}
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{dateLabel}</h2>
        {totalTaskCount > 0 ? (
          <div className="mt-2 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-share-onSurfaceVariant">
              <span>
                Today: <span className="font-medium text-share-onBg">{percentage.toFixed(1)}%</span>
              </span>
              <span>
                {completedTaskCount}/{totalTaskCount} tasks
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-share-outlineVariant/30">
              <div
                className="h-1.5 rounded-full bg-share-primary transition-[width] duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {onShutdown && (
          shutdownCompleted ? (
            <span className="flex items-center gap-1 rounded-md border border-emerald-600/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
              <Moon className="h-3.5 w-3.5" /> Day closed
            </span>
          ) : (
            <button
              type="button"
              onClick={onShutdown}
              title="Run the shutdown ritual — close the day intentionally"
              className="flex items-center gap-1 rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-2.5 py-1.5 text-xs text-share-onSurfaceVariant hover:border-violet-500/60 hover:text-violet-300 transition-colors"
            >
              <Moon className="h-3.5 w-3.5" /> Close day
            </button>
          )
        )}
        <button
          type="button"
          onClick={onPrevDay}
          className="rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onSurface hover:border-share-primary/60 hover:text-share-primary transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-share-primary/60 bg-share-primary/10 px-3 py-1.5 text-sm text-share-primary hover:bg-share-primary/20 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNextDay}
          className="rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onSurface hover:border-share-primary/60 hover:text-share-primary transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
