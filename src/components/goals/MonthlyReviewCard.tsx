/**
 * components/goals/MonthlyReviewCard.tsx
 *
 * Monthly review card for The ONE Thing framework.
 * Shows 7 (or user-customised) review questions with free-text answer fields.
 * Answers auto-save on every keystroke (debounced).
 * "Mark complete" sets completedAt for the month.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type { MonthlyReview } from '../../domain/types'
import { todayIso } from '../../domain/dateUtils'
import { AudioTextarea } from '../ui/AudioInput'

const DEFAULT_QUESTIONS = [
  'How many hours of deep work did I log this month? Did I consistently protect my focus blocks every weekday?',
  'What was the ONE Thing that made the biggest difference this month?',
  'What is the ONE Thing for next month that will make everything else easier or unnecessary?',
  'Am I becoming the person I declared I am? Which habits held strong — and which broke, and why?',
  'Am I on track toward my 3-month goal? What is the honest gap between where I am and where I need to be?',
  'What almost hijacked my focus this month? What boundary do I need to enforce more firmly next month?',
  'What am I choosing to park — and what evidence shows it is the right call?',
  'What did I consistently underestimate or avoid this month? What does that reveal about me?',
]

interface MonthlyReviewCardProps {
  monthKey: string        // "YYYY-MM"
  questions: string[]
  review: MonthlyReview | undefined
  onUpdate: (monthKey: string, review: MonthlyReview) => void
  /** Increment to force-expand the card (e.g. when scrolled to from a banner). */
  forceOpen?: number
}

export function MonthlyReviewCard({ monthKey, questions, review, onUpdate, forceOpen }: MonthlyReviewCardProps) {
  const qs = questions.length > 0 ? questions : DEFAULT_QUESTIONS
  const answers = useMemo(() => review?.answers ?? [], [review?.answers])
  // Always start collapsed — auto-expand only via forceOpen (banner/reminder trigger)
  const [collapsed, setCollapsed] = useState(true)
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen ?? 0)
  const [draftAnswers, setDraftAnswers] = useState<string[]>(() => review?.answers ?? [])
  const [prevExternalAnswers, setPrevExternalAnswers] = useState(review?.answers)

  // React's render-time state sync: expand the card whenever forceOpen increments
  if ((forceOpen ?? 0) > prevForceOpen) {
    setPrevForceOpen(forceOpen ?? 0)
    setCollapsed(false)
  }

  // Render-time sync: re-initialize draft when parent answers change (cross-device update)
  if (prevExternalAnswers !== review?.answers) {
    setPrevExternalAnswers(review?.answers)
    setDraftAnswers(review?.answers ?? [])
  }

  // Debounce ref per question
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const handleAnswerChange = useCallback(
    (index: number, value: string) => {
      setDraftAnswers(prev => {
        const next = [...prev]
        next[index] = value
        return next
      })
      if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index])
      debounceTimers.current[index] = setTimeout(() => {
        const updatedAnswers = [...answers]
        updatedAnswers[index] = value
        onUpdate(monthKey, { ...review, answers: updatedAnswers })
      }, 400)
    },
    [answers, monthKey, onUpdate, review],
  )

  function handleMarkComplete() {
    onUpdate(monthKey, { answers, completedAt: new Date().toISOString() })
    setCollapsed(true)
  }

  function handleReopen() {
    onUpdate(monthKey, { answers, completedAt: undefined })
    setCollapsed(false)
  }

  const isComplete = Boolean(review?.completedAt)

  return (
    <div className="mt-3 rounded border border-amber-900/40 bg-share-surfaceContainerLow p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-share-onSurfaceVariant/50">{collapsed ? '▸' : '▾'}</span>
          <span className="text-xs font-semibold text-amber-300">Monthly Review</span>
          {isComplete && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
              ✓ done
            </span>
          )}
        </div>
        {!collapsed && !isComplete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMarkComplete() }}
            className="rounded border border-amber-700 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            Mark complete
          </button>
        )}
        {!collapsed && isComplete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleReopen() }}
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
              className="mt-1 w-full rounded border border-amber-700 bg-amber-500/10 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              Mark review complete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Banner shown in the last 3 days of the month prompting the user to complete
 * (or revisit) their monthly review before the month ends.
 */
interface MonthlyReviewBannerProps {
  monthKey: string
  review: MonthlyReview | undefined
  onScrollToReview: () => void
}

export function MonthlyReviewBanner({ monthKey, review, onScrollToReview }: MonthlyReviewBannerProps) {
  const today = todayIso()
  const currentMonthKey = today.slice(0, 7)
  if (currentMonthKey !== monthKey) return null

  // Show during the last 3 days of the current month only
  const [year, month] = today.split('-').map(Number)
  const lastDay = new Date(year!, month!, 0).getDate()
  const currentDay = Number(today.slice(8, 10))
  if (currentDay < lastDay - 2) return null

  const isComplete = Boolean(review?.completedAt)
  const daysLeft = lastDay - currentDay

  if (isComplete) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-500/10 px-3 py-1.5">
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          ✓ Monthly review done
        </span>
        <button
          type="button"
          onClick={onScrollToReview}
          className="ml-auto text-[10px] text-share-onSurfaceVariant/60 hover:text-share-onBg transition-colors"
        >
          Revisit ↓
        </button>
      </div>
    )
  }

  const countdownText = daysLeft === 0
    ? 'Monthly review: last day!'
    : `Monthly review: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`

  return (
    <div className="mb-3 flex items-center gap-2 rounded border border-amber-700/50 bg-amber-500/10 px-3 py-2">
      <span className="text-sm">📋</span>
      <span className="flex-1 text-xs text-amber-200">{countdownText}</span>
      <button
        type="button"
        onClick={onScrollToReview}
        className="rounded border border-amber-600 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
      >
        Open ↓
      </button>
    </div>
  )
}
