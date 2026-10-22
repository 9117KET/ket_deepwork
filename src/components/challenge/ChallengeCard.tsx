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

const btn =
  'touch-target-coarse inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60'
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
    <section className="rounded-xl border border-share-primary/30 bg-share-primary/5 p-3" aria-label="Accountability challenge">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-share-onSurfaceVariant">
          <Flag className="h-3.5 w-3.5 shrink-0 text-share-primary" />
          <span className="truncate font-semibold text-share-onBg">{info.challenge.name}</span>
          {progress.phase === 'active' ? (
            <span className="shrink-0">
              · Day {progress.dayNumber}/{progress.totalDays} · {progress.daysLeft} left
            </span>
          ) : progress.phase === 'upcoming' ? (
            <span className="shrink-0">· starts {info.challenge.startDate}</span>
          ) : (
            <span className="shrink-0">· ended</span>
          )}
        </p>
        {!compact && (
          <Link to="/challenge" className="shrink-0 text-xs font-semibold text-share-primary hover:underline">
            Open
          </Link>
        )}
      </div>

      {progress.phase === 'active' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {planSetAt ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
              ✓ Plan locked {formatClock(planSetAt)}
            </span>
          ) : (
            <button type="button" onClick={() => void lock()} disabled={busy === 'lock'} className={primary}>
              {busy === 'lock' ? 'Locking…' : "Lock in today's plan"}
            </button>
          )}
          {planSetAt && !checkinAt && (
            <button type="button" onClick={() => void share('plan')} className={quiet}>
              Share plan
            </button>
          )}
          {checkinAt ? (
            <>
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                ✓ Checked in {formatClock(checkinAt)}
              </span>
              <button type="button" onClick={onOpenCheckin} className={quiet}>
                Edit
              </button>
              <button type="button" onClick={() => void share('checkin')} className={quiet}>
                Share
              </button>
            </>
          ) : (
            <button type="button" onClick={onOpenCheckin} className={planSetAt ? primary : quiet}>
              Check in
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-share-onSurfaceVariant">
        {partner ? (
          <p className="min-w-0">
            <span className="font-semibold text-share-onSurface">{partner.displayName}</span>
            {partnerDate !== myDate && <span> ({partnerDate})</span>}: plan{' '}
            {partnerCard?.planSetAt ? <span className="text-emerald-300">✓ {formatClock(partnerCard.planSetAt)}</span> : '—'} · check-in{' '}
            {partnerCard?.checkinAt ? <span className="text-emerald-300">✓ {formatClock(partnerCard.checkinAt)}</span> : '—'}
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
          <button type="button" onClick={() => void nudge()} disabled={busy === 'nudge'} className={`${quiet} py-1`}>
            {busy === 'nudge' ? 'Sending…' : 'Nudge'}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-2 text-xs text-emerald-300" role="status">
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
