/**
 * components/challenge/CommitmentsSheet.tsx
 *
 * Edit your own goals and don'ts. Your partner sees them and cannot change
 * them. Rewording a don't keeps it the same don't; removing one archives it
 * on the server, so a day you already confessed to still reads right.
 */

import { useEffect, useState } from 'react'
import { dontsToRows, rowsToDontPayload, rowsToTexts, textsToRows, withDraft, type DontLike } from '../../domain/challengeCommitments'
import { challengeErrorMessage, updateMyCommitments } from '../../services/challengeService'
import { ListEditor } from './ListEditor'

interface CommitmentsSheetProps {
  goals: string[]
  /** The full list; only the active ones are offered for editing. */
  donts: DontLike[]
  onClose: () => void
}

export function CommitmentsSheet({ goals: initialGoals, donts: initialDonts, onClose }: CommitmentsSheetProps) {
  const [goals, setGoals] = useState(() => textsToRows(initialGoals))
  const [donts, setDonts] = useState(() => dontsToRows(initialDonts))
  const [goalDraft, setGoalDraft] = useState('')
  const [dontDraft, setDontDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateMyCommitments({ goals: rowsToTexts(withDraft(goals, goalDraft)), donts: rowsToDontPayload(withDraft(donts, dontDraft)) })
      onClose()
    } catch (e) {
      setError(challengeErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="commitments-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-4 pb-safe-nav shadow-2xl sm:rounded-2xl sm:pb-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-share-outlineVariant/50 sm:hidden" />
        <h2 id="commitments-title" className="text-base font-semibold text-share-onBg">
          Your goals and don&rsquo;ts
        </h2>
        <p className="mt-0.5 text-xs text-share-onSurfaceVariant">Your partner can read these. Only you can change them.</p>

        <div className="mt-3">
          <p className="text-xs font-medium text-share-onSurfaceVariant">Goals</p>
          <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at" idPrefix="goal" editable onDraftChange={setGoalDraft} />
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-share-onSurfaceVariant">Don&rsquo;ts</p>
          <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min" idPrefix="dont" editable onDraftChange={setDontDraft} />
        </div>

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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="touch-target-coarse flex-1 rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
