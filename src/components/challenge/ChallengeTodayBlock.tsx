/**
 * components/challenge/ChallengeTodayBlock.tsx
 *
 * Every running challenge on Today, one compact row each: its name, where
 * your partner stands (in a group, how many of the others have locked in),
 * and what you still owe. Locking in is one act for the
 * whole day (the plan is the day, whoever is watching it), so there is one
 * "Lock in today's plan" above the rows while any of them is unlocked, and it
 * locks them all. Checking in is per challenge, because the don'ts and the
 * partner differ: each row has its own.
 *
 * Today owns the full day; the dashboard owns the detail. This block only
 * answers "what do I owe, and is my partner moving".
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChallengeSummary } from '../../domain/challenge'
import { formatShortDate } from '../../domain/challenge'
import { activeCommitments, activeDonts, goalItemsOf } from '../../domain/challengeCommitments'
import { countdownLine, countdownState } from '../../domain/challengeCountdown'
import { warningSentence } from '../../domain/challengeList'
import { othersWho } from '../../domain/challengeGroup'
import { useTodayCards, type ChallengeEntry, type TodayRow } from '../../hooks/useChallenges'
import { challengeErrorMessage, lockInPlan } from '../../services/challengeService'
import { ErrorLine, WarningLine } from '../ui/Notices'
import { TextButton } from '../ui/TextButton'
import { CheckinSheet } from './CheckinSheet'

interface ChallengeTodayBlockProps {
  active: ChallengeEntry[]
  now: number
  summary: ChallengeSummary
  /** Today, the only day these acts apply to. */
  date: string
}

export function ChallengeTodayBlock({ active, now, summary, date }: ChallengeTodayBlockProps) {
  const { rows } = useTodayCards(active, now)
  const [checkinFor, setCheckinFor] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const running = rows.filter((r) => r.progress.phase === 'active')
  // Only once the rows have loaded: a button that vanishes a moment later is worse than none.
  const unlocked = running.filter((r) => r.mine !== undefined && !r.mine?.planSetAt)
  // Once every plan is locked, the next check-in owed becomes the one primary;
  // the rest keep their quiet per-row Check in. While anything is unlocked, Lock in is the primary.
  const nextCheckin = unlocked.length === 0 ? (running.find((r) => r.mine?.planSetAt && !r.mine.checkinAt) ?? null) : null
  const open = rows.find((r) => r.entry.challenge.id === checkinFor) ?? null

  const lock = async () => {
    setLocking(true)
    setError(null)
    try {
      await lockInPlan(date, summary)
    } catch (e) {
      setError(challengeErrorMessage(e))
    } finally {
      setLocking(false)
    }
  }

  if (rows.length === 0) return null

  return (
    <section aria-labelledby="today-challenges-heading" className="rounded-xl bg-share-surfaceContainerLow">
      <div className="flex items-center justify-between gap-2 pl-4 pr-1 pt-1">
        <h2 id="today-challenges-heading" className="text-sm font-bold text-share-onBg">
          {rows.length === 1 ? 'Challenge' : 'Challenges'}
        </h2>
        <Link to="/challenge" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg">
          All challenges
        </Link>
      </div>

      {unlocked.length > 0 && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => void lock()}
            disabled={locking}
            className="touch-target inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-share-primary px-4 text-sm font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-surfaceContainerLow disabled:opacity-60"
          >
            {locking ? 'Locking in…' : 'Lock in today’s plan'}
          </button>
          {running.length > 1 && (
            <p className="mt-1.5 text-caption text-share-onSurfaceVariant">One lock-in covers all {running.length} challenges.</p>
          )}
          {error && <ErrorLine className="mt-2" message={error} />}
        </div>
      )}

      {nextCheckin && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setCheckinFor(nextCheckin.entry.challenge.id)}
            className="touch-target inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-share-primary px-4 text-sm font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-surfaceContainerLow"
          >
            <span className="truncate">{running.length > 1 ? `Check in: ${nextCheckin.entry.challenge.name}` : 'Check in'}</span>
          </button>
        </div>
      )}

      <ul className="divide-y divide-share-hairline border-t border-share-hairline">
        {rows.map((row) => (
          <TodayChallengeRow
            key={row.entry.challenge.id}
            row={row}
            myDate={date}
            now={now}
            // The primary above already is this row's Check in.
            showCheckin={row !== nextCheckin}
            onCheckin={() => setCheckinFor(row.entry.challenge.id)}
          />
        ))}
      </ul>

      {open && (
        <CheckinSheet
          challengeId={open.entry.challenge.id}
          challengeName={open.entry.challenge.name}
          goals={activeCommitments(goalItemsOf(open.entry.me))}
          donts={activeDonts(open.entry.me.donts)}
          displayName={open.entry.me.displayName}
          progress={open.progress}
          date={date}
          summary={summary}
          existing={open.mine ?? null}
          otherCount={open.others.length}
          onClose={() => setCheckinFor(null)}
        />
      )}
    </section>
  )
}

function TodayChallengeRow({
  row,
  myDate,
  now,
  showCheckin,
  onCheckin,
}: {
  row: TodayRow
  myDate: string
  /** The page's minute tick: this row counts down to the minute, never the second. */
  now: number
  showCheckin: boolean
  onCheckin: () => void
}) {
  const { entry, progress, mine } = row
  const { challenge } = entry
  const loading = mine === undefined
  const running = progress.phase === 'active'
  const countdown = countdownLine(
    countdownState({
      nowMs: now,
      todayIso: myDate,
      planDeadline: challenge.planDeadline,
      checkinDeadline: challenge.checkinDeadline,
      planSetAt: mine?.planSetAt,
      checkinAt: mine?.checkinAt,
      running: challenge.status === 'active' && running,
    }),
    challenge,
    false,
  )

  let status: string
  if (countdown === null) status = progress.phase === 'upcoming' ? `Starts ${formatShortDate(challenge.startDate)}` : 'Ended'
  else if (loading) status = 'Loading…'
  else {
    // One other member: their mark, as always. A group: "3 of 5 others locked in".
    const who = othersWho({ solo: challenge.solo, others: row.others.map((o) => ({ name: o.member.displayName, day: o.day })) })
    status = [who, countdown].join(' · ')
  }

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/challenge/${challenge.id}`}
            className="block truncate rounded text-sm font-semibold text-share-onBg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
          >
            {challenge.name}
          </Link>
          <p className="mt-0.5 text-caption text-share-onSurfaceVariant">{status}</p>
        </div>
        {running && !loading && showCheckin && (
          <TextButton onClick={onCheckin} className="-mr-3 shrink-0">
            {mine?.checkinAt ? 'Edit check-in' : 'Check in'}
          </TextButton>
        )}
      </div>
      {challenge.warning && (
        <WarningLine className="mt-1.5 text-caption">
          {warningSentence(challenge.warning, entry.partner?.displayName ?? null, myDate, challenge.memberCount ?? 1 + row.others.length)}
        </WarningLine>
      )}
    </li>
  )
}
