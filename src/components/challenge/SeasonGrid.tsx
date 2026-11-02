/**
 * components/challenge/SeasonGrid.tsx
 *
 * Both members' season on one ordinary calendar: Monday to Sunday across
 * the top, a row per week, the month's name in the margin where it begins.
 * Each day holds its number and two marks side by side, yours on the left
 * and your partner's on the right, so a day only one of you finished shows
 * at a glance and the season costs one calendar's height instead of two.
 *
 * Every state is a shape as well as a hue, so the grid reads in greyscale:
 * a full day is a filled square, a plan without a check-in a ring, a
 * check-in without a plan a dot, a missed day a dash (the warning colour),
 * and a day still to come is blank. It is a real <table>: each cell says,
 * to a screen reader, the date and both members' state in words.
 *
 * On a phone only the last two weeks show until "Whole season" is tapped;
 * from `lg` the whole season is always there.
 */

import { useState } from 'react'
import { dayCellState, formatShortDate, seasonWeeks, type ChallengeDayLike, type DayCellState } from '../../domain/challenge'
import { TextButton } from '../ui/TextButton'
import { DAY_STATE_LABEL } from '../../domain/challengeList'


/** One member's mark for one day. `size` is the box it sits in, in px. */
export function DayMark({ state, size = 14 }: { state: DayCellState; size?: number }) {
  const box = { width: size, height: size }
  if (state === 'both') return <span aria-hidden style={box} className="inline-block shrink-0 rounded-[3px] bg-share-done" />
  if (state === 'plan') return <span aria-hidden style={box} className="inline-block shrink-0 rounded-[3px] border-2 border-share-done" />
  if (state === 'checkin')
    return (
      <span aria-hidden style={box} className="inline-flex shrink-0 items-center justify-center">
        <span className="h-1.5 w-1.5 rounded-full bg-share-done" />
      </span>
    )
  if (state === 'none')
    return (
      <span aria-hidden style={box} className="inline-flex shrink-0 items-center justify-center">
        <span className="h-0.5 w-2.5 rounded-full bg-share-tertiary" />
      </span>
    )
  return <span aria-hidden style={box} className="inline-block shrink-0" />
}

const WEEKDAYS = [
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
  ['S', 'Sunday'],
] as const

interface SeasonGridProps {
  dates: string[]
  myRows: ChallengeDayLike[]
  myDate: string
  /** Absent while the second seat is empty: each day then has one mark. */
  partner?: { name: string; rows: ChallengeDayLike[]; today: string } | null
}

/**
 * The month to name in a week's margin: the season's first month on the
 * first row, then a month on the first row whose Monday is in it.
 */
function monthLabel(weeks: (string | null)[][], index: number): string {
  const month = (d: string | null | undefined) => d?.slice(0, 7)
  const day = index === 0 ? weeks[0]!.find((d) => d !== null) : weeks[index]![0]
  if (!day || (index > 0 && month(day) === month(weeks[index - 1]![0] ?? weeks[index - 1]!.find((d) => d !== null)))) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

/** The month of a week's first day, for a row that has no label of its own. */
function monthOf(week: (string | null)[]): string {
  const day = week.find((d) => d !== null)
  return day ? new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)) : ''
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
  const firstShown = Math.max(0, Math.min(current - 1, weeks.length - 2))
  const lastShown = firstShown + 1
  const collapsible = weeks.length > 2

  return (
    <div className="min-w-0">
      <table className="w-full max-w-[26rem] table-fixed border-separate border-spacing-1">
        <caption className="sr-only">
          Season calendar. Each day: {partner ? `your state, then ${partner.name}'s` : 'your state'}.
          {collapsible && !whole ? ' Only the last two weeks are listed on small screens; use Whole season for the rest.' : ''}
        </caption>
        <thead>
          <tr>
            <td className="w-9" />
            {WEEKDAYS.map(([short, long], i) => (
              <th key={i} scope="col" className="text-center text-caption font-semibold text-share-onSurfaceVariant">
                <abbr title={long} className="no-underline">
                  {short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => {
            const outside = collapsible && !whole && (wi < firstShown || wi > lastShown)
            const month = monthLabel(weeks, wi)
            // Folded to two weeks on a phone, the first row shown names its month even mid-month.
            const foldedMonth = collapsible && !whole && wi === firstShown && !month ? monthOf(week) : ''
            return (
              <tr key={wi} className={outside ? 'hidden lg:table-row' : ''}>
                <th scope="row" className="pr-1 text-left text-caption font-semibold text-share-onSurfaceVariant">
                  <span aria-hidden>
                    {month}
                    {foldedMonth && <span className="lg:hidden">{foldedMonth}</span>}
                  </span>
                  <span className="sr-only">Week of {formatShortDate(week.find((d) => d !== null)!)}</span>
                </th>
                {week.map((d, di) => {
                  if (!d) return <td key={`${wi}-${di}`} />
                  const mineState = dayCellState(mine.get(d), d, myDate)
                  const theirState = partner ? dayCellState(theirs.get(d), d, partner.today) : null
                  const isToday = d === myDate
                  const spoken = partner
                    ? `${formatShortDate(d)}${isToday ? ', today' : ''}: you ${DAY_STATE_LABEL[mineState]}, ${partner.name} ${DAY_STATE_LABEL[theirState!]}`
                    : `${formatShortDate(d)}${isToday ? ', today' : ''}: ${DAY_STATE_LABEL[mineState]}`
                  return (
                    <td
                      key={d}
                      className={`rounded-md py-1 text-center align-top ${isToday ? 'outline outline-2 -outline-offset-1 outline-share-onBg' : ''}`}
                    >
                      <span className="sr-only">{spoken}</span>
                      <span aria-hidden className={`block text-caption tabular-nums ${isToday ? 'font-bold text-share-onBg' : 'text-share-onSurfaceVariant'}`}>
                        {Number(d.slice(8))}
                      </span>
                      <span aria-hidden className="mt-1 flex justify-center gap-0.5">
                        <DayMark state={mineState} />
                        {theirState && <DayMark state={theirState} />}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <SeasonLegend partnerName={partner?.name ?? null} />
        {collapsible && (
          <TextButton tone="quiet" onClick={() => setWhole((v) => !v)} aria-expanded={whole} className="-ml-3 lg:hidden">
            {whole ? 'Last two weeks' : 'Whole season'}
          </TextButton>
        )}
      </div>
    </div>
  )
}

export function SeasonLegend({ partnerName }: { partnerName: string | null }) {
  return (
    <div className="text-caption text-share-onSurfaceVariant">
      {partnerName && <p className="mb-1">Left mark you, right mark {partnerName}.</p>}
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Key">
        {(['both', 'plan', 'checkin', 'none'] as DayCellState[]).map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <DayMark state={s} size={12} />
            {DAY_STATE_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  )
}
