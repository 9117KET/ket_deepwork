/**
 * components/challenge/HistoryGrid.tsx
 *
 * One member's season as an ordinary calendar: Monday to Sunday across the
 * top, a row per week, the day of the month in each square and the month's
 * name in the margin on the row where it begins. Read like any wall
 * calendar, so a square's colour is never mistaken for another day's. Both
 * members' calendars use the same rows, so they read against each other.
 */

import { dayCellState, formatShortDate, seasonWeeks, type ChallengeDayLike, type DayCellState } from '../../domain/challenge'

// One accent: a full day is the act-now cyan, half a day is the same cyan
// faded, a skipped plan is the warning amber, a missed day is a hairline.
const CELL: Record<DayCellState, string> = {
  both: 'bg-share-primary text-share-onPrimary font-semibold',
  plan: 'bg-share-primary/40 text-share-onSurface',
  checkin: 'bg-share-tertiary text-share-onPrimary font-semibold',
  none: 'bg-share-hairline text-share-onSurfaceVariant',
  future: 'border border-share-outlineVariant/25 text-share-onSurfaceDim',
}

const LABEL: Record<DayCellState, string> = {
  both: 'plan and check-in',
  plan: 'plan only',
  checkin: 'check-in only',
  none: 'missed',
  future: 'not yet',
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface HistoryGridProps {
  name: string
  dates: string[]
  rows: ChallengeDayLike[]
  today: string
}

/**
 * The month to name in a week's margin: the season's first month on the
 * first row, then a month on the first row whose Monday is in it. A row that
 * merely ends on the 1st (26 Oct – 1 Nov) stays under the old month; its "1"
 * is enough. Labels sit one per row, so two can never run into each other.
 */
function monthLabel(weeks: (string | null)[][], index: number): string {
  const month = (d: string | null | undefined) => d?.slice(0, 7)
  const day = index === 0 ? weeks[0]!.find((d) => d !== null) : weeks[index]![0]
  if (!day || (index > 0 && month(day) === month(weeks[index - 1]![0] ?? weeks[index - 1]!.find((d) => d !== null)))) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

export function HistoryGrid({ name, dates, rows, today }: HistoryGridProps) {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const weeks = seasonWeeks(dates)
  const states = dates.map((d) => dayCellState(byDate.get(d), d, today))
  const both = states.filter((s) => s === 'both').length
  const past = states.filter((s) => s !== 'future').length
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-share-onBg">{name}</p>
        <p className="shrink-0 text-[11px] text-share-onSurfaceVariant">
          {both}/{past} full
        </p>
      </div>
      <div
        className="mt-2 grid max-w-[18rem] grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-[3px]"
        role="img"
        aria-label={`${name}: ${both} of ${past} days with both a plan and a check-in`}
      >
        <span aria-hidden />
        {WEEKDAYS.map((w, i) => (
          <span key={`h${i}`} className="pb-0.5 text-center text-[11px] leading-none text-share-onSurfaceDim" aria-hidden>
            {w}
          </span>
        ))}
        {weeks.map((week, wi) => [
          <span key={`m${wi}`} className="flex items-center text-[11px] leading-none text-share-onSurfaceVariant" aria-hidden>
            {monthLabel(weeks, wi)}
          </span>,
          ...week.map((d, di) => {
            if (!d) return <span key={`${wi}-${di}`} aria-hidden />
            const state = dayCellState(byDate.get(d), d, today)
            return (
              <span
                key={d}
                title={`${formatShortDate(d)}: ${LABEL[state]}`}
                className={`flex aspect-square items-center justify-center rounded-[4px] text-[11px] leading-none tabular-nums ${CELL[state]} ${
                  d === today ? 'ring-1 ring-share-onBg ring-offset-1 ring-offset-share-surfaceContainerLow' : ''
                }`}
                aria-hidden
              >
                {Number(d.slice(8))}
              </span>
            )
          }),
        ])}
      </div>
    </div>
  )
}

export function HistoryLegend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-share-onSurfaceVariant">
      {(['both', 'plan', 'checkin', 'none'] as DayCellState[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${CELL[s]}`} />
          {LABEL[s]}
        </span>
      ))}
    </p>
  )
}
