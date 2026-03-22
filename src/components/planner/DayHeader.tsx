/**
 * components/planner/DayHeader.tsx
 *
 * Displays the current day and provides navigation between days.
 */

interface DayHeaderProps {
  dateLabel: string
  completionRatio?: number
  completedPoints?: number
  totalPoints?: number
  /** Current consecutive active days (ending on last active day). */
  streak?: number
  /** Longest consecutive active streak ever; shown with current streak for context. */
  bestStreak?: number
  /** Calendar days between first use and today that were missed. */
  daysMissed?: number
  /** Total calendar days since first use (for accountability context). */
  totalDays?: number
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
}

export function DayHeader({
  dateLabel,
  completionRatio = 0,
  completedPoints = 0,
  totalPoints = 0,
  streak,
  bestStreak,
  daysMissed,
  totalDays,
  onPrevDay,
  onNextDay,
  onToday,
}: DayHeaderProps) {
  const percentage =
    totalPoints <= 0 ? 0 : Math.max(0, Math.min(100, Math.round(completionRatio * 1000) / 10))
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="text-xs uppercase tracking-wide text-sky-300/80">Today&apos;s plan</p>
          {streak != null && streak > 0 && (
            <span className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
              🔥 {streak} day streak
              {bestStreak != null && bestStreak > 0 && streak >= bestStreak ? ' · best' : ''}
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
            <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
              {totalDays} day{totalDays !== 1 ? 's' : ''} since 1st use
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{dateLabel}</h2>
        {totalPoints > 0 ? (
          <div className="mt-2 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Today: <span className="font-medium text-slate-200">{percentage.toFixed(1)}%</span>
              </span>
              <span>
                {completedPoints.toFixed(1)}/{totalPoints.toFixed(1)} pts
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-900">
              <div
                className="h-1.5 rounded-full bg-sky-500 transition-[width] duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevDay}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 hover:text-sky-400 transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-sky-500 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-400 hover:bg-sky-500/20 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNextDay}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 hover:text-sky-400 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

