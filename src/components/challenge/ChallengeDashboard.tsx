/**
 * components/challenge/ChallengeDashboard.tsx
 *
 * The challenge page once you are in one: the header (name, day, deadlines),
 * the score, today for both
 * members, each member's own goals and don'ts (yours editable, theirs
 * read-only), the season so far, and the invite link while the second seat
 * is empty. A season that has ended is shown read-only: no invite, no edits,
 * no leaving; `afterHeader` is where the page offers a new one.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { challengeDates, formatDeepMinutes, formatShortDate, jointStreak, memberSeason, type MemberSeason } from '../../domain/challenge'
import { activeDonts, type DontLike } from '../../domain/challengeCommitments'
import type { ChallengeState } from '../../hooks/useChallenge'
import { useChallengeHistory } from '../../hooks/useChallenge'
import { addDays } from '../../domain/dateUtils'
import { Pencil } from 'lucide-react'
import { challengeErrorMessage, createInvite, inviteUrl, leaveChallenge, renameChallenge, shareText } from '../../services/challengeService'
import { CommitmentsSheet } from './CommitmentsSheet'
import { HistoryGrid, HistoryLegend } from './HistoryGrid'
import { MemberDayCard } from './MemberDayCard'

interface ChallengeDashboardProps {
  state: ChallengeState
  /** Shown under the header: today's actions while running, "Start a new challenge" once ended. */
  afterHeader?: ReactNode
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

/** The season's name, renamable in place by either member while it runs. */
function ChallengeTitle({ name, editable }: { name: string; editable: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (draft === null) {
    return (
      <div className="mt-0.5 flex items-baseline gap-2">
        <h1 className="page-title min-w-0 break-words">{name}</h1>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setDraft(name)
              setError(null)
            }}
            aria-label="Rename challenge"
            className="touch-target-coarse -my-2 inline-flex shrink-0 items-center gap-1 px-1 text-xs font-semibold text-share-onSurfaceVariant hover:text-share-primary"
          >
            <Pencil aria-hidden className="h-3.5 w-3.5" />
            Rename
          </button>
        )}
      </div>
    )
  }

  const save = async () => {
    const next = draft.trim()
    if (next === name) {
      setDraft(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await renameChallenge(next)
      setDraft(null)
    } catch (e) {
      setError(challengeErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="mt-1"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null)
          }}
          aria-label="Challenge name"
          className="min-w-0 flex-1 rounded-lg border border-share-hairline bg-share-surfaceContainerLow px-3 py-1.5 text-lg font-semibold text-share-onBg focus:border-share-primary focus:outline-none"
        />
        <button type="submit" disabled={saving} className="touch-target-coarse rounded-lg bg-share-primary px-3 py-1.5 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60">
          Save
        </button>
        <button type="button" onClick={() => setDraft(null)} className="touch-target-coarse rounded-lg px-2 py-1.5 text-sm text-share-onSurfaceVariant hover:text-share-onSurface">
          Cancel
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

/** One member's numbers. The leader's full-day count takes the accent; nothing else competes for it. */
function ScoreColumn({ name, season, leads }: { name: string; season: MemberSeason; leads: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-share-onSurfaceVariant">{name}</p>
      <p className={`stat-number mt-0.5 ${leads ? 'text-share-primary' : 'text-share-onBg'}`}>
        {season.fullDays}
        <span className="font-shareSans text-sm font-semibold text-share-onSurfaceVariant">/{season.pastDays}</span>
      </p>
      <p className="text-[11px] text-share-onSurfaceVariant">full days</p>
      <p className="mt-2 text-xs text-share-onSurfaceVariant">
        <span className="font-semibold text-share-onSurface">{season.streak}</span> in a row
        {season.deepMinutes > 0 && (
          <>
            {' · '}
            <span className="font-semibold text-share-onSurface">{formatDeepMinutes(season.deepMinutes)}</span> deep
          </>
        )}
      </p>
    </div>
  )
}

export function ChallengeDashboard({ state, afterHeader }: ChallengeDashboardProps) {
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
  const mySeason = memberSeason(myRows, dates, myDate)
  const partnerSeason = partner ? memberSeason(partnerRows, dates, partnerDate) : null
  const together = partner ? jointStreak(myRows, partnerRows, myDate, challenge.startDate) : 0

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
      {/* The season: name, where today sits, and the two deadlines */}
      <header>
        <p className={heading}>Challenge{partner ? ` with ${partner.displayName}` : ''}</p>
        <ChallengeTitle name={challenge.name} editable={!readOnly} />
        <p className="mt-1 text-sm text-share-onSurfaceVariant">
          {progress.phase === 'active' ? (
            <>
              <span className="font-semibold text-share-onSurface">
                Day {progress.dayNumber} of {progress.totalDays}
              </span>{' '}
              · {progress.daysLeft === 0 ? 'last day' : `${progress.daysLeft} to go, ends ${formatShortDate(challenge.endDate)}`}
            </>
          ) : progress.phase === 'upcoming' ? (
            <>
              Starts {formatShortDate(challenge.startDate)} · {progress.totalDays} days
            </>
          ) : (
            <>
              Ended {formatShortDate(challenge.endDate)} · {progress.totalDays} days
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-share-onSurfaceDim">
          Plan by {challenge.planDeadline} · check in by {challenge.checkinDeadline}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-share-hairline" role="progressbar" aria-label="Season progress" aria-valuenow={progress.dayNumber} aria-valuemin={0} aria-valuemax={progress.totalDays}>
          <div className="h-full rounded-full bg-share-primary" style={{ width: `${(progress.phase === 'ended' ? 1 : progress.phase === 'upcoming' ? 0 : progress.dayNumber / progress.totalDays) * 100}%` }} />
        </div>
        {afterHeader && <div className="mt-4">{afterHeader}</div>}
      </header>

      {/* Score: full days, current run, deep work, for each */}
      {progress.phase !== 'upcoming' && (
        <section className={card} aria-label="Score">
          <div className="flex items-baseline justify-between gap-2">
            <p className={heading}>Score</p>
            {partner && (
              <p className="text-xs text-share-onSurfaceVariant">
                {together > 0 ? (
                  <>
                    Both full <span className="font-semibold text-share-primary">{together} {together === 1 ? 'day' : 'days'}</span> running
                  </>
                ) : (
                  'No shared run yet'
                )}
              </p>
            )}
          </div>
          <div className={`mt-3 grid gap-3 ${partner ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <ScoreColumn name="You" season={mySeason} leads={!!partnerSeason && mySeason.fullDays > partnerSeason.fullDays} />
            {partner && partnerSeason && (
              <ScoreColumn name={partner.displayName} season={partnerSeason} leads={partnerSeason.fullDays > mySeason.fullDays} />
            )}
          </div>
        </section>
      )}

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
        <p className={heading}>Season</p>
        {/* Side by side from sm, like the cards above: yours left, theirs right. */}
        <div className={`grid gap-5 ${partner ? 'sm:grid-cols-2' : ''}`}>
          <HistoryGrid name="You" dates={dates} rows={myRows} today={myDate} />
          {partner && <HistoryGrid name={partner.displayName} dates={dates} rows={partnerRows} today={partnerDate} />}
        </div>
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
