/**
 * components/challenge/ChallengeCreateForm.tsx
 *
 * Start a challenge: a name, a span, the goals, the don'ts, and the two
 * daily deadlines. The timezone is taken from the device without asking.
 */

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { addDays, todayIso } from '../../domain/dateUtils'
import { challengeErrorMessage, createChallenge } from '../../services/challengeService'

interface ChallengeCreateFormProps {
  defaultDisplayName: string
}

const input =
  'w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onSurface placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary'
const label = 'block text-xs font-medium text-share-onSurfaceVariant'

function ListEditor({ items, onChange, placeholder, idPrefix }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; idPrefix: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...items, text])
    setDraft('')
  }
  return (
    <div className="mt-1 space-y-1">
      {items.map((item, i) => (
        <div key={`${idPrefix}-${i}`} className="flex items-center gap-2 rounded-lg bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onSurface">
          <span className="min-w-0 flex-1 break-words">{item}</span>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="touch-target-coarse shrink-0 rounded p-0.5 text-share-onSurfaceVariant hover:text-red-400"
            aria-label={`Remove "${item}"`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {items.length < 10 && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            maxLength={200}
            placeholder={placeholder}
            className={input}
            aria-label={placeholder}
          />
          <button type="button" onClick={add} className="touch-target-coarse shrink-0 rounded-lg border border-share-outlineVariant/40 px-3 text-sm text-share-onSurface hover:bg-share-surfaceContainerHigh">
            Add
          </button>
        </div>
      )}
    </div>
  )
}

export function ChallengeCreateForm({ defaultDisplayName }: ChallengeCreateFormProps) {
  const today = todayIso()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 89))
  const [goals, setGoals] = useState<string[]>([])
  const [donts, setDonts] = useState<string[]>([])
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
      await createChallenge({ name, startDate, endDate, goals, donts, planDeadline, checkinDeadline, displayName })
    } catch (err) {
      setError(challengeErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainer p-4">
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
        <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at" idPrefix="goal" />
      </div>

      <div>
        <p className={label}>Don&rsquo;ts</p>
        <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min" idPrefix="dont" />
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
