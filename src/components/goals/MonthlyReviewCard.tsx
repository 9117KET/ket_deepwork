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

const DEFAULT_QUESTIONS = [
  'Did I protect the deep-work block every weekday this month?',
  'How many quality applications did I send? How many responses?',
  'Is my German improving measurably? Am I on track for B2?',
  'Has Bürgergeld been resolved?',
  'What is the ONE thing for next month that makes everything else easier or unnecessary?',
  'What did I park that I need to make sure stays parked?',
  'What did I almost say yes to that I should have said no to?',
]

interface MonthlyReviewCardProps {
  monthKey: string        // "YYYY-MM"
  questions: string[]
  review: MonthlyReview | undefined
  onUpdate: (monthKey: string, review: MonthlyReview) => void
}

export function MonthlyReviewCard({ monthKey, questions, review, onUpdate }: MonthlyReviewCardProps) {
  const qs = questions.length > 0 ? questions : DEFAULT_QUESTIONS
  const answers = useMemo(() => review?.answers ?? [], [review?.answers])
  const [collapsed, setCollapsed] = useState(!!review?.completedAt)

  // Debounce ref per question
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const handleAnswerChange = useCallback(
    (index: number, value: string) => {
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
    <div className="mt-3 rounded border border-amber-900/40 bg-slate-950 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{collapsed ? '▸' : '▾'}</span>
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
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reopen
          </button>
        )}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {qs.map((question, i) => (
            <div key={i}>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                {i + 1}. {question}
              </label>
              <textarea
                defaultValue={answers[i] ?? ''}
                onChange={(e) => handleAnswerChange(i, e.target.value)}
                rows={2}
                placeholder="Your answer..."
                className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-amber-700 focus:outline-none"
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
 * Banner shown at the top of the monthly dashboard on the 1st of the month
 * when the current month's review hasn't been completed yet.
 */
interface MonthlyReviewBannerProps {
  monthKey: string
  review: MonthlyReview | undefined
  onScrollToReview: () => void
}

export function MonthlyReviewBanner({ monthKey, review, onScrollToReview }: MonthlyReviewBannerProps) {
  const today = todayIso()
  const isFirstOfMonth = today.endsWith('-01')
  const currentMonthKey = today.slice(0, 7)
  if (!isFirstOfMonth || currentMonthKey !== monthKey) return null
  if (review?.completedAt) return null

  return (
    <div className="mb-3 flex items-center gap-2 rounded border border-amber-700/50 bg-amber-500/10 px-3 py-2">
      <span className="text-sm">📋</span>
      <span className="flex-1 text-xs text-amber-200">
        It's the 1st — time for your monthly review.
      </span>
      <button
        type="button"
        onClick={onScrollToReview}
        className="rounded border border-amber-600 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
      >
        Start review →
      </button>
    </div>
  )
}
