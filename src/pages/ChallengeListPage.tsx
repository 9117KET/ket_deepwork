/**
 * pages/ChallengeListPage.tsx
 *
 * /challenge — every challenge you are in, one row each. Running ones first,
 * each saying where it is in its season and where you and your partner
 * stand today; then the ended ones, each with the sentence that says how it
 * ended. A row is one tap to its dashboard. With exactly one challenge the
 * list stays (no redirect): the row is one tap, and the way to a second
 * challenge stays in view.
 *
 * With none, the page is an invitation: one sentence and the two ways in.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChallengeChrome, ChallengeSkeleton } from '../components/challenge/ChallengeChrome'
import { ChallengeJoinPanel } from '../components/challenge/ChallengeJoinPanel'
import { TextButton } from '../components/ui/TextButton'
import { formatShortDate } from '../domain/challenge'
import { daysLeftHeadline } from '../domain/challengeCountdown'
import { endedSentence, headlinePhrase, stateMark } from '../domain/challengeList'
import { todayIso } from '../domain/dateUtils'
import { useChallenges, useTodayCards, type ChallengeEntry, type TodayRow } from '../hooks/useChallenges'
import { useMinuteTick } from '../hooks/useMinuteTick'

const NEW_BUTTON =
  'touch-target inline-flex min-h-11 items-center justify-center rounded-lg bg-share-primary px-4 text-sm font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-bg'
const ROW_LINK =
  'block px-4 py-3 transition-colors hover:bg-share-surfaceContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-share-onBg'

export function ChallengeListPage() {
  return (
    <ChallengeChrome>
      <ListBody />
    </ChallengeChrome>
  )
}

function ListBody() {
  const now = useMinuteTick()
  const { status, entries, active } = useChallenges()
  const today = useTodayCards(active, now)
  const [joining, setJoining] = useState(false)
  const ended = entries.filter((e) => e.challenge.status === 'ended')

  if (status !== 'ready') return <ChallengeSkeleton />

  const actions = (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link to="/challenge/new" className={NEW_BUTTON}>
        New challenge
      </Link>
      {!joining && (
        <TextButton onClick={() => setJoining(true)}>
          Join with a link
        </TextButton>
      )}
    </div>
  )

  return (
    <div>
      <h1 className="font-shareHeadline text-title text-share-onBg">Challenges</h1>
      {entries.length === 0 && (
        <p className="mt-2 max-w-prose text-body text-share-onSurfaceVariant">
          Pick one friend and a season. Each day you lock in your plan in the morning and check in at night, and each of you sees how the other is doing.
        </p>
      )}
      {actions}
      {joining && <ChallengeJoinPanel onCancel={() => setJoining(false)} />}

      {active.length > 0 && (
        <section aria-labelledby="running-heading" className="mt-8">
          <h2 id="running-heading" className="text-section text-share-onBg">
            Running
          </h2>
          <ul className="mt-2 divide-y divide-share-hairline overflow-hidden rounded-2xl bg-share-surfaceContainerLow">
            {today.rows.map((row) => (
              <ActiveRow key={row.entry.challenge.id} row={row} />
            ))}
          </ul>
        </section>
      )}

      {ended.length > 0 && (
        <section aria-labelledby="ended-heading" className="mt-8">
          <h2 id="ended-heading" className="text-section text-share-onBg">
            Ended
          </h2>
          <ul className="mt-2 divide-y divide-share-hairline border-y border-share-hairline">
            {ended.map((entry) => (
              <EndedRow key={entry.challenge.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Mark({ who, day, loading }: { who: string; day: TodayRow['mine'] | TodayRow['partner']; loading: boolean }) {
  const mark = stateMark(day)
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${mark.done ? 'text-share-done' : 'text-share-onSurfaceVariant'}`}>
      <span aria-hidden className="font-bold">
        {loading ? '·' : mark.glyph}
      </span>
      <span className="min-w-0 truncate">
        <span className="font-semibold">{who}</span> {loading ? '' : mark.label}
      </span>
    </span>
  )
}

function ActiveRow({ row }: { row: TodayRow }) {
  const { entry, progress, mine, partner } = row
  const { challenge } = entry
  const loading = mine === undefined
  const day =
    progress.phase === 'active'
      ? `Day ${progress.dayNumber} of ${progress.totalDays} · ${headlinePhrase(daysLeftHeadline(progress, challenge, todayIso()))}`
      : progress.phase === 'upcoming'
        ? `Starts ${formatShortDate(challenge.startDate)}`
        : `Last day was ${formatShortDate(challenge.endDate)}`
  return (
    <li>
      <Link to={`/challenge/${challenge.id}`} className={ROW_LINK}>
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body font-bold text-share-onBg">{challenge.name}</span>
          {challenge.warning && (
            <span className="shrink-0 rounded-md border border-share-tertiary/60 px-2 py-0.5 text-caption font-semibold text-share-tertiary">Warning</span>
          )}
        </span>
        <span className="mt-0.5 block text-caption text-share-onSurfaceVariant">{day}</span>
        {progress.phase === 'active' && (
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Mark who="You" day={mine} loading={loading} />
            {entry.partner ? (
              <Mark who={entry.partner.displayName} day={partner} loading={loading} />
            ) : (
              <span className="text-share-onSurfaceVariant">{challenge.solo ? 'Just you' : 'Waiting for a partner'}</span>
            )}
          </span>
        )}
      </Link>
    </li>
  )
}

function EndedRow({ entry }: { entry: ChallengeEntry }) {
  const { challenge } = entry
  return (
    <li>
      <Link to={`/challenge/${challenge.id}`} className={ROW_LINK}>
        <span className="block truncate text-body font-semibold text-share-onSurface">{challenge.name}</span>
        <span className="mt-0.5 block text-caption text-share-onSurfaceVariant">
          {formatShortDate(challenge.startDate)} to {formatShortDate(challenge.endDate)}
        </span>
        <span className="mt-0.5 block text-sm text-share-onSurfaceVariant">{endedSentence(challenge, entry.partner?.displayName ?? null)}</span>
      </Link>
    </li>
  )
}
