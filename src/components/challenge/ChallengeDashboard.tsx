/**
 * components/challenge/ChallengeDashboard.tsx
 *
 * The challenge page once you are in one (docs/design: "Challenge — head to
 * head"). On a desktop it is two columns: the season's header, the
 * head-to-head score and both members' today on the left; the season
 * calendar and each member's goals and don'ts in a rail on the right. On a
 * phone it is one column that leads with the partner's day, the reason the
 * page is opened, and folds your own day to one line, because Today already
 * shows it in full.
 *
 * A season that has ended is shown read-only: no rename, no invite, no
 * edits, no leaving; `afterHeader` is where the page offers a new one.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { challengeDates, formatDeepMinutes, formatShortDate, jointStreak, memberSeason, type MemberSeason } from '../../domain/challenge'
import { activeDonts, type DontLike } from '../../domain/challengeCommitments'
import type { ChallengeState } from '../../hooks/useChallenge'
import { useChallengeHistory } from '../../hooks/useChallenge'
import { addDays } from '../../domain/dateUtils'
import { challengeErrorMessage, createInvite, inviteUrl, leaveChallenge, renameChallenge, shareText } from '../../services/challengeService'
import { CommitmentsSheet } from './CommitmentsSheet'
import { SeasonGrid } from './SeasonGrid'
import { MemberDayCard, MemberDayLine } from './MemberDayCard'

interface ChallengeDashboardProps {
  state: ChallengeState
  /** Shown under the header once the season has ended: "Start a new challenge". */
  afterHeader?: ReactNode
  /** Today's acts (lock in, check in, share, nudge), shown at the head of Today while running. */
  todayActions?: ReactNode
}

const card = 'rounded-2xl bg-share-surfaceContainerLow p-4 sm:p-[18px]'
const heading = 'overline'

/** The weekday and date of an ISO day, as "Tue 27 Oct". */
function formatDayLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}

/** One member's lists as chips. Archived don'ts are history, not commitments, so they are not listed. */
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
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Goals">
              {goals.map((g, i) => (
                <li key={i} className="min-w-0 break-words rounded-full bg-share-surfaceContainer px-2.5 py-1 text-xs text-share-onSurface">
                  <span aria-hidden className="text-share-primary">◆ </span>
                  {g}
                </li>
              ))}
            </ul>
          )}
          {current.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Don'ts">
              {current.map((d) => (
                <li key={d.id} className="min-w-0 break-words rounded-full border border-share-outlineVariant px-2.5 py-1 text-xs text-share-onSurfaceVariant">
                  <span aria-hidden className="text-share-tertiary">✕ </span>
                  {d.text}
                </li>
              ))}
            </ul>
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
      <div className="mt-1 flex items-center gap-3">
        <h1 className="page-title min-w-0 break-words lg:text-[34px] lg:leading-tight">{name}</h1>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setDraft(name)
              setError(null)
            }}
            aria-label="Rename challenge"
            className="touch-target-coarse inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-share-outlineVariant px-3 text-xs font-bold text-share-onSurfaceVariant hover:border-share-primary hover:text-share-primary"
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
          className="min-w-0 flex-1 rounded-lg border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-1.5 text-lg font-semibold text-share-onBg focus:border-share-primary focus:outline-none"
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

function Avatar({ name, accent }: { name: string; accent: boolean }) {
  return (
    <span
      aria-hidden
      className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full font-shareHeadline text-lg font-extrabold sm:flex ${
        accent ? 'bg-share-primary/15 text-share-primary' : 'bg-share-surfaceContainerHigh text-share-onBg'
      }`}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  )
}

/** One side of the head-to-head. The leader's full-day count takes the accent; nothing else competes for it. */
function ScoreSide({ name, avatarName, season, leads, align, avatarAccent }: { name: string; avatarName: string; season: MemberSeason; leads: boolean; align: 'left' | 'right'; avatarAccent: boolean }) {
  const right = align === 'right'
  return (
    <div className={`flex min-w-0 items-center gap-3.5 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar name={avatarName} accent={avatarAccent} />
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-share-onSurfaceVariant sm:text-[13px]">{name}</p>
        <p className={`flex items-baseline gap-1 ${right ? 'justify-end' : ''}`}>
          <span className={`font-shareHeadline text-[32px] font-black leading-none tabular-nums sm:text-[40px] ${leads ? 'text-share-primary' : 'text-share-onBg'}`}>{season.fullDays}</span>
          <span className="text-[13px] font-bold text-share-onSurfaceDim sm:text-[15px]">
            /{season.pastDays}
            <span className="hidden sm:inline"> full</span>
          </span>
        </p>
        <p className="mt-1 text-[11px] text-share-onSurfaceVariant sm:text-xs">
          <span className="font-extrabold text-share-onSurface">{season.streak}</span> in a row
          {season.deepMinutes > 0 && (
            <span className="hidden sm:inline">
              {' · '}
              <span className="font-extrabold text-share-onSurface">{formatDeepMinutes(season.deepMinutes)}</span> deep
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export function ChallengeDashboard({ state, afterHeader, todayActions }: ChallengeDashboardProps) {
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

  const fraction = progress.phase === 'ended' ? 1 : progress.phase === 'upcoming' ? 0 : progress.dayNumber / progress.totalDays

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23.5rem] lg:items-start lg:gap-7">
      <div className="min-w-0 space-y-4">
        {/* The season: name, where today sits, and the two deadlines */}
        <header>
          <p className={heading}>Challenge{partner ? ` with ${partner.displayName}` : ''}</p>
          <ChallengeTitle name={challenge.name} editable={!readOnly} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="mr-1 text-sm text-share-onSurfaceVariant">
              {progress.phase === 'active' ? (
                <>
                  <span className="font-extrabold text-share-onSurface">
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
            <span className="inline-flex h-6 items-center rounded-full bg-share-surfaceContainer px-2.5 text-xs text-share-onSurfaceVariant">
              Plan by <span className="ml-1 font-bold text-share-onSurface">{challenge.planDeadline}</span>
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-share-surfaceContainer px-2.5 text-xs text-share-onSurfaceVariant">
              Check in by <span className="ml-1 font-bold text-share-onSurface">{challenge.checkinDeadline}</span>
            </span>
          </div>
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-share-hairline" role="progressbar" aria-label="Season progress" aria-valuenow={progress.dayNumber} aria-valuemin={0} aria-valuemax={progress.totalDays}>
            <div className="h-full rounded-full bg-share-primary" style={{ width: `${fraction * 100}%` }} />
          </div>
          {afterHeader && <div className="mt-4">{afterHeader}</div>}
        </header>

        {/* Head to head: full days, current run, deep work */}
        {progress.phase !== 'upcoming' && (
          <section aria-label="Score" className={`${card} grid items-center gap-3 sm:gap-4 ${partner && partnerSeason ? 'grid-cols-[minmax(0,1fr)_5.75rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)]' : 'grid-cols-1'}`}>
            <ScoreSide name="You" avatarName={me.displayName} season={mySeason} leads={!!partnerSeason && mySeason.fullDays > partnerSeason.fullDays} align="left" avatarAccent />
            {partner && partnerSeason && (
              <>
                <div className="border-x border-share-hairline py-1 text-center sm:py-2.5">
                  <p className="hidden text-[10px] font-extrabold tracking-[0.09em] text-share-onSurfaceDim sm:block">BOTH FULL</p>
                  <p className="font-shareHeadline text-[22px] font-black leading-tight text-share-onBg sm:text-[30px]">{together}</p>
                  <p className="text-[10px] leading-snug text-share-onSurfaceVariant sm:text-xs">
                    <span className="sm:hidden">both full in a row</span>
                    <span className="hidden sm:inline">{together === 1 ? 'day' : 'days'} running</span>
                  </p>
                </div>
                <ScoreSide name={partner.displayName} avatarName={partner.displayName} season={partnerSeason} leads={partnerSeason.fullDays > mySeason.fullDays} align="right" avatarAccent={false} />
              </>
            )}
          </section>
        )}

        {/* Today, both */}
        <section aria-label="Today" className="space-y-3">
          <p className={heading}>Today · {formatDayLabel(myDate)}</p>
          {todayActions}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Yours in full from lg, left; on a phone it folds to a line under theirs. */}
            <MemberDayCard name={me.displayName} isMe day={mine} donts={me.donts} className="hidden lg:flex" />
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
            <MemberDayLine day={mine} className="lg:hidden" />
          </div>
        </section>
      </div>

      <aside className="mt-4 min-w-0 space-y-4 lg:mt-0">
        {/* The season so far, both members in one calendar */}
        <section className={card} aria-label="Season">
          <SeasonGrid dates={dates} myRows={myRows} myDate={myDate} partner={partner ? { name: partner.displayName, rows: partnerRows, today: partnerDate } : null} />
        </section>

        {/* Goals and don'ts: each member's own */}
        <section className={`${card} space-y-3.5`} aria-label="Goals and don'ts">
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
            <div className="border-t border-share-hairline pt-3.5">
              <CommitmentsColumn title={partner.displayName} goals={partner.goals} donts={partner.donts} empty="Hasn’t set goals or don’ts yet." />
            </div>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end">
            <button type="button" onClick={() => void leave()} disabled={leaving} className="touch-target-coarse rounded-lg px-3 py-1.5 text-xs text-share-onSurfaceDim hover:text-share-tertiary disabled:opacity-60">
              {partner ? 'Leave challenge' : 'End challenge'}
            </button>
          </div>
        )}
      </aside>

      {editing && !readOnly && <CommitmentsSheet goals={me.goals} donts={me.donts} onClose={() => setEditing(false)} />}
    </div>
  )
}
