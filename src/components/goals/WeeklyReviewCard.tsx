/**
 * components/goals/WeeklyReviewCard.tsx
 *
 * Weekly review card (GTD weekly review + Cal Newport shutdown ritual).
 * Five questions covering deep work, the ONE Thing, habits,
 * task triage, and next week's focus. Answers auto-save on keystroke.
 * When weeklyHours and goalHours props are provided a computed stats chip
 * is shown above the first question so the user doesn't have to recall numbers.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type { WeeklyReview } from '../../domain/types'
import { AudioTextarea } from '../ui/AudioInput'

const DEFAULT_QUESTIONS = [
  'Was the High Priority block protected every day? What consistently crowded out deep work — and what will you do differently?',
  'What was this week\'s ONE Thing? Did I actually give it my best hours — or did shallow work crowd it out?',
  'Which habits held strong this week? Which broke — and what specifically caused the break?',
  'What incomplete tasks am I carrying forward intentionally, and what am I consciously dropping?',
  'What is the ONE Thing for next week that will make everything else easier or unnecessary?',
]

interface WeeklyReviewCardProps {
  dateKey: string
  questions: string[]
  review: WeeklyReview | undefined
  onUpdate: (dateKey: string, review: WeeklyReview) => void
  forceOpen?: number
  /** Auto-computed deep work hours for the week (from DeepWorkTimer sessions). */
  weeklyHours?: number
  /** Weekly deep work goal in hours. */
  goalHours?: number
}

export function WeeklyReviewCard({
  dateKey,
  questions,
  review,
  onUpdate,
  forceOpen,
  weeklyHours,
  goalHours,
}: WeeklyReviewCardProps) {
  const qs = questions.length > 0 ? questions : DEFAULT_QUESTIONS
  const answers = useMemo(() => review?.answers ?? [], [review?.answers])
  // Always start collapsed — auto-expand only via forceOpen (banner/reminder trigger)
  const [collapsed, setCollapsed] = useState(true)
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen ?? 0)
  const [draftAnswers, setDraftAnswers] = useState<string[]>(() => review?.answers ?? [])
  const [prevExternalAnswers, setPrevExternalAnswers] = useState(review?.answers)
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  if ((forceOpen ?? 0) > prevForceOpen) {
    setPrevForceOpen(forceOpen ?? 0)
    setCollapsed(false)
  }

  // Render-time sync: re-initialize draft when parent answers change (cross-device update)
  if (prevExternalAnswers !== review?.answers) {
    setPrevExternalAnswers(review?.answers)
    setDraftAnswers(review?.answers ?? [])
  }

  const handleAnswerChange = useCallback(
    (index: number, value: string) => {
      setDraftAnswers(prev => {
        const next = [...prev]
        next[index] = value
        return next
      })
      if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index])
      debounceTimers.current[index] = setTimeout(() => {
        const updated = [...answers]
        updated[index] = value
        onUpdate(dateKey, { ...review, answers: updated })
      }, 400)
    },
    [answers, dateKey, onUpdate, review],
  )

  function handleMarkComplete() {
    onUpdate(dateKey, { answers, completedAt: new Date().toISOString() })
    setCollapsed(true)
  }

  function handleReopen() {
    onUpdate(dateKey, { answers, completedAt: undefined })
    setCollapsed(false)
  }

  const isComplete = Boolean(review?.completedAt)
  const showStats = weeklyHours !== undefined && goalHours !== undefined

  return (
    <div className="mt-3 rounded border border-sky-900/40 bg-share-surfaceContainerLow p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-share-onSurfaceVariant/50">{collapsed ? '▸' : '▾'}</span>
          <span className="text-xs font-semibold text-sky-300">Weekly Review</span>
          {isComplete && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
              ✓ done
            </span>
          )}
        </div>
        {!collapsed && !isComplete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleMarkComplete() }}
            className="rounded border border-sky-700 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/20 transition-colors"
          >
            Mark complete
          </button>
        )}
        {!collapsed && isComplete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleReopen() }}
            className="rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-0.5 text-[10px] text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
          >
            Reopen
          </button>
        )}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {qs.map((question, i) => (
            <div key={i}>
              <label className="mb-1 block text-[10px] font-medium text-share-onSurfaceVariant">
                {i + 1}. {question}
              </label>
              {i === 0 && showStats && (
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-[10px] text-teal-300 ring-1 ring-teal-500/20">
                  <span>⏱</span>
                  <span>{weeklyHours!.toFixed(1)} h logged</span>
                  <span className="text-teal-500/50">·</span>
                  <span>Goal {goalHours} h</span>
                </div>
              )}
              <AudioTextarea
                value={draftAnswers[i] ?? ''}
                onChange={(v) => handleAnswerChange(i, v)}
                rows={2}
                placeholder="Your answer..."
              />
            </div>
          ))}

          {!isComplete && (
            <button
              type="button"
              onClick={handleMarkComplete}
              className="mt-1 w-full rounded border border-sky-700 bg-sky-500/10 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition-colors"
            >
              Mark weekly review complete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
