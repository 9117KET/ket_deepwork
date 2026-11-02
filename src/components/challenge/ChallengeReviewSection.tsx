/**
 * components/challenge/ChallengeReviewSection.tsx
 *
 * Each running challenge's week on Review, compact: two rows, you and your
 * partner, each the week's seven days as the season grid's marks (filled =
 * full day, ring = plan only, dot = check-in only, dash = missed) and a
 * count of full days; then the don'ts you owned up to.
 */

import { Link } from 'react-router-dom'
import { dayCellState, reviewWeekElapsed, type ChallengeDayLike } from '../../domain/challenge'
import { resolveDontTexts } from '../../domain/challengeCommitments'
import { addDays } from '../../domain/dateUtils'
import { useChallengeHistory, useChallenges, useTodayCards, type TodayRow } from '../../hooks/useChallenges'
import { useMinuteTick } from '../../hooks/useMinuteTick'
import { textButtonClass } from '../ui/textButtonClass'
import { DayMark } from './SeasonGrid'
import { DAY_STATE_LABEL } from '../../domain/challengeList'

interface ChallengeReviewSectionProps {
  weekDates: string[]
  today: string
}

export function ChallengeReviewSection({ weekDates, today }: ChallengeReviewSectionProps) {
  const now = useMinuteTick()
  const { active } = useChallenges()
  const { rows } = useTodayCards(active, now)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="review-challenges" className="mt-4 rounded-2xl bg-share-surfaceContainerLow px-4 pb-2 pt-4">
      <h2 id="review-challenges" className="overline">
        {rows.length === 1 ? 'Challenge this week' : 'Challenges this week'}
      </h2>
      <div className="divide-y divide-share-hairline">
        {rows.map((row) => (
          <ChallengeWeek key={row.entry.challenge.id} row={row} weekDates={weekDates} today={today} />
        ))}
      </div>
    </section>
  )
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

function ChallengeWeek({ row, weekDates, today }: { row: TodayRow; weekDates: string[]; today: string }) {
  const { entry } = row
  const { challenge, partner, me } = entry
  const weekEnd = weekDates[6]!
  const until = weekEnd < today ? weekEnd : addDays(today, -1)
  const history = useChallengeHistory(challenge.id, until)

  const includeToday = weekDates.includes(today)
  const mine: ChallengeDayLike[] = [...(history?.mine ?? []), ...(includeToday && row.mine ? [{ ...row.mine, date: today }] : [])]
  const theirs: ChallengeDayLike[] = [...(history?.partner ?? []), ...(includeToday && row.partner ? [row.partner] : [])]
  const elapsed = reviewWeekElapsed(weekDates, today, challenge)
  const inSpan = (d: string) => d >= challenge.startDate && d <= challenge.endDate

  const brokenCounts = new Map<string, number>()
  for (const r of mine.filter((r) => weekDates.includes(r.date))) {
    for (const id of r.dontsBroken ?? []) brokenCounts.set(id, (brokenCounts.get(id) ?? 0) + 1)
  }

  const weekRow = (who: string, rows: ChallengeDayLike[]) => {
    const byDate = new Map(rows.map((r) => [r.date, r]))
    const states = weekDates.map((d) => (inSpan(d) ? dayCellState(byDate.get(d), d, today) : null))
    const full = states.filter((s) => s === 'both').length
    return (
      <tr>
        <th scope="row" className="max-w-[7rem] truncate py-1.5 pr-3 text-left text-sm font-semibold text-share-onSurface">
          {who}
        </th>
        {weekDates.map((d, i) => {
          const s = states[i]
          return (
            <td key={d} className="py-1.5 text-center">
              {s ? (
                <>
                  <span className="sr-only">
                    {WEEKDAY.format(new Date(`${d}T00:00:00Z`))}: {DAY_STATE_LABEL[s]}
                  </span>
                  <span className="inline-flex">
                    <DayMark state={s} size={12} />
                  </span>
                </>
              ) : (
                <span className="sr-only">outside the challenge</span>
              )}
            </td>
          )
        })}
        <td className="py-1.5 pl-3 text-right text-sm tabular-nums text-share-onSurfaceVariant">
          {full}/{elapsed} full
        </td>
      </tr>
    )
  }

  return (
    <section className="py-2" aria-labelledby={`review-${challenge.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`review-${challenge.id}`} className="min-w-0 truncate text-body font-bold text-share-onBg">
          {challenge.name}
        </h3>
        <Link to={`/challenge/${challenge.id}`} className={textButtonClass('quiet', '-mr-3 shrink-0')}>
          Open
        </Link>
      </div>
      <table className="mt-1 w-full table-fixed">
        <caption className="sr-only">This week in {challenge.name}: each day for you{partner ? ` and ${partner.displayName}` : ''}</caption>
        <colgroup>
          <col className="w-20" />
          {weekDates.map((d) => (
            <col key={d} />
          ))}
          <col className="w-16" />
        </colgroup>
        <tbody>
          {weekRow('You', mine)}
          {partner && weekRow(partner.displayName, theirs)}
        </tbody>
      </table>
      {me.donts.length > 0 && (
        <p className="mt-2 text-caption text-share-onSurfaceVariant">
          {brokenCounts.size === 0 ? (
            <span>No don&rsquo;ts broken this week.</span>
          ) : (
            <>
              Broke:{' '}
              {[...brokenCounts.entries()].map(([id, n], i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <span className="text-share-tertiary">{resolveDontTexts([id], me.donts)[0]}</span>
                  {n > 1 && ` ×${n}`}
                </span>
              ))}
            </>
          )}
        </p>
      )}
    </section>
  )
}
