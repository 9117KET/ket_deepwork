/**
 * components/challenge/HistoryGrid.tsx
 *
 * One cell per day of the season, for one member. Both stamps, one stamp,
 * none, or not yet. Wraps rather than scrolls: at 14px a 92-day season is
 * six short rows on a phone, and the shape of a month is visible at a glance.
 */

import { dayCellState, type ChallengeDayLike, type DayCellState } from '../../domain/challenge'

const CELL: Record<DayCellState, string> = {
  both: 'bg-emerald-500',
  plan: 'bg-sky-500',
  checkin: 'bg-amber-400',
  none: 'bg-share-surfaceContainerHigh',
  future: 'bg-transparent border border-share-outlineVariant/30',
}

const LABEL: Record<DayCellState, string> = {
  both: 'plan and check-in',
  plan: 'plan only',
  checkin: 'check-in only',
  none: 'missed',
  future: 'not yet',
}

interface HistoryGridProps {
  name: string
  dates: string[]
  rows: ChallengeDayLike[]
  today: string
}

export function HistoryGrid({ name, dates, rows, today }: HistoryGridProps) {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const states = dates.map((d) => dayCellState(byDate.get(d), d, today))
  const both = states.filter((s) => s === 'both').length
  const past = states.filter((s) => s !== 'future').length
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-share-onBg">{name}</p>
        <p className="text-[11px] text-share-onSurfaceVariant">
          {both}/{past} full days
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-[3px]" role="img" aria-label={`${name}: ${both} of ${past} days with both a plan and a check-in`}>
        {dates.map((d, i) => (
          <span
            key={d}
            title={`${d}: ${LABEL[states[i]!]}`}
            className={`h-3.5 w-3.5 rounded-[3px] ${CELL[states[i]!]} ${d === today ? 'ring-1 ring-share-primary ring-offset-1 ring-offset-share-surfaceContainer' : ''}`}
          />
        ))}
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
