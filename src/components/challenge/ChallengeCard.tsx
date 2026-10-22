/**
 * components/challenge/ChallengeCard.tsx
 *
 * Today's two acts and where the partner stands, in one short card. Lock in
 * is one tap (the plan is whatever the day holds); check-in opens a sheet;
 * Share hands the same words to WhatsApp. "Nudge" sends the partner one
 * email a day, and only while they still owe the day something.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { buildShareText, formatClock, type ChallengeSummary } from '../../domain/challenge'
import type { ChallengeState } from '../../hooks/useChallenge'
import { challengeErrorMessage, lockInPlan, nudgePartner, shareText, type ShareOutcome } from '../../services/challengeService'

interface ChallengeCardProps {
  state: ChallengeState
  summary: ChallengeSummary
  date: string
  onOpenCheckin: () => void
  /** Hide the link to the challenge page when the card already sits on it. */
  compact?: boolean
}

// 44px tall everywhere: these are the card's acts, not inline links.
const btn =
  'touch-target-coarse inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60'
const primary = `${btn} bg-share-primary text-share-onPrimary hover:bg-share-primaryContainer`
const quiet = `${btn} border border-share-outlineVariant/40 text-share-onSurface hover:bg-share-surfaceContainerHigh`

export function ChallengeCard({ state, summary, date, onOpenCheckin, compact = false }: ChallengeCardProps) {
  const [busy, setBusy] = useState<null | 'lock' | 'nudge'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { info, progress, mine, partnerCard, partnerDate, myDate } = state
  if (!info || !progress) return null

  const planSetAt = mine?.planSetAt ?? null
  const checkinAt = mine?.checkinAt ?? null
  const partner = info.partner

  const run = async (kind: 'lock' | 'nudge', fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(challengeErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const lock = () => run('lock', async () => void (await lockInPlan(date, summary)))
  const nudge = () =>
    run('nudge', async () => {
      await nudgePartner()
      setNotice(`Nudged ${partner?.displayName ?? 'your partner'} by email.`)
    })
  const share = async (kind: 'plan' | 'checkin') => {
    const outcome: ShareOutcome = await shareText(
      buildShareText({
        kind,
        displayName: info.me.displayName,
        progress,
        summary,
        note: mine?.note,
        dontsBroken: (mine?.dontsBroken ?? []).map((id) => info.challenge.donts.find((d) => d.id === id)?.text ?? ''),
      }),
    )
    if (outcome === 'copied') setNotice('Copied — paste it into WhatsApp.')
    if (outcome === 'unsupported') setNotice('Sharing is not available here.')
  }

  const partnerOwes = partner ? !(partnerCard?.checkinAt || (partnerCard?.planSetAt && !isEvening())) : false

  return (
    // Three lines: the challenge and where today stands; the two acts as a
    // pair; the partner, with Nudge. The quoted-card shape from the artboards
    // (a 2px cyan rule on the left) instead of a tinted fill.
    <section
      className="rounded-xl border-l-2 border-share-primary bg-share-surfaceContainerLow p-3"
      aria-label="Accountability challenge"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-share-onSurfaceVariant">
          <Flag className="h-3.5 w-3.5 shrink-0 text-share-primary" />
          <span className="truncate font-semibold text-share-onBg">{info.challenge.name}</span>
          {progress.phase === 'active' ? (
            <span className="shrink-0">
              · Day {progress.dayNumber}/{progress.totalDays} · {progress.daysLeft} left
              {checkinAt ? (
                <span className="font-semibold text-share-primary"> · ✓ in {formatClock(checkinAt)}</span>
              ) : planSetAt ? (
                <span className="font-semibold text-share-primary"> · ✓ plan {formatClock(planSetAt)}</span>
              ) : null}
            </span>
          ) : progress.phase === 'upcoming' ? (
            <span className="shrink-0">· starts {info.challenge.startDate}</span>
          ) : (
            <span className="shrink-0">· ended</span>
          )}
        </p>
        {!compact && (
          <Link
            to="/challenge"
            className="touch-target-coarse inline-flex shrink-0 items-center justify-center text-xs font-semibold text-share-primary hover:underline"
          >
            Open
          </Link>
        )}
      </div>

      {progress.phase === 'active' && (
        <div className="mt-2 flex items-center gap-2">
          {!planSetAt ? (
            <>
              <button type="button" onClick={() => void lock()} disabled={busy === 'lock'} className={`${primary} flex-1`}>
                {busy === 'lock' ? 'Locking…' : "Lock in today's plan"}
              </button>
              <button type="button" onClick={onOpenCheckin} className={`${quiet} flex-1`}>
                Check in
              </button>
            </>
          ) : !checkinAt ? (
            <>
              <button type="button" onClick={() => void share('plan')} className={`${quiet} flex-1`}>
                Share plan
              </button>
              <button type="button" onClick={onOpenCheckin} className={`${primary} flex-1`}>
                Check in
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onOpenCheckin} className={`${quiet} flex-1`}>
                Edit check-in
              </button>
              <button type="button" onClick={() => void share('checkin')} className={`${quiet} flex-1`}>
                Share
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-share-onSurfaceVariant">
        {partner ? (
          <p className="min-w-0">
            <span className="font-semibold text-share-onSurface">{partner.displayName}</span>
            {partnerDate !== myDate && <span> ({partnerDate})</span>}: plan{' '}
            {partnerCard?.planSetAt ? <span className="text-share-primary">✓ {formatClock(partnerCard.planSetAt)}</span> : '—'} · check-in{' '}
            {partnerCard?.checkinAt ? <span className="text-share-primary">✓ {formatClock(partnerCard.checkinAt)}</span> : '—'}
          </p>
        ) : (
          <p>
            Nobody has joined yet.{' '}
            <Link to="/challenge" className="font-semibold text-share-primary hover:underline">
              Invite your partner
            </Link>
          </p>
        )}
        {partner && partnerOwes && progress.phase === 'active' && (
          <button type="button" onClick={() => void nudge()} disabled={busy === 'nudge'} className={`${quiet} shrink-0`}>
            {busy === 'nudge' ? 'Sending…' : 'Nudge'}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-share-tertiary" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-2 text-xs text-share-onSurfaceVariant" role="status">
          {notice}
        </p>
      )}
    </section>
  )
}

/** Past 21:30 on this device: the partner's evening is judged on their own clock by the server. */
function isEvening(): boolean {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes() >= 21 * 60 + 30
}
