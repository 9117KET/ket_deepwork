/**
 * components/challenge/ChallengeDetail.tsx
 *
 * One challenge's dashboard. Its first screen answers one question, "what
 * do I owe today and how is my partner doing": the header, then one Today
 * surface with your row, the single button for your next act, and your
 * partner's row. Everything else (the score, the season, the goals and
 * don'ts, leaving) comes after, un-carded, on the page itself. From `lg` the
 * season and the commitments move to a rail on the right.
 *
 * Colour discipline (scout design review, rules 2-6): cyan is spent once,
 * on the primary button; "done" is `share-done` with a ✓ or a filled shape;
 * the warning amber marks a warning, a missed day or a broken don't and
 * nothing else; there is no leader colour.
 *
 * Under the title, while the season runs or is coming, the days-left
 * headline (the one big numeral on the challenge screens) and a countdown to
 * the next thing you owe today. The countdown ticks every second only while a
 * deadline is ahead, and sits in `role="timer"` so a screen reader is never
 * read every second.
 *
 * A challenge started "Just me" has no partner talk: the partner slot is one
 * quiet "Invite a partner", and head to head is "Your season".
 *
 * Presentational: data arrives as props (the page subscribes), so the view
 * renders the same from a fixture. Writes go through the challenge service.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Pencil } from 'lucide-react'
import { buildShareText, challengeDates, formatShortDate, memberSeason, type ChallengeSummary } from '../../domain/challenge'
import { activeDonts, resolveDontTexts, type DontLike } from '../../domain/challengeCommitments'
import { countdownLine, countdownState, daysLeftHeadline, localDeadlineMs } from '../../domain/challengeCountdown'
import { endedSentence, warningSentence } from '../../domain/challengeList'
import type { ChallengeDetail as Detail, ChallengeHistory } from '../../hooks/useChallenges'
import { useMinuteTick } from '../../hooks/useMinuteTick'
import { useSecondTick } from '../../hooks/useSecondTick'
import {
  challengeErrorCode,
  challengeErrorMessage,
  createInvite,
  inviteUrl,
  isEveningIn,
  deleteChallenge,
  leaveChallenge,
  lockInPlan,
  nudgePartner,
  renameChallenge,
  shareText,
} from '../../services/challengeService'
import {
  NUDGE_MIN_GAP_MS,
  NUDGE_RULE_CODE,
  NUDGE_RULE_REFUSAL,
  nudgeAvailability,
  nudgeLabel,
  nudgeLeftCaption,
  nudgeTimes,
  partnerOwesToday,
} from '../../../convex/_shared/challengeNudges'
import type { Id } from '../../../convex/_generated/dataModel'
import { ErrorLine, WarningLine } from '../ui/Notices'
import { ActionSheet } from '../ui/Sheet'
import { TextButton } from '../ui/TextButton'
import { textButtonClass } from '../ui/textButtonClass'
import { CheckinSheet } from './CheckinSheet'
import { CommitmentsSheet } from './CommitmentsSheet'
import { MemberRow } from './MemberRow'
import { SeasonGrid } from './SeasonGrid'

interface ChallengeDetailProps {
  detail: Detail & { info: NonNullable<Detail['info']>; progress: NonNullable<Detail['progress']> }
  history: ChallengeHistory | null | undefined
  /** Today's summary from the planner, sent with a lock-in or check-in. Null while the planner loads. */
  summary: ChallengeSummary | null
  /** How many challenges are running: one lock-in covers them all. */
  activeCount: number
}

const PRIMARY =
  'touch-target inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-share-primary px-4 text-body font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-surfaceContainerLow disabled:opacity-60'
const QUIET_WIDE =
  'touch-target inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-share-outlineStrong px-4 text-body font-semibold text-share-onSurface transition-colors hover:bg-share-surfaceContainerHigh focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg'
const SECTION_HEADING = 'text-section text-share-onBg'

/** "Tue 3 Nov": the partner's date, shown only when it is not yours. */
function formatDayLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}

export function ChallengeDetail({ detail, history, summary, activeCount }: ChallengeDetailProps) {
  const navigate = useNavigate()
  const { info, progress, mine, partnerCard, myDate, partnerDate } = detail
  const { challenge, me, partner } = info
  const readOnly = detail.status === 'ended'
  const running = !readOnly && progress.phase === 'active'

  const [checkinOpen, setCheckinOpen] = useState(false)
  const [editingCommitments, setEditingCommitments] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'lock' | 'nudge'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Started "Just me" and still alone: no partner talk anywhere on the page.
  const soloAlone = challenge.solo && !partner

  const dates = useMemo(() => challengeDates(challenge), [challenge])
  const myRows = [...(history?.mine ?? []), ...(mine ? [mine] : [])]
  const partnerRows = [...(history?.partner ?? []), ...(partnerCard ? [partnerCard] : [])]
  const mySeason = memberSeason(myRows, dates, myDate)
  const partnerSeason = partner ? memberSeason(partnerRows, dates, partnerDate) : null

  // The nudge allowance, judged the way the server judges it: cap and gap on
  // my own day row, "owes" on the partner's clock and the partner's day.
  const times = nudgeTimes(mine)
  const nudgeWake = times.length > 0 ? Math.max(...times) + NUDGE_MIN_GAP_MS : null
  const planSetAt = mine?.planSetAt ?? null
  const checkinAt = mine?.checkinAt ?? null
  const deadlineArgs = {
    todayIso: myDate,
    planDeadline: challenge.planDeadline,
    checkinDeadline: challenge.checkinDeadline,
    planSetAt,
    checkinAt,
    running,
  }

  // Two minute clocks: one wakes when the nudge cool-down ends, one at the
  // check-in deadline, so the per-second tick is disarmed the moment the last
  // deadline of the day passes (a past wake is ignored).
  const nudgeNow = useMinuteTick(nudgeWake)
  const deadlineNow = useMinuteTick(running && checkinAt == null ? localDeadlineMs(myDate, challenge.checkinDeadline) : null)
  const now = Math.max(nudgeNow, deadlineNow)
  const minuteState = countdownState({ nowMs: now, ...deadlineArgs })
  // Armed only while a deadline is ahead: never for done, closed or idle.
  const secondNow = useSecondTick(minuteState.kind === 'lock' || minuteState.kind === 'checkin')
  const countdownText = countdownLine(countdownState({ nowMs: Math.max(secondNow, now), ...deadlineArgs }), challenge, true)
  const headline = daysLeftHeadline(progress, challenge, myDate)
  const partnerInSpan = partnerDate >= challenge.startDate && partnerDate <= challenge.endDate
  const partnerOwes =
    !!partner &&
    partnerInSpan &&
    partnerOwesToday({ evening: isEveningIn(partner.timezone, now), planSetAt: partnerCard?.planSetAt, checkinAt: partnerCard?.checkinAt })
  const availability = nudgeAvailability({ nowMs: now, times, partnerOwes })

  const token = inviteToken ?? info.invite?.token ?? null

  const lock = async () => {
    if (!summary) return
    setBusy('lock')
    setError(null)
    setNotice(null)
    try {
      await lockInPlan(myDate, summary)
    } catch (e) {
      setError(challengeErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const nudge = async () => {
    setBusy('nudge')
    setError(null)
    setNotice(null)
    try {
      // "Sent" means queued: the mutation schedules the email, it does not deliver it.
      const { left } = await nudgePartner(challenge.id)
      setNotice(`Nudge sent to ${partner?.displayName ?? 'your partner'}. ${left > 0 ? `${left} left today.` : 'That was the last one today.'}`)
    } catch (e) {
      const message = challengeErrorMessage(e)
      // A rule refusal (another device nudged, the partner just locked in) is a state, not a failure.
      if (challengeErrorCode(e) === NUDGE_RULE_CODE || NUDGE_RULE_REFUSAL.test(message)) setNotice(message)
      // Anything else is a failure, and it is always said, whatever the button showed.
      else setError(message)
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!summary) return
    const outcome = await shareText(
      buildShareText({
        kind: checkinAt ? 'checkin' : 'plan',
        displayName: me.displayName,
        progress,
        summary,
        note: mine?.note,
        dontsBroken: resolveDontTexts(mine?.dontsBroken ?? [], me.donts),
      }),
    )
    if (outcome === 'copied') setNotice('Copied. Paste it into WhatsApp.')
    if (outcome === 'unsupported') setError('Sharing is not available here.')
  }

  const shareInvite = async () => {
    setError(null)
    let link = token ? inviteUrl(token) : null
    if (!link) {
      try {
        const created = await createInvite(challenge.id)
        setInviteToken(created.token)
        link = inviteUrl(created.token)
      } catch (e) {
        setError(challengeErrorMessage(e))
        return
      }
    }
    const outcome = await shareText(`Join my challenge "${challenge.name}" on Deepblock: ${link}`)
    setNotice(outcome === 'copied' ? 'Link copied. Paste it into WhatsApp.' : outcome === 'unsupported' ? 'Could not copy. Select the link above.' : null)
  }

  const leave = async () => {
    setLeaving(true)
    setLeaveError(null)
    try {
      await leaveChallenge(challenge.id)
      navigate('/challenge', { replace: true })
    } catch (e) {
      setLeaveError(challengeErrorMessage(e))
      setLeaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteChallenge(challenge.id)
      navigate('/challenge', { replace: true })
    } catch (e) {
      setDeleteError(challengeErrorMessage(e))
      setDeleting(false)
    }
  }

  const nudgeText = nudgeLabel(availability, now)
  const nudgeCaption = availability.state === 'ready' || availability.state === 'cooling' ? nudgeLeftCaption(availability.left) : ''

  const meta =
    readOnly || progress.phase === 'ended'
      ? `${formatShortDate(challenge.startDate)} to ${formatShortDate(challenge.endDate)} · ${progress.totalDays} days`
      : progress.phase === 'upcoming'
        ? `Starts ${formatShortDate(challenge.startDate)} · plan by ${challenge.planDeadline} · check in by ${challenge.checkinDeadline}`
        : `Day ${progress.dayNumber} of ${progress.totalDays} · plan by ${challenge.planDeadline} · check in by ${challenge.checkinDeadline}`

  const leaveMessage = challenge.isCreator
    ? partner
      ? 'Leaving ends this challenge for both of you. Your days stay recorded.'
      : 'Leaving ends this challenge. Your days stay recorded.'
    : `${partner?.displayName ?? 'Your partner'} keeps the challenge. Your days stay recorded.`

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-10">
      <div className="min-w-0">
        <header>
          <Link to="/challenge" className={textButtonClass('quiet', '-ml-3')}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Challenges
          </Link>
          <ChallengeTitle challengeId={challenge.id} name={challenge.name} editable={!readOnly} />
          {!readOnly && (
            <div className="mt-3">
              {headline.number !== null ? (
                <p className="flex items-baseline gap-2">
                  <span className="font-shareHeadline text-numeral tabular-nums text-share-onBg">{headline.number}</span>
                  <span className="text-body text-share-onSurfaceVariant">{headline.label}</span>
                </p>
              ) : (
                <p className={SECTION_HEADING}>{headline.label}</p>
              )}
              {countdownText !== null && (
                <p role="timer" className="mt-1 text-body font-semibold tabular-nums text-share-onSurface">
                  {countdownText}
                </p>
              )}
            </div>
          )}
          <p className="mt-1 text-sm text-share-onSurfaceVariant">{meta}</p>
          {readOnly && <p className="mt-2 text-body font-semibold text-share-onSurface">{endedSentence(challenge, partner?.displayName ?? null)}</p>}
        </header>

        {!readOnly && challenge.warning && (
          <div role="status" className="mt-4 rounded-xl border border-share-tertiary/50 px-4 py-3">
            <WarningLine className="text-sm">{warningSentence(challenge.warning, partner?.displayName ?? null, myDate)}</WarningLine>
          </div>
        )}

        {/* Today: you, your next act, your partner. The only card surface on the page. */}
        {!readOnly && (
          <section aria-labelledby="today-heading" className="mt-4 rounded-2xl bg-share-surfaceContainerLow px-4">
            <h2 id="today-heading" className="sr-only">
              Today
            </h2>
            <MemberRow name={me.displayName} isMe day={mine} donts={me.donts} />

            {running ? (
              <div className="pb-4">
                {!planSetAt ? (
                  <>
                    {/* Lock in is the one primary; a check-in without a plan is allowed, so it sits beside it, quiet. */}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void lock()} disabled={busy === 'lock' || !summary} className={`${PRIMARY} flex-1`}>
                        {busy === 'lock' ? 'Locking in…' : 'Lock in today’s plan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckinOpen(true)}
                        disabled={!summary}
                        className="touch-target inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg border border-share-outlineStrong px-4 text-body font-semibold text-share-onSurface transition-colors hover:bg-share-surfaceContainerHigh focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-60"
                      >
                        {checkinAt ? 'Edit check-in' : 'Check in'}
                      </button>
                    </div>
                    {activeCount > 1 && (
                      <p className="mt-1.5 text-caption text-share-onSurfaceVariant">One lock-in covers all {activeCount} of your challenges.</p>
                    )}
                  </>
                ) : !checkinAt ? (
                  <button type="button" onClick={() => setCheckinOpen(true)} disabled={!summary} className={PRIMARY}>
                    Check in
                  </button>
                ) : (
                  <button type="button" onClick={() => setCheckinOpen(true)} disabled={!summary} className={QUIET_WIDE}>
                    Edit check-in
                  </button>
                )}
              </div>
            ) : (
              progress.phase === 'upcoming' && (
                <p className="pb-4 text-sm text-share-onSurfaceVariant">
                  The first lock-in is on {formatShortDate(challenge.startDate)}, by {challenge.planDeadline}.
                </p>
              )
            )}

            <div className="border-t border-share-hairline">
              {partner ? (
                <MemberRow
                  name={partner.displayName}
                  isMe={false}
                  day={partnerCard}
                  donts={partner.donts}
                  caption={partnerDate !== myDate ? formatDayLabel(partnerDate) : undefined}
                  actions={
                    running && (
                      <>
                        {planSetAt && (
                          <TextButton onClick={() => void share()} disabled={!summary}>
                            Share my {checkinAt ? 'check-in' : 'plan'}
                          </TextButton>
                        )}
                        {nudgeText && (
                          <TextButton onClick={() => void nudge()} disabled={busy === 'nudge' || availability.state !== 'ready'}>
                            {busy === 'nudge' ? 'Sending…' : nudgeText}
                          </TextButton>
                        )}
                        {nudgeCaption && <span className="text-caption text-share-onSurfaceVariant">{nudgeCaption}</span>}
                      </>
                    )
                  }
                />
              ) : soloAlone ? (
                // "Just me": no heading, no partner talk; one quiet way to invite someone.
                <div className="py-2">
                  <div className="-ml-3 flex flex-wrap items-center gap-x-1">
                    {running && planSetAt && (
                      <TextButton onClick={() => void share()} disabled={!summary}>
                        Share my {checkinAt ? 'check-in' : 'plan'}
                      </TextButton>
                    )}
                    <TextButton tone="quiet" aria-expanded={inviteOpen} aria-controls="solo-invite" onClick={() => setInviteOpen((o) => !o)}>
                      Invite a partner
                    </TextButton>
                  </div>
                  <div id="solo-invite" hidden={!inviteOpen} className="pb-2">
                    {token && <p className="mt-1 select-all break-all rounded-lg bg-share-hairline px-3 py-2 font-mono text-caption text-share-onSurface">{inviteUrl(token)}</p>}
                    <TextButton onClick={() => void shareInvite()} className="-ml-3 mt-1">
                      {token ? 'Share link' : 'Create invite link'}
                    </TextButton>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <h3 className="text-body font-bold text-share-onBg">Nobody has joined yet</h3>
                  <p className="mt-1 text-sm text-share-onSurfaceVariant">Send your partner a link. It works for seven days and seats one person.</p>
                  {token && <p className="mt-2 select-all break-all rounded-lg bg-share-hairline px-3 py-2 font-mono text-caption text-share-onSurface">{inviteUrl(token)}</p>}
                  <TextButton onClick={() => void shareInvite()} className="-ml-3 mt-1">
                    {token ? 'Share link' : 'Create invite link'}
                  </TextButton>
                </div>
              )}
            </div>
            {(error || notice) && (
              <div className="pb-4">
                {error && <ErrorLine message={error} />}
                {notice && (
                  <p role="status" className="text-sm text-share-onSurfaceVariant">
                    {notice}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Head to head: two numbers each, and what a full day is. Alone on "Just me", it is your season. */}
        {progress.phase !== 'upcoming' && (
          <section aria-labelledby="score-heading" className="mt-10">
            <h2 id="score-heading" className={SECTION_HEADING}>
              {soloAlone ? 'Your season' : 'Head to head'}
            </h2>
            <table className="mt-2 w-full max-w-sm text-left">
              <thead>
                <tr className="text-caption text-share-onSurfaceVariant">
                  <th scope="col" className="py-1 font-semibold">
                    <span className="sr-only">Member</span>
                  </th>
                  <th scope="col" className="py-1 text-right font-semibold">
                    Full days
                  </th>
                  <th scope="col" className="py-1 text-right font-semibold">
                    In a row
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-share-hairline">
                <ScoreRow name="You" full={mySeason.fullDays} of={mySeason.pastDays} streak={mySeason.streak} />
                {partner && partnerSeason && <ScoreRow name={partner.displayName} full={partnerSeason.fullDays} of={partnerSeason.pastDays} streak={partnerSeason.streak} />}
              </tbody>
            </table>
            <p className="mt-2 text-caption text-share-onSurfaceVariant">A full day is a locked plan and a check-in.</p>
          </section>
        )}
      </div>

      <div className="min-w-0">
        <section aria-labelledby="season-heading" className="mt-10 lg:mt-0">
          <h2 id="season-heading" className={SECTION_HEADING}>
            Season
          </h2>
          <div className="mt-2">
            <SeasonGrid
              dates={dates}
              myRows={myRows}
              myDate={myDate}
              partner={partner ? { name: partner.displayName, rows: partnerRows, today: partnerDate } : null}
            />
          </div>
        </section>

        <section aria-labelledby="commitments-heading" className="mt-10">
          <h2 id="commitments-heading" className={SECTION_HEADING}>
            Goals and don&rsquo;ts
          </h2>
          <div className="mt-2 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <Commitments
              title="Yours"
              goals={me.goals}
              donts={me.donts}
              empty="You have not set any yet."
              action={
                !readOnly && (
                  <TextButton tone="quiet" onClick={() => setEditingCommitments(true)} className="-mr-3">
                    Edit
                  </TextButton>
                )
              }
            />
            {partner && <Commitments title={`${partner.displayName}’s`} goals={partner.goals} donts={partner.donts} empty="None set yet." />}
          </div>
        </section>

        {!readOnly && (
          <div className="mt-8 border-t border-share-hairline pt-2">
            <TextButton tone="quiet" onClick={() => setLeaveOpen(true)} className="-ml-3">
              Leave challenge
            </TextButton>
          </div>
        )}
        {readOnly && challenge.isCreator && (
          <div className="mt-8 border-t border-share-hairline pt-2">
            <TextButton tone="quiet" onClick={() => setDeleteOpen(true)} className="-ml-3">
              Delete challenge
            </TextButton>
          </div>
        )}
      </div>

      {checkinOpen && summary && (
        <CheckinSheet
          challengeId={challenge.id}
          challengeName={challenge.name}
          donts={activeDonts(me.donts)}
          displayName={me.displayName}
          progress={progress}
          date={myDate}
          summary={summary}
          existing={mine}
          onClose={() => setCheckinOpen(false)}
        />
      )}
      {editingCommitments && !readOnly && (
        <CommitmentsSheet challengeId={challenge.id} goals={me.goals} donts={me.donts} onClose={() => setEditingCommitments(false)} />
      )}
      {deleteOpen && (
        <ActionSheet
          title={`Delete ${challenge.name} for good?`}
          message={`This removes the whole season, every day, check-in and note, for ${partner ? `both you and ${partner.displayName}` : 'you'}. It cannot be undone. Your planner is not touched.`}
          actionLabel="Delete for good"
          onAction={() => void remove()}
          pending={deleting}
          error={deleteError}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {leaveOpen && (
        <ActionSheet
          title={`Leave ${challenge.name}?`}
          message={leaveMessage}
          actionLabel={`Leave ${challenge.name}`}
          onAction={() => void leave()}
          pending={leaving}
          error={leaveError}
          onClose={() => setLeaveOpen(false)}
        />
      )}
    </div>
  )
}

function ScoreRow({ name, full, of, streak }: { name: string; full: number; of: number; streak: number }) {
  return (
    <tr>
      <th scope="row" className="max-w-[10rem] truncate py-2 text-body font-semibold text-share-onSurface">
        {name}
      </th>
      <td className="py-2 text-right tabular-nums">
        <span className="text-title text-share-onBg">{full}</span>
        <span className="text-sm text-share-onSurfaceVariant"> of {of}</span>
      </td>
      <td className="py-2 text-right tabular-nums">
        <span className="text-title text-share-onBg">{streak}</span>
      </td>
    </tr>
  )
}

/** One member's lists. Archived don'ts are history, not commitments, so they are not listed. */
function Commitments({ title, goals, donts, empty, action }: { title: string; goals: string[]; donts: DontLike[]; empty: string; action?: ReactNode }) {
  const current = activeDonts(donts)
  return (
    <div className="min-w-0">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-body font-bold text-share-onSurface">{title}</h3>
        {action}
      </div>
      {goals.length === 0 && current.length === 0 ? (
        <p className="text-sm text-share-onSurfaceVariant">{empty}</p>
      ) : (
        <div className="space-y-3">
          {goals.length > 0 && (
            <div>
              <h4 className="text-caption text-share-onSurfaceVariant">Goals</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-share-onSurface marker:text-share-onSurfaceDim">
                {goals.map((g, i) => (
                  <li key={i} className="break-words">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {current.length > 0 && (
            <div>
              <h4 className="text-caption text-share-onSurfaceVariant">Don&rsquo;ts</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-share-onSurface marker:text-share-onSurfaceDim">
                {current.map((d) => (
                  <li key={d.id} className="break-words">
                    {d.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** The season's name, renamable in place by either member while it runs. */
function ChallengeTitle({ challengeId, name, editable }: { challengeId: Id<'challenges'>; name: string; editable: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (draft === null) {
    return (
      <div className="mt-1 flex items-start justify-between gap-2">
        <h1 className="min-w-0 break-words font-shareHeadline text-title text-share-onBg">{name}</h1>
        {editable && (
          <TextButton
            tone="quiet"
            onClick={() => {
              setDraft(name)
              setError(null)
            }}
            aria-label="Rename challenge"
            className="-mr-3 -mt-1.5 shrink-0"
          >
            <Pencil aria-hidden className="h-4 w-4" />
            Rename
          </TextButton>
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
      await renameChallenge(challengeId, next)
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
      <label htmlFor="challenge-name" className="text-caption font-semibold text-share-onSurfaceVariant">
        Challenge name
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id="challenge-name"
          name="challenge-name"
          // The field replaces the title the user just chose to edit; focus belongs there.
          autoFocus
          autoComplete="off"
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null)
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-share-outlineStrong bg-share-surfaceContainerLow px-3 font-shareHeadline text-title text-share-onBg focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg border border-share-outlineStrong px-4 text-sm font-semibold text-share-onSurface hover:bg-share-surfaceContainerHigh focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save name'}
        </button>
        <TextButton tone="quiet" onClick={() => setDraft(null)}>
          Cancel
        </TextButton>
      </div>
      {error && <ErrorLine className="mt-1" message={error} />}
    </form>
  )
}
