/**
 * components/goals/WeeklyReviewCard.tsx
 *
 * Weekly review card (GTD weekly review + Cal Newport shutdown ritual).
 * Five fixed questions covering deep work, the ONE Thing, habits,
 * task triage, and next week's focus. Answers auto-save on keystroke.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type { WeeklyReview } from '../../domain/types'

const DEFAULT_QUESTIONS = [
  'How many deep work hours did I log this week vs. my goal? Was the High Priority block protected every day?',
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
}

export function WeeklyReviewCard({
  dateKey,
  questions,
  review,
  onUpdate,
  forceOpen,
}: WeeklyReviewCardProps) {
  const qs = questions.length > 0 ? questions : DEFAULT_QUESTIONS
  const answers = useMemo(() => review?.answers ?? [], [review?.answers])
  // Start collapsed — the user opens it when ready (unlike monthly review which auto-opens).
  const [collapsed, setCollapsed] = useState(!review || !review.answers?.some(Boolean) || !!review.completedAt)
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen ?? 0)
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  if ((forceOpen ?? 0) > prevForceOpen) {
    setPrevForceOpen(forceOpen ?? 0)
    setCollapsed(false)
  }

  const handleAnswerChange = useCallback(
    (index: number, value: string) => {
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
              <textarea
                defaultValue={answers[i] ?? ''}
                onChange={e => handleAnswerChange(i, e.target.value)}
                rows={2}
                placeholder="Your answer..."
                className="w-full resize-none rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-xs leading-relaxed text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-sky-700 focus:outline-none"
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
