import { Flame, Timer, Zap, Calendar, Scale, Moon, ChevronLeft, ChevronRight } from 'lucide-react'

interface DayHeaderProps {
  dateLabel: string
  completionRatio?: number
  completedTaskCount?: number
  totalTaskCount?: number
  streak?: number
  bestStreak?: number
  daysMissed?: number
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

  // Deep work today, formatted ("1h 30m"), used for the prominent pill.
  const deepWorkLabel =
    deepWorkMinutesToday != null && deepWorkMinutesToday > 0
      ? (() => {
          const h = Math.floor(deepWorkMinutesToday / 60)
          const m = deepWorkMinutesToday % 60
          return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim()
        })()
      : null

  // Quiet, dot-separated secondary stats. Only facts that can prompt an action
  // survive here: a best streak worth chasing, and days actually missed. The
  // always-true counters ("0 days missed", "N days since 1st use") were pure
  // decoration — they never changed a decision and crowded out the date.
  const secondaryStats: string[] = []
  if (bestStreak != null && bestStreak > 0 && streak != null && streak > 0 && bestStreak > streak) {
    secondaryStats.push(`best ${bestStreak}`)
  }
  if (daysMissed != null && daysMissed > 0) {
    secondaryStats.push(`${daysMissed} day${daysMissed !== 1 ? 's' : ''} missed`)
  }
  const depthLabel = depthPhilosophy
    ? depthPhilosophy === 'rhythmic'
      ? 'Rhythmic'
      : depthPhilosophy === 'journalistic'
        ? 'Journalistic'
        : 'Bimodal'
    : null

  const DepthIcon =
    depthPhilosophy === 'rhythmic' ? Zap : depthPhilosophy === 'journalistic' ? Calendar : Scale
  const atBest = bestStreak != null && bestStreak > 0 && streak != null && streak >= bestStreak
  const hasMeta =
    (streak != null && streak > 0) || deepWorkLabel || depthLabel || secondaryStats.length > 0

  const navButton =
    'touch-target flex items-center justify-center rounded-md text-share-onSurface transition-colors hover:bg-share-surfaceContainerHigh hover:text-share-primary'

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {/* The date is the heading. The old "TODAY'S PLAN" eyebrow above it
            restated what the page already is, and pushed the real title down. */}
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{dateLabel}</h2>

        {/* One metadata line at one visual weight. These were three separately
            bordered and filled chips in three hues (amber / teal / violet),
            which read as three competing alerts rather than a status line.
            Colour now survives only on the icons, as an accent rather than a
            container. */}
        {hasMeta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-share-onSurfaceVariant">
            {streak != null && streak > 0 && (
              <span className="flex items-center gap-1" title="Consecutive active days">
                <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="font-medium text-share-onBg">{streak}</span>
                day streak{atBest ? ' · best' : ''}
              </span>
            )}
            {deepWorkLabel && (
              <span className="flex items-center gap-1" title="Deep work logged today">
                <Timer className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span className="font-medium text-share-onBg">{deepWorkLabel}</span>
                deep
              </span>
            )}
            {depthLabel && (
              <span className="flex items-center gap-1" title="Depth philosophy">
                <DepthIcon className="h-3.5 w-3.5 shrink-0 text-violet-400/80" />
                {depthLabel}
              </span>
            )}
            {secondaryStats.length > 0 && (
              <span className="text-share-onSurfaceVariant/60">{secondaryStats.join(' · ')}</span>
            )}
          </div>
        )}

        {totalTaskCount > 0 ? (
          <div className="mt-2.5 max-w-md">
            <div className="mb-1 flex items-center justify-between text-[11px] text-share-onSurfaceVariant">
              <span>
                <span className="font-medium text-share-onBg">
                  {completedTaskCount}/{totalTaskCount}
                </span>{' '}
                tasks
              </span>
              {/* Whole percent: the old 42.9% implied a precision that a task
                  count of seven does not have. */}
              <span className="tabular-nums">{Math.round(percentage)}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-share-outlineVariant/30">
              <div
                className="h-1 rounded-full bg-share-primary transition-[width] duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onShutdown &&
          (shutdownCompleted ? (
            <span className="touch-target flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-2.5 text-xs text-emerald-300">
              <Moon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Day closed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onShutdown}
              title="Run the shutdown ritual — close the day intentionally"
              aria-label="Close day"
              className="touch-target flex items-center gap-1.5 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-2.5 text-xs text-share-onSurfaceVariant transition-colors hover:border-violet-500/60 hover:text-violet-300"
            >
              <Moon className="h-3.5 w-3.5 shrink-0" />
              {/* Label folds away on the narrowest phones so the day nav still
                  fits on one row at 280px. */}
              <span className="hidden sm:inline">Close day</span>
            </button>
          ))}

        {/* Segmented control: one border around the group instead of three
            separate outlined buttons, and chevrons instead of the words
            "Previous" / "Next", which cost width without adding meaning. */}
        <div className="flex items-center gap-0.5 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer p-0.5">
          <button type="button" onClick={onPrevDay} aria-label="Previous day" className={navButton}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="touch-target rounded-md px-3 text-sm font-medium text-share-primary transition-colors hover:bg-share-primary/15"
          >
            Today
          </button>
          <button type="button" onClick={onNextDay} aria-label="Next day" className={navButton}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
