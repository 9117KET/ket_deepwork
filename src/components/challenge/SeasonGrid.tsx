/**
 * components/challenge/SeasonGrid.tsx
 *
 * Both members' season on one ordinary calendar: Monday to Sunday across
 * the top, a row per week, the day of the month in each square and the
 * month's name in the margin on the row where it begins. Each square is
 * split down the middle, the left half yours and the right half your
 * partner's, so a day only one of you finished is visible at a glance and
 * the season costs one calendar's height instead of two.
 *
 * On a phone only the last two weeks show until "Whole season" is tapped;
 * from `lg` the whole season is always there. The rows are hidden with CSS,
 * not left unbuilt, because the grid is small and both layouts share it.
 */

import { useState } from 'react'
import { dayCellState, formatShortDate, seasonWeeks, type ChallengeDayLike, type DayCellState } from '../../domain/challenge'

// One accent: a full day is the act-now cyan, a plan without a check-in the
// same cyan faded, a check-in without a plan an outline of it. A missed day
// is the warning amber, faded; a day still to come is a hairline.
const HALF: Record<DayCellState, string> = {
  both: 'bg-share-primary',
  plan: 'bg-share-primary/40',
  checkin: 'shadow-[inset_0_0_0_1.5px_#00daf3]',
  none: 'bg-share-tertiary/45',
  future: 'bg-share-hairline',
}

const LABEL: Record<DayCellState, string> = {
  both: 'plan and check-in',
  plan: 'plan only',
  checkin: 'check-in only',
  none: 'missed',
  future: 'not yet',
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface SeasonGridProps {
  dates: string[]
  myRows: ChallengeDayLike[]
  myDate: string
  /** Absent while the second seat is empty: each square is then all yours. */
  partner?: { name: string; rows: ChallengeDayLike[]; today: string } | null
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

/** The week holding `today`, or the first or last week when today is outside the season. */
function currentWeekIndex(weeks: (string | null)[][], today: string): number {
  const at = weeks.findIndex((w) => w.some((d) => d === today))
  if (at >= 0) return at
  const first = weeks[0]?.find((d) => d !== null)
  return first && today < first ? 0 : weeks.length - 1
}

export function SeasonGrid({ dates, myRows, myDate, partner }: SeasonGridProps) {
  const [whole, setWhole] = useState(false)
  const mine = new Map(myRows.map((r) => [r.date, r]))
  const theirs = new Map((partner?.rows ?? []).map((r) => [r.date, r]))
  const weeks = seasonWeeks(dates)
  const current = currentWeekIndex(weeks, myDate)
  // The last two weeks: this one and the one before, or the first two before the season starts.
  const firstShown = Math.max(0, Math.min(current - 1, weeks.length - 2))
  const lastShown = firstShown + 1
  const collapsible = weeks.length > 2

  const count = (rows: Map<string, ChallengeDayLike>, today: string) => {
    const states = dates.map((d) => dayCellState(rows.get(d), d, today))
    return { full: states.filter((s) => s === 'both').length, past: states.filter((s) => s !== 'future').length }
  }
  const me = count(mine, myDate)
  const them = partner ? count(theirs, partner.today) : null
  const label = partner && them
    ? `Season: you ${me.full} of ${me.past} days full, ${partner.name} ${them.full} of ${them.past}`
    : `Season: ${me.full} of ${me.past} days with both a plan and a check-in`

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="overline">Season</p>
        <p className="text-[11px] text-share-onSurfaceDim">{partner ? 'left half you · right half them' : 'your days'}</p>
      </div>
      <div className="mt-3 max-w-[24rem]" role="img" aria-label={label}>
        <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1" aria-hidden>
          <span />
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-center text-[11px] font-bold leading-none text-share-onSurfaceDim">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const outside = collapsible && !whole && (wi < firstShown || wi > lastShown)
          return (
            <div
              key={wi}
              className={`mt-1 grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 ${outside ? 'hidden lg:grid' : 'grid'}`}
              aria-hidden
            >
              <span className="flex items-center text-[11px] font-bold leading-none text-share-onSurfaceDim">{monthLabel(weeks, wi)}</span>
              {week.map((d, di) => {
                if (!d) return <span key={`${wi}-${di}`} />
                const mineState = dayCellState(mine.get(d), d, myDate)
                const theirState = partner ? dayCellState(theirs.get(d), d, partner.today) : null
                const title = partner
                  ? `${formatShortDate(d)}: you ${LABEL[mineState]}, ${partner.name} ${LABEL[theirState!]}`
                  : `${formatShortDate(d)}: ${LABEL[mineState]}`
                return (
                  <span
                    key={d}
                    title={title}
                    className={`relative flex h-8 gap-px overflow-hidden rounded-[5px] lg:h-7 ${
                      d === myDate ? 'ring-2 ring-share-onBg ring-offset-1 ring-offset-share-surfaceContainerLow' : ''
                    }`}
                  >
                    <span className={`flex-1 ${HALF[mineState]}`} />
                    {theirState && <span className={`flex-1 ${HALF[theirState]}`} />}
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold leading-none tabular-nums text-share-onBg [text-shadow:0_0_3px_#111316,0_0_2px_#111316]">
                      {Number(d.slice(8))}
                    </span>
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SeasonLegend />
        {collapsible && (
          <button
            type="button"
            onClick={() => setWhole((v) => !v)}
            className="touch-target-coarse -my-2 inline-flex shrink-0 items-center justify-center px-1 text-xs font-semibold text-share-primary hover:underline lg:hidden"
          >
            {whole ? 'Last two weeks' : 'Whole season'}
          </button>
        )}
      </div>
    </div>
  )
}

function SeasonLegend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-share-onSurfaceVariant">
      {(['both', 'plan', 'checkin', 'none'] as DayCellState[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-[3px] ${HALF[s]}`} />
          {LABEL[s]}
        </span>
      ))}
    </p>
  )
}
