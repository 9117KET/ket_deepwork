/**
 * components/planner/DayHeader.tsx
 *
 * One row: the date and the day stepper. Under it, one quiet status line —
 * the streak, today's earned deep work, and how much of the list is done.
 *
 * Everything else that used to live here (depth philosophy, close-day,
 * a Today/Review toggle, a full-width progress bar) cost a phone ~120px of
 * height before the first task, and none of it changed what you do next.
 */

import { Flame, Timer, Flag, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface DayHeaderProps {
  dateLabel: string
  completedTaskCount?: number
  totalTaskCount?: number
  streak?: number
  isToday: boolean
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  deepWorkMinutesToday?: number
  /** "Day 22/92 · 70 left" while an accountability challenge is running. */
  challengeDayLabel?: string
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim()
}

export function DayHeader({
  dateLabel,
  completedTaskCount = 0,
  totalTaskCount = 0,
  streak,
  isToday,
  onPrevDay,
  onNextDay,
  onToday,
  deepWorkMinutesToday,
  challengeDayLabel,
}: DayHeaderProps) {
  const navButton =
    'touch-target flex items-center justify-center rounded-md text-share-onSurface transition-colors hover:bg-share-surfaceContainerHigh hover:text-share-primary'

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="page-title truncate">{dateLabel}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-share-onSurfaceVariant">
          {streak != null && streak > 0 && (
            <span className="flex items-center gap-1" title="Consecutive active days">
              <Flame className="h-3.5 w-3.5 shrink-0 text-share-tertiary" />
              <span className="font-medium text-share-onBg">{streak}</span>
              day streak
            </span>
          )}
          {deepWorkMinutesToday != null && deepWorkMinutesToday > 0 && (
            <span className="flex items-center gap-1" title="Deep work earned on the timer">
              <Timer className="h-3.5 w-3.5 shrink-0 text-share-primary" />
              <span className="font-medium text-share-onBg">{formatMinutes(deepWorkMinutesToday)}</span>
              deep
            </span>
          )}
          {totalTaskCount > 0 && (
            <span>
              <span className="font-medium text-share-onBg">
                {completedTaskCount}/{totalTaskCount}
              </span>{' '}
              done
            </span>
          )}
          {challengeDayLabel && (
            <Link
              to="/challenge"
              className="flex items-center gap-1 text-xs hover:text-share-primary touch:-my-[14px] touch:py-[14px]"
              title="Accountability challenge"
            >
              <Flag className="h-3.5 w-3.5 shrink-0 text-share-primary" />
              <span className="font-medium text-share-onBg">{challengeDayLabel}</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer p-0.5 touch:border-0 touch:bg-transparent touch:p-0">
        <button type="button" onClick={onPrevDay} aria-label="Previous day" className={navButton}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToday}
          aria-current={isToday ? 'date' : undefined}
          className={`touch-target rounded-md px-3 text-sm font-medium transition-colors hover:bg-share-primary/15 ${
            isToday ? 'text-share-primary' : 'text-share-onSurface'
          }`}
        >
          Today
        </button>
        <button type="button" onClick={onNextDay} aria-label="Next day" className={navButton}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
