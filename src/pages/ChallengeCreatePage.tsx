/**
 * pages/ChallengeCreatePage.tsx
 *
 * /challenge/new — a challenge in two short steps instead of one long form.
 * Step 1 is what the season is: a name and a length (30, 90 or 365 days
 * from today, or your own dates), with the two daily deadlines folded away
 * under "Deadlines" at sensible defaults. Step 2 is what you are holding
 * yourself to: goals and don'ts, both optional and editable later. Your name
 * as your partner sees it defaults from the account, under "Advanced".
 * Creating opens the new challenge's dashboard. The timezone comes from the
 * device without asking.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChallengeChrome } from '../components/challenge/ChallengeChrome'
import { ListEditor } from '../components/challenge/ListEditor'
import { ErrorLine } from '../components/ui/Notices'
import { TextButton } from '../components/ui/TextButton'
import { useAuth } from '../contexts/AuthContext'
import { formatShortDate } from '../domain/challenge'
import { rowsToTexts, withDraft, type CommitmentRow } from '../domain/challengeCommitments'
import { addDays, todayIso } from '../domain/dateUtils'
import { seasonStepError, type SeasonField } from '../domain/challengeList'
import { challengeErrorMessage, createChallenge } from '../services/challengeService'

type Length = 30 | 90 | 365 | 'custom'
const LENGTHS: { value: Length; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '365 days' },
  { value: 'custom', label: 'Custom' },
]

const FIELD =
  'min-h-11 w-full rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg sm:text-sm'
const LABEL = 'block text-sm font-semibold text-share-onSurface'
const PRIMARY =
  'touch-target inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-share-primary px-4 text-body font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-bg disabled:opacity-60'
const DISCLOSURE =
  'flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-sm font-semibold text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg [&::-webkit-details-marker]:hidden'

const FIELD_ID: Record<SeasonField, string> = { end: 'ch-end', plan: 'ch-plan', checkin: 'ch-checkin' }

export function ChallengeCreatePage() {
  return (
    <ChallengeChrome signInSubtitle="Sign in to start an accountability challenge.">
      <CreateBody />
    </ChallengeChrome>
  )
}

function CreateBody() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayIso()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [length, setLength] = useState<Length>(90)
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(addDays(today, 89))
  const [planDeadline, setPlanDeadline] = useState('10:00')
  const [checkinDeadline, setCheckinDeadline] = useState('23:59')
  const [goals, setGoals] = useState<CommitmentRow[]>([])
  const [donts, setDonts] = useState<CommitmentRow[]>([])
  const [goalDraft, setGoalDraft] = useState('')
  const [dontDraft, setDontDraft] = useState('')
  // The server allows 40 characters; a long email prefix must not exceed it.
  const [displayName, setDisplayName] = useState(((user?.email ?? '').split('@')[0] || 'Me').slice(0, 40))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stepTwoHeading = useRef<HTMLHeadingElement>(null)
  const [fieldError, setFieldError] = useState<{ field: SeasonField; message: string } | null>(null)
  const [deadlinesOpen, setDeadlinesOpen] = useState(false)
  const errorFor = (field: SeasonField) => (fieldError?.field === field ? fieldError.message : null)
  const invalid = (field: SeasonField) =>
    fieldError?.field === field ? { 'aria-invalid': true as const, 'aria-describedby': `${FIELD_ID[field]}-error` } : {}

  const startDate = length === 'custom' ? customStart : today
  const endDate = length === 'custom' ? customEnd : addDays(today, length - 1)

  // Closing or reloading the tab mid-form asks first; a finished create navigates away and drops the guard.
  const dirty = name.trim() !== '' || goals.length > 0 || donts.length > 0 || goalDraft !== '' || dontDraft !== ''
  useEffect(() => {
    if (!dirty || busy) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, busy])

  const next = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problem = seasonStepError({ startDate, endDate, planDeadline, checkinDeadline })
    setFieldError(problem)
    if (problem) {
      // The deadlines live in a closed disclosure; open it so the field can take focus.
      if (problem.field !== 'end') setDeadlinesOpen(true)
      window.setTimeout(() => document.getElementById(FIELD_ID[problem.field])?.focus(), 0)
      return
    }
    setStep(2)
    // Move focus to the new step's heading so a screen reader hears where it is.
    window.setTimeout(() => stepTwoHeading.current?.focus(), 0)
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = await createChallenge({
        name,
        startDate,
        endDate,
        goals: rowsToTexts(withDraft(goals, goalDraft)),
        donts: rowsToTexts(withDraft(donts, dontDraft)),
        planDeadline,
        checkinDeadline,
        displayName,
      })
      navigate(`/challenge/${id}`, { replace: true })
    } catch (err) {
      setError(challengeErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="font-shareHeadline text-title text-share-onBg">New challenge</h1>
      <p className="mt-1 text-sm text-share-onSurfaceVariant" aria-live="polite">
        Step {step} of 2
      </p>

      {step === 1 ? (
        <form onSubmit={next} className="mt-6 space-y-6">
          <div>
            <label className={LABEL} htmlFor="ch-name">
              Name
            </label>
            <input
              id="ch-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              autoComplete="off"
              placeholder="Q4 push…"
              className={`${FIELD} mt-1.5`}
            />
          </div>

          <fieldset>
            <legend className={LABEL}>How long</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LENGTHS.map((l) => (
                <label key={l.value} className="relative">
                  <input
                    type="radio"
                    name="length"
                    value={String(l.value)}
                    checked={length === l.value}
                    onChange={() => setLength(l.value)}
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-lg border border-share-outlineStrong px-3 text-sm font-semibold text-share-onSurfaceVariant peer-checked:border-share-onBg peer-checked:bg-share-surfaceContainerHigh peer-checked:text-share-onBg peer-focus-visible:ring-2 peer-focus-visible:ring-share-onBg">
                    {l.label}
                  </span>
                </label>
              ))}
            </div>
            {length === 'custom' ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="ch-start">
                    Starts
                  </label>
                  <input id="ch-start" name="start" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} required className={`${FIELD} mt-1`} />
                </div>
                <div>
                  <label className="block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="ch-end">
                    Ends
                  </label>
                  <input
                    id="ch-end"
                    name="end"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    required
                    className={`${FIELD} mt-1`}
                    {...invalid('end')}
                  />
                </div>
                {errorFor('end') && (
                  <div id="ch-end-error" className="col-span-2">
                    <ErrorLine message={errorFor('end')!} />
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-share-onSurfaceVariant">
                Today, {formatShortDate(startDate)}, to {formatShortDate(endDate)}.
              </p>
            )}
          </fieldset>

          <details
            className="border-y border-share-hairline py-1"
            open={deadlinesOpen}
            onToggle={(e) => setDeadlinesOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className={DISCLOSURE}>
              <span>Deadlines</span>
              <span className="font-normal text-share-onSurfaceVariant">
                Plan by {planDeadline} · check in by {checkinDeadline}
              </span>
            </summary>
            <div className="grid grid-cols-2 gap-3 pb-3 pt-1">
              <div>
                <label className="block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="ch-plan">
                  Plan by
                </label>
                <input
                  id="ch-plan"
                  name="plan-by"
                  type="time"
                  value={planDeadline}
                  onChange={(e) => setPlanDeadline(e.target.value)}
                  className={`${FIELD} mt-1`}
                  {...invalid('plan')}
                />
              </div>
              <div>
                <label className="block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="ch-checkin">
                  Check in by
                </label>
                <input
                  id="ch-checkin"
                  name="check-in-by"
                  type="time"
                  value={checkinDeadline}
                  onChange={(e) => setCheckinDeadline(e.target.value)}
                  className={`${FIELD} mt-1`}
                  {...invalid('checkin')}
                />
              </div>
              {(errorFor('plan') || errorFor('checkin')) && (
                <div id={fieldError!.field === 'plan' ? 'ch-plan-error' : 'ch-checkin-error'} className="col-span-2">
                  <ErrorLine message={fieldError!.message} />
                </div>
              )}
              <p className="col-span-2 text-caption text-share-onSurfaceVariant">
                In each person&rsquo;s own local time. Reminder emails start after the plan deadline, and from 21:30 for the check-in, so the check-in deadline has to be later than 21:30.
              </p>
            </div>
          </details>

          {error && <ErrorLine message={error} />}
          <div className="flex">
            <button type="submit" className={PRIMARY}>
              Next: goals and don&rsquo;ts
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={(e) => void create(e)} className="mt-6 space-y-6">
          <div>
            <h2 ref={stepTwoHeading} tabIndex={-1} className="text-section text-share-onBg outline-none">
              What are you holding yourself to?
            </h2>
            <p className="mt-1 text-sm text-share-onSurfaceVariant">Optional. Your partner can read these, and you can change them any time.</p>
          </div>
          <div>
            <p className={LABEL}>
              Goals
            </p>
            <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at…" label="Add a goal" idPrefix="goal" onDraftChange={setGoalDraft} />
          </div>
          <div>
            <p className={LABEL}>Don&rsquo;ts</p>
            <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min…" label="Add a don’t" idPrefix="dont" onDraftChange={setDontDraft} />
          </div>

          <details className="border-y border-share-hairline py-1">
            <summary className={DISCLOSURE}>
              <span>Advanced</span>
              <span className="min-w-0 truncate font-normal text-share-onSurfaceVariant">Shown as {displayName || '…'}</span>
            </summary>
            <div className="pb-3 pt-1">
              <label className="block text-caption font-semibold text-share-onSurfaceVariant" htmlFor="ch-display">
                Your name, as your partner sees it
              </label>
              <input
                id="ch-display"
                name="display-name"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className={`${FIELD} mt-1`}
              />
            </div>
          </details>

          {error && <ErrorLine message={error} />}
          <div className="flex items-center gap-2">
            <TextButton tone="quiet" onClick={() => setStep(1)} disabled={busy}>
              Back
            </TextButton>
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? 'Creating…' : 'Create challenge'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
