/**
 * components/challenge/HistoryGrid.tsx
 *
 * One member's season as calendar weeks: a column per week, Monday at the
 * top, month names over the week a month starts in. The cells stretch to
 * fill whatever width the grid is given, so two grids side by side each use
 * half the card and a day sits in the same place in both. A season so long
 * that the cells would drop under 9px scrolls sideways instead.
 */

import { dayCellState, seasonWeeks, type ChallengeDayLike, type DayCellState } from '../../domain/challenge'

// One accent: a full day is the act-now cyan, half a day is the same cyan
// faded, a skipped plan is the warning amber, a missed day is a hairline.
const CELL: Record<DayCellState, string> = {
  both: 'bg-share-primary',
  plan: 'bg-share-primary/40',
  checkin: 'bg-share-tertiary',
  none: 'bg-share-hairline',
  future: 'border border-share-outlineVariant/25',
}

const LABEL: Record<DayCellState, string> = {
  both: 'plan and check-in',
  plan: 'plan only',
  checkin: 'check-in only',
  none: 'missed',
  future: 'not yet',
}

const WEEKDAYS = ['M', '', 'W', '', 'F', '', '']
const MIN_CELL_PX = 9

interface HistoryGridProps {
  name: string
  dates: string[]
  rows: ChallengeDayLike[]
  today: string
}

function monthLabel(week: (string | null)[], index: number): string {
  // Label the first column, and the week that holds a month's 1st.
  const first = week.find((d) => d !== null && (index === 0 || d.endsWith('-01')))
  if (!first) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${first}T00:00:00Z`))
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
      <div className="mt-2 overflow-x-auto pb-1">
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, minmax(${MIN_CELL_PX}px, 1fr))`,
            minWidth: `${16 + weeks.length * (MIN_CELL_PX + 3)}px`,
          }}
          role="img"
          aria-label={`${name}: ${both} of ${past} days with both a plan and a check-in`}
        >
          {/* Row 1: month names over their week. */}
          <span aria-hidden />
          {weeks.map((week, wi) => (
            <span key={`m${wi}`} className="h-4 overflow-visible whitespace-nowrap text-[11px] leading-none text-share-onSurfaceDim" aria-hidden>
              {monthLabel(week, wi)}
            </span>
          ))}
          {/* Rows 2–8: one per weekday, Monday first. */}
          {WEEKDAYS.map((w, di) => [
            <span key={`d${di}`} className="flex items-center pr-1 text-[11px] leading-none text-share-onSurfaceDim" aria-hidden>
              {w}
            </span>,
            ...weeks.map((week, wi) => {
              const d = week[di]
              if (!d) return <span key={`${wi}-${di}`} className="aspect-square" />
              const state = dayCellState(byDate.get(d), d, today)
              return (
                <span
                  key={d}
                  title={`${d}: ${LABEL[state]}`}
                  className={`aspect-square rounded-[3px] ${CELL[state]} ${
                    d === today ? 'ring-1 ring-share-onBg ring-offset-1 ring-offset-share-surfaceContainerLow' : ''
                  }`}
                />
              )
            }),
          ])}
        </div>
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
