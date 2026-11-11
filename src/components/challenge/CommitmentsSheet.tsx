/**
 * components/challenge/CommitmentsSheet.tsx
 *
 * Edit your own goals and don'ts in one challenge. The other members see
 * them and cannot change them. Rewording a goal or a don't keeps it the same one;
 * removing one archives it on the server, so a day you already marked or
 * confessed to still reads right.
 */

import { useState } from 'react'
import { commitmentsToRows, rowsToCommitmentPayload, withDraft, type Commitment } from '../../domain/challengeCommitments'
import { challengeErrorMessage, updateMyCommitments } from '../../services/challengeService'
import { audienceNoun, capitalize } from '../../domain/challengeGroup'
import { ListEditor } from './ListEditor'
import type { Id } from '../../../convex/_generated/dataModel'
import { Sheet } from '../ui/Sheet'
import { ErrorLine } from '../ui/Notices'

interface CommitmentsSheetProps {
  challengeId: Id<'challenges'>
  /** Both full lists (normalized goals); only the active ones are offered for editing. */
  goals: Commitment[]
  donts: Commitment[]
  /** How many other members there are: one reads "your partner", more read "the others". */
  otherCount?: number
  onClose: () => void
}

export function CommitmentsSheet({ challengeId, goals: initialGoals, donts: initialDonts, otherCount = 1, onClose }: CommitmentsSheetProps) {
  const [goals, setGoals] = useState(() => commitmentsToRows(initialGoals))
  const [donts, setDonts] = useState(() => commitmentsToRows(initialDonts))
  const [goalDraft, setGoalDraft] = useState('')
  const [dontDraft, setDontDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateMyCommitments(challengeId, {
        goals: rowsToCommitmentPayload(withDraft(goals, goalDraft)),
        donts: rowsToCommitmentPayload(withDraft(donts, dontDraft)),
      })
      onClose()
    } catch (e) {
      setError(challengeErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="Your goals and don’ts"
      description={otherCount === 0 ? 'Anyone who joins can read these. Only you can change them.' : `${capitalize(audienceNoun(otherCount))} can read these. Only you can change them.`}
      scrollable
      action={{ label: 'Save goals and don’ts', pendingLabel: 'Saving…', pending: busy, onClick: () => void save() }}
    >
      <div className="mt-3">
        <p className="text-caption font-semibold text-share-onSurfaceVariant">Goals</p>
        <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at…" label="Add a goal" idPrefix="goal" editable onDraftChange={setGoalDraft} />
      </div>
      <div className="mt-3">
        <p className="text-caption font-semibold text-share-onSurfaceVariant">Don&rsquo;ts</p>
        <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min…" label="Add a don’t" idPrefix="dont" editable onDraftChange={setDontDraft} />
      </div>
      {error && <ErrorLine className="mt-2" message={error} />}
    </Sheet>
  )
}
