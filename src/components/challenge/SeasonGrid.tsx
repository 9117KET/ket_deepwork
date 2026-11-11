/**
 * components/challenge/SeasonGrid.tsx
 *
 * The season on one ordinary calendar: Monday to Sunday across the top, a
 * row per week, the month's name in the margin where it begins.
 *
 * Two people (or one): each day holds its number and both marks side by
 * side, yours on the left and your partner's on the right, so a day only one
 * of you finished shows at a glance, exactly as before groups.
 *
 * A group (three to eight people): eight marks do not fit a 36px day on a
 * 320px phone, and marks shrunk to fit lose the shapes that carry the
 * meaning. So the calendar shows one member's marks at a time, at the same
 * size, and a "Marks for" menu above it picks whose (you first, then the
 * others in join order). A screen reader is not limited to the one picked:
 * each day's cell says every member's state, you first.
 *
 * Every state is a shape as well as a hue, so the grid reads in greyscale:
 * a full day is a filled square, a plan without a check-in a ring, a
 * check-in without a plan a dot, a missed day a dash (the warning colour),
 * a day the challenge spent closed a dotted outline (never "missed": it
 * counts for nobody), and a day still to come is blank.
 *
 * On a phone only the last two weeks show until "Whole season" is tapped;
 * from `lg` the whole season is always there.
 */

import { useId, useState } from 'react'
import { formatShortDate, seasonWeeks, type ChallengeDayLike } from '../../domain/challenge'
import { SEASON_STATE_LABEL, seasonCellState, type ClosedSpan, type SeasonCellState } from '../../domain/challengeGroup'
import { TextButton } from '../ui/TextButton'

/** One member's mark for one day. `size` is the box it sits in, in px. */
export function DayMark({ state, size = 14 }: { state: SeasonCellState; size?: number }) {
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
  if (state === 'closed') return <span aria-hidden style={box} data-state="closed" className="inline-block shrink-0 rounded-[3px] border border-dotted border-share-outlineStrong" />
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

/** One other member's season: keyed, named, their rows and their own today. */
export interface GridMember {
  key: string
  name: string
  rows: ChallengeDayLike[]
  today: string
}

interface SeasonGridProps {
  dates: string[]
  myRows: ChallengeDayLike[]
  myDate: string
  /** Every other member in join order; empty while nobody has joined. */
  others: GridMember[]
  /** The stretches the challenge spent closed before a reopen; shown as "closed". */
  closedSpans?: readonly ClosedSpan[]
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

const ME_KEY = 'me'

export function SeasonGrid({ dates, myRows, myDate, others, closedSpans = [] }: SeasonGridProps) {
  const [whole, setWhole] = useState(false)
  const [shownKey, setShownKey] = useState<string>(ME_KEY)
  const pickerId = useId()
  const group = others.length >= 2
  const members = [{ key: ME_KEY, name: 'You', rows: myRows, today: myDate }, ...others].map((m) => ({
    ...m,
    byDate: new Map(m.rows.map((r) => [r.date, r])),
  }))
  // A member who left since being picked falls back to you.
  const shown = members.find((m) => m.key === shownKey) ?? members[0]!
  // Two people: both marks in every cell. A group: the picked member's.
  const drawn = group ? [shown] : members
  const weeks = seasonWeeks(dates)
  const current = currentWeekIndex(weeks, myDate)
  const firstShown = Math.max(0, Math.min(current - 1, weeks.length - 2))
  const lastShown = firstShown + 1
  const collapsible = weeks.length > 2
  const hasClosed = closedSpans.length > 0
  const state = (m: (typeof members)[number], d: string) => seasonCellState(m.byDate.get(d), d, m.today, closedSpans)

  const captionWho = group
    ? `every member's state, you first; the marks show ${shown.key === ME_KEY ? 'yours' : `${shown.name}'s`}`
    : others.length === 1
      ? `your state, then ${others[0]!.name}'s`
      : 'your state'

  return (
    <div className="min-w-0">
      {group && (
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor={pickerId} className="text-caption font-semibold text-share-onSurfaceVariant">
            Marks for
          </label>
          <select
            id={pickerId}
            name="season-member"
            autoComplete="off"
            value={shown.key}
            onChange={(e) => setShownKey(e.target.value)}
            className="min-h-11 min-w-0 max-w-[14rem] truncate rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 text-base text-share-onSurface focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg sm:text-sm"
          >
            {members.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <table className="w-full max-w-[26rem] table-fixed border-separate border-spacing-1">
        <caption className="sr-only">
          Season calendar. Each day: {captionWho}.
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
                  const isToday = d === myDate
                  const head = `${formatShortDate(d)}${isToday ? ', today' : ''}`
                  // Every member is spoken, whatever the marks show.
                  const spoken =
                    members.length === 1
                      ? `${head}: ${SEASON_STATE_LABEL[state(members[0]!, d)]}`
                      : `${head}: ${members.map((m) => `${m.key === ME_KEY ? 'you' : m.name} ${SEASON_STATE_LABEL[state(m, d)]}`).join(', ')}`
                  return (
                    <td
                      key={d}
                      className={`rounded-md py-1 text-center align-top ${isToday ? 'outline outline-2 -outline-offset-1 outline-share-onBg' : ''}`}
                    >
                      <span className="sr-only">{spoken}</span>
                      <span aria-hidden className={`block text-caption tabular-nums ${isToday ? 'font-bold text-share-onBg' : 'text-share-onSurfaceVariant'}`}>
                        {Number(d.slice(8))}
                      </span>
                      <span aria-hidden data-marks className="mt-1 flex justify-center gap-0.5">
                        {drawn.map((m) => (
                          <DayMark key={m.key} state={state(m, d)} />
                        ))}
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
        <SeasonLegend partnerName={others.length === 1 ? others[0]!.name : null} showClosed={hasClosed} />
        {collapsible && (
          <TextButton tone="quiet" onClick={() => setWhole((v) => !v)} aria-expanded={whole} className="-ml-3 lg:hidden">
            {whole ? 'Last two weeks' : 'Whole season'}
          </TextButton>
        )}
      </div>
    </div>
  )
}

export function SeasonLegend({ partnerName, showClosed = false }: { partnerName: string | null; showClosed?: boolean }) {
  const states: SeasonCellState[] = ['both', 'plan', 'checkin', 'none', ...(showClosed ? (['closed'] as const) : [])]
  return (
    <div className="text-caption text-share-onSurfaceVariant">
      {partnerName && <p className="mb-1">Left mark you, right mark {partnerName}.</p>}
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Key">
        {states.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <DayMark state={s} size={12} />
            {SEASON_STATE_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  )
}
