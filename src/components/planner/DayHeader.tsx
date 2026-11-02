/**
 * components/planner/DayHeader.tsx
 *
 * One row: the date and the day stepper. Under it, one quiet status line —
 * the streak, today's earned deep work, and the day's gauge.
 *
 * The gauge is planned minutes done out of planned minutes, with both
 * endpoints in words beside the percentage: one 4h task swings the number, so
 * the denominator has to be visible. A task with no duration counts as 30m,
 * and the line says how many did. The fill only repeats the text.
 *
 * Everything else that used to live here (depth philosophy, close-day,
 * a Today/Review toggle, a full-width progress bar) cost a phone ~120px of
 * height before the first task, and none of it changed what you do next.
 */

import { Flame, Timer, Flag, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { gaugeFigures, minutesInWords, type DayCompletion } from '../../domain/dayCompletion'
import { DEFAULT_TASK_DURATION_MINUTES } from '../../domain/durations'
import { formatMinutes as formatLength } from '../../domain/taskProgress'

interface DayHeaderProps {
  dateLabel: string
  /** The day's plan in minutes; the gauge is hidden when nothing is planned. */
  completion?: DayCompletion
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

function DayGauge({ completion }: { completion: DayCompletion }) {
  const { done, planned, percent } = gaugeFigures(completion)
  const unestimated = completion.unestimatedCount
  const defaultLabel = formatLength(DEFAULT_TASK_DURATION_MINUTES)
  const valueText =
    `${minutesInWords(done)} of ${minutesInWords(planned)} done, ${percent} percent` +
    (unestimated > 0
      ? `, ${unestimated} ${unestimated === 1 ? 'task' : 'tasks'} counted as ${minutesInWords(DEFAULT_TASK_DURATION_MINUTES)}`
      : '')

  return (
    <span
      role="meter"
      aria-label="Day's plan done"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      data-testid="day-gauge"
      className="flex items-center gap-1.5"
    >
      <span aria-hidden className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-share-surfaceContainerHighest">
        <span className="block h-full rounded-full bg-share-primary" style={{ width: `${percent}%` }} />
      </span>
      <span data-testid="day-gauge-text">
        <span className="font-medium text-share-onBg">{formatLength(done)}</span> of{' '}
        <span className="font-medium text-share-onBg">{formatLength(planned)}</span> done · {percent}%
        {unestimated > 0 && (
          <>
            {' '}· {unestimated} counted as {defaultLabel}
          </>
        )}
      </span>
    </span>
  )
}

export function DayHeader({
  dateLabel,
  completion,
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
    // A grid so the status line can take the full width under the stepper on
    // a phone (where the stepper leaves the date column ~200px), and sit
    // beside it from `sm` up, as before.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
      <h2 className="page-title col-start-1 row-start-1 min-w-0 self-center truncate sm:self-start">{dateLabel}</h2>
      <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1">
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
          {completion && completion.rootCount > 0 && completion.plannedMinutes > 0 && (
            <DayGauge completion={completion} />
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

      <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-0.5 self-start sm:row-span-2 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer p-0.5 touch:border-0 touch:bg-transparent touch:p-0">
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
