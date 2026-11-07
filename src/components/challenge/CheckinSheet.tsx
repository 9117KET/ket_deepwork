/**
 * components/challenge/CheckinSheet.tsx
 *
 * The evening act, for one challenge. A line on how the day went, a tick for
 * every goal kept and every don't that slipped, and then the share step: the
 * same words, ready for WhatsApp. Checking in again later only updates the
 * note and the marks; the first time stays the time. The marks are seeded
 * from the day's row, so what the dashboard toggles already said is kept.
 */

import { useRef, useState } from 'react'
import { buildShareText, type ChallengeProgress, type ChallengeSummary } from '../../domain/challenge'
import { challengeErrorMessage, checkIn, shareText, type ShareOutcome } from '../../services/challengeService'
import { resolveDontTexts } from '../../domain/challengeCommitments'
import type { Id } from '../../../convex/_generated/dataModel'
import { Sheet, sheetPrimaryButton, sheetQuietButton } from '../ui/Sheet'
import { ErrorLine } from '../ui/Notices'

interface CheckinSheetProps {
  challengeId: Id<'challenges'>
  challengeName: string
  /** The viewer's active goals: the ones offered to say kept. */
  goals: { id: string; text: string }[]
  /** The viewer's active don'ts: the ones offered to own up to. */
  donts: { id: string; text: string }[]
  displayName: string
  progress: ChallengeProgress
  date: string
  summary: ChallengeSummary
  existing: { checkinAt?: number | null; note?: string | null; dontsBroken?: string[]; goalsKept?: string[] } | null
  onClose: () => void
}

export function CheckinSheet({ challengeId, challengeName, goals, donts, displayName, progress, date, summary, existing, onClose }: CheckinSheetProps) {
  const [note, setNote] = useState(existing?.note ?? '')
  const [broken, setBroken] = useState<Set<string>>(() => new Set(existing?.dontsBroken ?? []))
  const [kept, setKept] = useState<Set<string>>(() => new Set(existing?.goalsKept ?? []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [shared, setShared] = useState<ShareOutcome | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const editing = Boolean(existing?.checkinAt)

  const flip = (prev: Set<string>, id: string) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const toggle = (id: string) => setBroken((prev) => flip(prev, id))
  const toggleKept = (id: string) => setKept((prev) => flip(prev, id))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await checkIn(challengeId, {
        date,
        summary,
        note: note.trim() || undefined,
        dontsBroken: [...broken],
        // Only with goals on offer; left out, the day's marks stay as they were.
        ...(goals.length > 0 ? { goalsKept: [...kept] } : {}),
      })
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
      dontsBroken: resolveDontTexts([...broken], donts),
    })
    setShared(await shareText(text))
  }

  const description = `${challengeName} · Day ${progress.dayNumber} of ${progress.totalDays}`

  if (done) {
    return (
      <Sheet
        onClose={onClose}
        title="Checked in"
        description={description}
        footer={
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onClose} className={sheetQuietButton}>
              Done
            </button>
            <button type="button" onClick={() => void share()} className={sheetPrimaryButton}>
              Share
            </button>
          </div>
        }
      >
        <p className="mt-3 text-sm text-share-onSurface">Your partner can see it now. Want to send it to them too?</p>
        {shared === 'copied' && (
          <p className="mt-2 text-caption text-share-onSurfaceVariant" role="status">
            Copied. Paste it into WhatsApp.
          </p>
        )}
        {shared === 'unsupported' && <ErrorLine className="mt-2" message="Sharing is not available here. Open Deepblock on your phone to share." />}
      </Sheet>
    )
  }

  return (
    <Sheet
      onClose={onClose}
      title={editing ? 'Edit check-in' : 'Check in'}
      description={description}
      initialFocus={noteRef}
      scrollable
      action={{ label: 'Save check-in', pendingLabel: 'Saving…', pending: busy, onClick: () => void submit() }}
    >
      <label className="mt-3 block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="checkin-note">
        How did the day go? <span className="font-normal">(optional)</span>
      </label>
      <textarea
        ref={noteRef}
        id="checkin-note"
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        autoComplete="off"
        className="mt-1 min-h-[44px] w-full resize-y rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg sm:text-sm"
        placeholder="One honest line is plenty…"
      />
      {goals.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-caption font-semibold text-share-onSurfaceVariant">Which goals did you keep today?</legend>
          <div className="mt-1 space-y-1">
            {goals.map((g) => (
              <CheckRow key={g.id} name="kept" value={g.id} text={g.text} checked={kept.has(g.id)} onChange={() => toggleKept(g.id)} fill="bg-share-done" />
            ))}
          </div>
        </fieldset>
      )}
      {donts.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-caption font-semibold text-share-onSurfaceVariant">Which did you break today?</legend>
          <div className="mt-1 space-y-1">
            {donts.map((d) => (
              <CheckRow key={d.id} name="broke" value={d.id} text={d.text} checked={broken.has(d.id)} onChange={() => toggle(d.id)} fill="bg-share-tertiary" />
            ))}
          </div>
        </fieldset>
      )}
      {error && <ErrorLine className="mt-2" message={error} />}
    </Sheet>
  )
}

/**
 * One checkbox row. The whole row is the target; the native box is kept for
 * keyboard and screen readers but drawn by the span. Checked is a filled box
 * with a tick, so the state never rests on colour alone.
 */
function CheckRow({ name, value, text, checked, onChange, fill }: { name: string; value: string; text: string; checked: boolean; onChange: () => void; fill: string }) {
  return (
    <label className="relative flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-share-onSurface hover:bg-share-surfaceContainer">
      <input type="checkbox" name={name} value={value} checked={checked} onChange={onChange} className="peer absolute h-0 w-0 opacity-0" />
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-share-onBg ${
          checked ? `${fill} text-share-bg` : 'border-[1.5px] border-share-outlineStrong'
        }`}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 break-words">{text}</span>
    </label>
  )
}
