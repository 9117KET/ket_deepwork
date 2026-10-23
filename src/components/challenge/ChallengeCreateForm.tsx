/**
 * components/challenge/ChallengeCreateForm.tsx
 *
 * Start a challenge: a name, a span, the goals, the don'ts, and the two
 * daily deadlines. The timezone is taken from the device without asking.
 */

import { useState, type FormEvent } from 'react'
import { ListEditor } from './ListEditor'
import { rowsToTexts, withDraft, type CommitmentRow } from '../../domain/challengeCommitments'
import { addDays, todayIso } from '../../domain/dateUtils'
import { challengeErrorMessage, createChallenge } from '../../services/challengeService'

interface ChallengeCreateFormProps {
  defaultDisplayName: string
}

const input =
  'min-h-[44px] w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface sm:text-sm placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary'
const label = 'block text-xs font-medium text-share-onSurfaceVariant'

export function ChallengeCreateForm({ defaultDisplayName }: ChallengeCreateFormProps) {
  const today = todayIso()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 89))
  const [goals, setGoals] = useState<CommitmentRow[]>([])
  const [donts, setDonts] = useState<CommitmentRow[]>([])
  const [goalDraft, setGoalDraft] = useState('')
  const [dontDraft, setDontDraft] = useState('')
  const [planDeadline, setPlanDeadline] = useState('10:00')
  const [checkinDeadline, setCheckinDeadline] = useState('23:59')
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createChallenge({ name, startDate, endDate, goals: rowsToTexts(withDraft(goals, goalDraft)), donts: rowsToTexts(withDraft(donts, dontDraft)), planDeadline, checkinDeadline, displayName })
    } catch (err) {
      setError(challengeErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-2xl bg-share-surfaceContainerLow p-4">
      <div>
        <h2 className="font-shareHeadline text-lg font-black text-share-onBg">Start a challenge</h2>
        <p className="mt-0.5 text-xs text-share-onSurfaceVariant">
          You and one partner. Each day: lock in your plan by the morning deadline, check in by night. Your planner stays private; your partner sees a summary.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="ch-name">
          Name
        </label>
        <input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Q4 push" className={`${input} mt-1`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="ch-start">
            Starts
          </label>
          <input id="ch-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={`${input} mt-1`} />
        </div>
        <div>
          <label className={label} htmlFor="ch-end">
            Ends
          </label>
          <input id="ch-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required className={`${input} mt-1`} />
        </div>
      </div>

      <div>
        <p className={label}>Goals</p>
        <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at" idPrefix="goal" onDraftChange={setGoalDraft} />
      </div>

      <div>
        <p className={label}>Don&rsquo;ts</p>
        <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min" idPrefix="dont" onDraftChange={setDontDraft} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="ch-plan">
            Plan by
          </label>
          <input id="ch-plan" type="time" value={planDeadline} onChange={(e) => setPlanDeadline(e.target.value)} required className={`${input} mt-1`} />
        </div>
        <div>
          <label className={label} htmlFor="ch-checkin">
            Check in by
          </label>
          <input id="ch-checkin" type="time" value={checkinDeadline} onChange={(e) => setCheckinDeadline(e.target.value)} required className={`${input} mt-1`} />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-share-onSurfaceVariant">
        Deadlines are in each person&rsquo;s own local time. Reminder emails start after the plan deadline and from 21:30 for the check-in.
      </p>

      <div>
        <label className={label} htmlFor="ch-display">
          Your name, as your partner sees it
        </label>
        <input id="ch-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required className={`${input} mt-1`} />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="touch-target w-full rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60">
        {busy ? 'Creating…' : 'Create challenge'}
      </button>
    </form>
  )
}
