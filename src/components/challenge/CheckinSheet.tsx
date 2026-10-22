/**
 * components/challenge/CheckinSheet.tsx
 *
 * The evening act. A line on how the day went, a tick for every don't that
 * slipped, and then the share step: the same words, ready for WhatsApp.
 * Checking in again later only updates the note and the confession; the
 * first time stays the time.
 */

import { useEffect, useState } from 'react'
import { buildShareText, type ChallengeProgress, type ChallengeSummary } from '../../domain/challenge'
import { challengeErrorMessage, checkIn, shareText, type ShareOutcome } from '../../services/challengeService'
import type { MemberDayView } from './MemberDayCard'

interface CheckinSheetProps {
  challengeName: string
  donts: { id: string; text: string }[]
  displayName: string
  progress: ChallengeProgress
  date: string
  summary: ChallengeSummary
  existing: MemberDayView | null
  onClose: () => void
}

export function CheckinSheet({ challengeName, donts, displayName, progress, date, summary, existing, onClose }: CheckinSheetProps) {
  const [note, setNote] = useState(existing?.note ?? '')
  const [broken, setBroken] = useState<Set<string>>(() => new Set(existing?.dontsBroken ?? []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [shared, setShared] = useState<ShareOutcome | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id: string) =>
    setBroken((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await checkIn({ date, summary, note: note.trim() || undefined, dontsBroken: [...broken] })
      setDone(true)
    } catch (e) {
      setError(challengeErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    const text = buildShareText({
      kind: 'checkin',
      displayName,
      progress,
      summary,
      note,
      dontsBroken: [...broken].map((id) => donts.find((d) => d.id === id)?.text ?? ''),
    })
    setShared(await shareText(text))
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-4 pb-safe-nav shadow-2xl sm:rounded-2xl sm:pb-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-share-outlineVariant/50 sm:hidden" />
        <h2 id="checkin-title" className="text-base font-semibold text-share-onBg">
          {done ? 'Checked in' : existing?.checkinAt ? 'Update your check-in' : 'Check in'}
        </h2>
        <p className="mt-0.5 text-xs text-share-onSurfaceVariant">
          {challengeName} · Day {progress.dayNumber} of {progress.totalDays}
        </p>

        {!done ? (
          <>
            <label className="mt-3 block text-xs font-medium text-share-onSurfaceVariant" htmlFor="checkin-note">
              How did the day go? <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onSurface focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
              placeholder="One honest line is plenty."
            />
            {donts.length > 0 && (
              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-share-onSurfaceVariant">Which did you break today?</legend>
                <div className="mt-1 space-y-1">
                  {donts.map((d) => (
                    <label key={d.id} className="touch-target-coarse flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-share-onSurface hover:bg-share-surfaceContainer">
                      <input
                        type="checkbox"
                        checked={broken.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="h-4 w-4 shrink-0 rounded border-share-outlineVariant/40 bg-share-surfaceContainer text-amber-400 focus:ring-amber-500"
                      />
                      <span className="min-w-0 break-words">{d.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="touch-target-coarse flex-1 rounded-lg border border-share-outlineVariant/40 px-3 py-2 text-sm text-share-onSurface hover:bg-share-surfaceContainer"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="touch-target-coarse flex-1 rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Check in'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-share-onSurface">Your partner can see it now. Want to ping them too?</p>
            {shared === 'copied' && (
              <p className="mt-2 text-xs text-emerald-300" role="status">
                Copied — paste it into WhatsApp.
              </p>
            )}
            {shared === 'unsupported' && (
              <p className="mt-2 text-xs text-amber-300" role="status">
                Sharing is not available here; open Deepblock on your phone to share.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="touch-target-coarse flex-1 rounded-lg border border-share-outlineVariant/40 px-3 py-2 text-sm text-share-onSurface hover:bg-share-surfaceContainer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="touch-target-coarse flex-1 rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer"
              >
                Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
