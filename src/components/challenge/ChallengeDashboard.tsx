/**
 * components/challenge/ChallengeDashboard.tsx
 *
 * The challenge page once you are in one: the countdown, today for both
 * members, each member's own goals and don'ts (yours editable, theirs
 * read-only), the season so far, and the invite link while the second seat
 * is empty. A season that has ended is shown read-only: no invite, no edits,
 * no leaving; `afterCountdown` is where the page offers a new one.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { challengeDates } from '../../domain/challenge'
import { activeDonts, type DontLike } from '../../domain/challengeCommitments'
import type { ChallengeState } from '../../hooks/useChallenge'
import { useChallengeHistory } from '../../hooks/useChallenge'
import { addDays } from '../../domain/dateUtils'
import { challengeErrorMessage, createInvite, inviteUrl, leaveChallenge, shareText } from '../../services/challengeService'
import { CommitmentsSheet } from './CommitmentsSheet'
import { HistoryGrid, HistoryLegend } from './HistoryGrid'
import { MemberDayCard } from './MemberDayCard'

interface ChallengeDashboardProps {
  state: ChallengeState
  /** Shown under the countdown; the page puts "Start a new challenge" here for an ended season. */
  afterCountdown?: ReactNode
}

const card = 'rounded-2xl bg-share-surfaceContainerLow p-4'
const heading = 'overline'

/** One member's lists. Archived don'ts are history, not commitments, so they are not listed. */
function CommitmentsColumn({ title, goals, donts, empty, action }: { title: string; goals: string[]; donts: DontLike[]; empty: string; action?: ReactNode }) {
  const current = activeDonts(donts)
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className={`${heading} min-w-0 truncate`}>{title}</p>
        {action}
      </div>
      {goals.length === 0 && current.length === 0 ? (
        <p className="mt-2 text-sm text-share-onSurfaceVariant">{empty}</p>
      ) : (
        <>
          {goals.length > 0 && (
            <>
              <p className="mt-2 text-[11px] text-share-onSurfaceVariant">Goals</p>
              <ul className="mt-1 space-y-1">
                {goals.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-share-onSurface">
                    <span aria-hidden className="text-share-primary">◆</span>
                    <span className="min-w-0 break-words">{g}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {current.length > 0 && (
            <>
              <p className="mt-2 text-[11px] text-share-onSurfaceVariant">Don&rsquo;ts</p>
              <ul className="mt-1 space-y-1">
                {current.map((d) => (
                  <li key={d.id} className="flex gap-2 text-sm text-share-onSurface">
                    <span aria-hidden className="text-share-tertiary">✕</span>
                    <span className="min-w-0 break-words">{d.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function ChallengeDashboard({ state, afterCountdown }: ChallengeDashboardProps) {
  const { info, progress, mine, partnerCard, myDate, partnerDate } = state
  const readOnly = state.status === 'ended'
  // Each member's history runs to their own yesterday; their card is their today.
  const history = useChallengeHistory(Boolean(info), addDays(myDate, -1), addDays(partnerDate, -1))
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const dates = useMemo(() => (info ? challengeDates(info.challenge) : []), [info])
  if (!info || !progress) return null
  const { challenge, me, partner } = info
  const token = inviteToken ?? info.invite?.token ?? null

  const myRows = [...(history?.mine ?? []), ...(mine ? [mine] : [])]
  const partnerRows = [...(history?.partner ?? []), ...(partnerCard ? [partnerCard] : [])]

  const getLink = async () => {
    setError(null)
    try {
      const { token } = await createInvite()
      setInviteToken(token)
      return inviteUrl(token)
    } catch (e) {
      setError(challengeErrorMessage(e))
      return null
    }
  }
  const copyLink = async () => {
    const link = token ? inviteUrl(token) : await getLink()
    if (!link) return
    const outcome = await shareText(`Join my challenge "${challenge.name}" on Deepblock: ${link}`)
    setNotice(outcome === 'copied' ? 'Link copied — paste it into WhatsApp.' : outcome === 'shared' ? null : 'Could not copy; select the link above.')
  }
  const leave = async () => {
    if (!window.confirm(partner ? `Leave "${challenge.name}"? ${partner.displayName} keeps the challenge; your days stay recorded.` : `End "${challenge.name}"? Your days stay recorded.`)) return
    setLeaving(true)
    setError(null)
    try {
      await leaveChallenge()
    } catch (e) {
      setError(challengeErrorMessage(e))
      setLeaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Countdown */}
      <section className={`${card} text-center`}>
        <p className={heading}>{challenge.name}</p>
        {progress.phase === 'active' ? (
          <>
            <p className="stat-number mt-2 text-share-onBg">
              {progress.daysLeft}
              <span className="font-shareSans text-sm font-semibold text-share-onSurfaceVariant"> days left</span>
            </p>
            <p className="mt-1 text-sm text-share-onSurfaceVariant">
              Day {progress.dayNumber} of {progress.totalDays} · {challenge.startDate} → {challenge.endDate}
            </p>
          </>
        ) : progress.phase === 'upcoming' ? (
          <p className="mt-1 text-sm text-share-onSurfaceVariant">
            Starts {challenge.startDate} · {progress.totalDays} days
          </p>
        ) : (
          <p className="mt-1 text-sm text-share-onSurfaceVariant">Ended {challenge.endDate}. Well fought.</p>
        )}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-share-hairline" role="progressbar" aria-valuenow={progress.dayNumber} aria-valuemin={0} aria-valuemax={progress.totalDays}>
          <div className="h-full rounded-full bg-share-primary" style={{ width: `${(progress.phase === 'ended' ? 1 : progress.phase === 'upcoming' ? 0 : progress.dayNumber / progress.totalDays) * 100}%` }} />
        </div>
        {afterCountdown}
      </section>

      {/* Today, both */}
      <section className="grid gap-3 sm:grid-cols-2">
        <MemberDayCard name={me.displayName} isMe day={mine} donts={me.donts} />
        {partner ? (
          <MemberDayCard name={partner.displayName} isMe={false} day={partnerCard} donts={partner.donts} caption={partnerDate !== myDate ? partnerDate : undefined} />
        ) : readOnly ? null : (
          <div className={`${card} flex flex-col justify-center`}>
            <p className="text-sm font-semibold text-share-onBg">Invite your partner</p>
            <p className="mt-1 text-xs text-share-onSurfaceVariant">Send them this link. It works for seven days and seats one person.</p>
            {token && (
              <p className="mt-2 select-all break-all rounded-lg bg-share-hairline px-2 py-1.5 font-mono text-xs text-share-onSurface">{inviteUrl(token)}</p>
            )}
            <button type="button" onClick={() => void copyLink()} className="touch-target mt-2 rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer">
              {token ? 'Copy / share link' : 'Create invite link'}
            </button>
            {notice && (
              <p className="mt-2 text-xs text-share-onSurfaceVariant" role="status">
                {notice}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Goals and don'ts: each member's own */}
      <section className={`${card} grid gap-4 ${partner ? 'sm:grid-cols-2' : ''}`} aria-label="Goals and don'ts">
        <CommitmentsColumn
          title="Yours"
          goals={me.goals}
          donts={me.donts}
          empty="Set your goals and don’ts."
          action={
            readOnly ? undefined : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="touch-target-coarse -my-2 inline-flex shrink-0 items-center justify-center px-2 text-xs font-semibold text-share-primary hover:underline"
              >
                Edit
              </button>
            )
          }
        />
        {partner && (
          <CommitmentsColumn title={partner.displayName} goals={partner.goals} donts={partner.donts} empty={`${partner.displayName} hasn’t set theirs yet.`} />
        )}
      </section>

      {/* The season so far */}
      <section className={`${card} space-y-4`}>
        <p className={heading}>The season so far</p>
        <HistoryGrid name={me.displayName} dates={dates} rows={myRows} today={myDate} />
        {partner && <HistoryGrid name={partner.displayName} dates={dates} rows={partnerRows} today={partnerDate} />}
        <HistoryLegend />
      </section>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void leave()} disabled={leaving} className="touch-target-coarse rounded-lg px-3 py-1.5 text-xs text-share-onSurfaceVariant hover:text-share-tertiary disabled:opacity-60">
            {partner ? 'Leave challenge' : 'End challenge'}
          </button>
        </div>
      )}

      {editing && !readOnly && <CommitmentsSheet goals={me.goals} donts={me.donts} onClose={() => setEditing(false)} />}
    </div>
  )
}
