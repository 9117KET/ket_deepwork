/**
 * pages/AdminChallengesPage.tsx
 *
 * /admin/challenges — every challenge, read-only, for the emails in the
 * backend's `ADMIN_EMAILS`: its name, whether it runs and why it ended, its
 * span, each member with email and last activity, and any warning standing.
 * There is no admin write. Anyone else sees one sentence and a way home; the
 * list query is not even asked, and would refuse them if it were.
 */

import { useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { ChallengeChrome, ChallengeSkeleton } from '../components/challenge/ChallengeChrome'
import { textButtonClass } from '../components/ui/textButtonClass'
import { formatShortDate } from '../domain/challenge'
import type { EndedReason } from '../domain/challengeList'

const REASON: Record<EndedReason, string> = {
  creatorLeft: 'creator left',
  allLeft: 'everyone left',
  inactive: 'closed for inactivity',
  seasonOver: 'season over',
  manual: 'ended by hand',
}

function formatInstant(ms: number | null): string {
  if (ms == null) return 'never'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

export function AdminChallengesPage() {
  return (
    <ChallengeChrome wide signInTitle="Admin" signInSubtitle="Sign in with an admin account.">
      <AdminBody />
    </ChallengeChrome>
  )
}

function AdminBody() {
  const status = useQuery(api.challenges.adminStatus, {})
  const rows = useQuery(api.challenges.adminListChallenges, status?.isAdmin ? {} : 'skip')

  if (status === undefined) return <ChallengeSkeleton />
  if (!status.isAdmin) {
    return (
      <div>
        <h1 className="font-shareHeadline text-title text-share-onBg">Not an admin</h1>
        <p className="mt-2 text-body text-share-onSurfaceVariant">This page lists every challenge, so it is only open to the app&rsquo;s admins.</p>
        <Link to="/" className={textButtonClass('default', '-ml-3 mt-2')}>
          Back to today
        </Link>
      </div>
    )
  }
  if (rows === undefined) return <ChallengeSkeleton rows={5} />

  return (
    <div>
      <h1 className="font-shareHeadline text-title text-share-onBg">All challenges</h1>
      <p className="mt-1 text-sm text-share-onSurfaceVariant">
        {rows.length} {rows.length === 1 ? 'challenge' : 'challenges'}, newest first. Read-only.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-body text-share-onSurfaceVariant">Nobody has started a challenge yet.</p>
      ) : (
        // The table scrolls inside its own box on a phone; the page never does.
        <div className="mt-4 overflow-x-auto rounded-2xl bg-share-surfaceContainerLow" tabIndex={0} aria-label="All challenges, scrolls sideways">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-share-hairline text-caption text-share-onSurfaceVariant">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Span
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Members
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Warning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-share-hairline align-top">
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="max-w-[14rem] break-words px-4 py-3 font-semibold text-share-onBg">
                    {r.name}
                  </th>
                  <td className="px-4 py-3 text-share-onSurface">
                    {r.status === 'active' ? 'Running' : `Ended${r.endedReason ? `, ${REASON[r.endedReason]}` : ''}`}
                    {r.endedAt != null && <span className="block text-caption text-share-onSurfaceVariant">{formatInstant(r.endedAt)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-share-onSurface">
                    {formatShortDate(r.startDate)} to {formatShortDate(r.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1.5">
                      {r.members.map((m, i) => (
                        <li key={i}>
                          <span className="font-semibold text-share-onSurface">{m.displayName}</span>
                          {m.isCreator && <span className="text-share-onSurfaceVariant"> (creator)</span>}
                          <span className="block break-all text-caption text-share-onSurfaceVariant">{m.email ?? 'no email'}</span>
                          <span className="block text-caption text-share-onSurfaceVariant">Last acted {formatInstant(m.lastActedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-share-onSurface">
                    {r.warning ? (
                      <span className="text-share-tertiary">
                        {r.warning.displayName}, missed since {formatShortDate(r.warning.missedSince)}
                      </span>
                    ) : (
                      <span className="text-share-onSurfaceVariant">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
