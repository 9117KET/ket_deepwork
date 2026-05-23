/**
 * components/goals/MonthlyReviewBanner.tsx
 *
 * Pinned end-of-month reminder that appears during the last 3 days of each month.
 * Opens MonthlyReviewCard in a modal overlay so the user can complete or revisit
 * the review without scrolling to the bottom of the page.
 */

import { useState } from 'react'
import type { MonthlyReview } from '../../domain/types'
import { isEndOfMonth, toMonthId } from '../../domain/dateUtils'
import { MonthlyReviewCard } from './MonthlyReviewCard'
import { ClipboardList, Check } from 'lucide-react'

interface MonthlyReviewBannerProps {
  selectedDay: string
  review: MonthlyReview | undefined
  questions: string[]
  onUpdate: (monthKey: string, review: MonthlyReview) => void
}

export function MonthlyReviewBanner({ selectedDay, review, questions, onUpdate }: MonthlyReviewBannerProps) {
  const [showModal, setShowModal] = useState(false)

  if (!isEndOfMonth(selectedDay)) return null

  const monthKey = toMonthId(selectedDay)
  const isComplete = Boolean(review?.completedAt)

  // Compute days remaining in the month
  const parts = selectedDay.split('-').map(Number)
  const lastDay = new Date(parts[0]!, parts[1]!, 0).getDate()
  const daysLeft = lastDay - Number(parts[2]) + 1

  return (
    <>
      {isComplete ? (
        <div className="mt-1 flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-500/10 px-3 py-1.5">
          <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" /> Monthly review done</span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
          >
            Revisit
          </button>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2 rounded border border-amber-600/50 bg-amber-500/10 px-3 py-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="flex-1 text-xs font-medium text-amber-200">
            Monthly review: {daysLeft === 1 ? 'last day!' : `${daysLeft} days left`}
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded border border-amber-600 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Open
          </button>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Monthly Review: {monthKey}
              </span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              >
                Close
              </button>
            </div>
            <MonthlyReviewCard
              monthKey={monthKey}
              questions={questions}
              review={review}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      )}
    </>
  )
}
