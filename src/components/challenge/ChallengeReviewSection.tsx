/**
 * components/challenge/ChallengeReviewSection.tsx
 *
 * The challenge's week on Review: how many days both of you locked in, the
 * joint streak, and which don'ts you owned up to.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { bothLockedDays, jointStreak, type ChallengeDayLike } from '../../domain/challenge'
import { addDays } from '../../domain/dateUtils'
import { useChallenge, useChallengeHistory } from '../../hooks/useChallenge'

interface ChallengeReviewSectionProps {
  weekDates: string[]
  today: string
}

export function ChallengeReviewSection({ weekDates, today }: ChallengeReviewSectionProps) {
  const [openedAt] = useState(() => Date.now())
  const state = useChallenge(openedAt)
  const active = state.status === 'active'
  const weekEnd = weekDates[6]!
  const until = weekEnd < today ? weekEnd : addDays(today, -1)
  const history = useChallengeHistory(active, until)
  if (!active || !state.info) return null
  const { challenge, partner } = state.info

  const includeToday = weekDates.includes(today)
  const mine: ChallengeDayLike[] = [...(history?.mine ?? []), ...(includeToday && state.mine ? [state.mine] : [])]
  const theirs: ChallengeDayLike[] = [...(history?.partner ?? []), ...(includeToday && state.partnerCard ? [state.partnerCard] : [])]
  const inWeek = (rows: ChallengeDayLike[]) => rows.filter((r) => weekDates.includes(r.date))
  const myWeek = inWeek(mine)
  const elapsed = weekDates.filter((d) => d <= today).length
  const lockedBoth = partner ? bothLockedDays(myWeek, inWeek(theirs), weekDates) : myWeek.filter((r) => r.planSetAt).length
  const streak = partner ? jointStreak(mine, theirs, today, challenge.startDate) : 0
  const brokenIds = myWeek.flatMap((r) => r.dontsBroken ?? [])
  const brokenCounts = new Map<string, number>()
  for (const id of brokenIds) brokenCounts.set(id, (brokenCounts.get(id) ?? 0) + 1)

  return (
    <section className="mt-4 rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainer p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-share-onSurfaceVariant">{challenge.name}</p>
        <Link to="/challenge" className="text-xs font-semibold text-share-primary hover:underline">
          Open
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] text-share-onSurfaceVariant">{partner ? 'Both locked in' : 'Locked in'}</dt>
          <dd className="font-shareHeadline text-2xl font-black text-share-onBg">
            {lockedBoth}
            <span className="text-sm font-semibold text-share-onSurfaceVariant">/{elapsed}</span>
          </dd>
        </div>
        {partner && (
          <div>
            <dt className="text-[11px] text-share-onSurfaceVariant">Joint streak</dt>
            <dd className="font-shareHeadline text-2xl font-black text-share-onBg">
              {streak}
              <span className="text-sm font-semibold text-share-onSurfaceVariant"> {streak === 1 ? 'day' : 'days'}</span>
            </dd>
          </div>
        )}
      </dl>
      {challenge.donts.length > 0 && (
        <p className="mt-3 text-xs text-share-onSurfaceVariant">
          {brokenCounts.size === 0 ? (
            <span className="text-emerald-300">No don&rsquo;ts broken this week.</span>
          ) : (
            <>
              Broke:{' '}
              {[...brokenCounts.entries()].map(([id, n], i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <span className="text-amber-300">{challenge.donts.find((d) => d.id === id)?.text ?? 'a don’t'}</span>
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
