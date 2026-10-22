/**
 * components/challenge/ChallengeDashboard.tsx
 *
 * The challenge page once you are in one: the countdown, today for both
 * members, the goals and don'ts, the season so far, and the invite link
 * while the second seat is empty.
 */

import { useMemo, useState } from 'react'
import { challengeDates } from '../../domain/challenge'
import type { ChallengeState } from '../../hooks/useChallenge'
import { useChallengeHistory } from '../../hooks/useChallenge'
import { addDays } from '../../domain/dateUtils'
import { challengeErrorMessage, createInvite, inviteUrl, leaveChallenge, shareText } from '../../services/challengeService'
import { HistoryGrid, HistoryLegend } from './HistoryGrid'
import { MemberDayCard } from './MemberDayCard'

interface ChallengeDashboardProps {
  state: ChallengeState
}

const card = 'rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainer p-4'
const heading = 'text-xs font-semibold uppercase tracking-wide text-share-onSurfaceVariant'

export function ChallengeDashboard({ state }: ChallengeDashboardProps) {
  const { info, progress, mine, partnerCard, myDate, partnerDate } = state
  const history = useChallengeHistory(Boolean(info), addDays(myDate, -1))
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

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
            <p className="mt-1 font-shareHeadline text-4xl font-black text-share-onBg">
              {progress.daysLeft}
              <span className="text-base font-semibold text-share-onSurfaceVariant"> days left</span>
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
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-share-surfaceContainerHigh" role="progressbar" aria-valuenow={progress.dayNumber} aria-valuemin={0} aria-valuemax={progress.totalDays}>
          <div className="h-full rounded-full bg-share-primary" style={{ width: `${(progress.phase === 'ended' ? 1 : progress.phase === 'upcoming' ? 0 : progress.dayNumber / progress.totalDays) * 100}%` }} />
        </div>
      </section>

      {/* Today, both */}
      <section className="grid gap-3 sm:grid-cols-2">
        <MemberDayCard name={me.displayName} isMe day={mine} donts={challenge.donts} />
        {partner ? (
          <MemberDayCard name={partner.displayName} isMe={false} day={partnerCard} donts={challenge.donts} caption={partnerDate !== myDate ? partnerDate : undefined} />
        ) : (
          <div className={`${card} flex flex-col justify-center`}>
            <p className="text-sm font-semibold text-share-onBg">Invite your partner</p>
            <p className="mt-1 text-xs text-share-onSurfaceVariant">Send them this link. It works for seven days and seats one person.</p>
            {token && (
              <p className="mt-2 select-all break-all rounded-lg bg-share-surfaceContainerHigh px-2 py-1.5 font-mono text-[11px] text-share-onSurface">{inviteUrl(token)}</p>
            )}
            <button type="button" onClick={() => void copyLink()} className="touch-target mt-2 rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer">
              {token ? 'Copy / share link' : 'Create invite link'}
            </button>
            {notice && (
              <p className="mt-2 text-xs text-emerald-300" role="status">
                {notice}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Goals and don'ts */}
      {(challenge.goals.length > 0 || challenge.donts.length > 0) && (
        <section className={`${card} grid gap-4 sm:grid-cols-2`}>
          {challenge.goals.length > 0 && (
            <div>
              <p className={heading}>Goals</p>
              <ul className="mt-2 space-y-1">
                {challenge.goals.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-share-onSurface">
                    <span aria-hidden className="text-share-primary">◆</span>
                    <span className="min-w-0 break-words">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {challenge.donts.length > 0 && (
            <div>
              <p className={heading}>Don&rsquo;ts</p>
              <ul className="mt-2 space-y-1">
                {challenge.donts.map((d) => (
                  <li key={d.id} className="flex gap-2 text-sm text-share-onSurface">
                    <span aria-hidden className="text-amber-400">✕</span>
                    <span className="min-w-0 break-words">{d.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

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

      <div className="flex justify-end">
        <button type="button" onClick={() => void leave()} disabled={leaving} className="touch-target-coarse rounded-lg px-3 py-1.5 text-xs text-share-onSurfaceVariant hover:text-red-400 disabled:opacity-60">
          {partner ? 'Leave challenge' : 'End challenge'}
        </button>
      </div>
    </div>
  )
}
