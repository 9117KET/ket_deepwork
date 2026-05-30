/**
 * components/goals/MonthlyReviewBanner.tsx
 *
 * Pinned end-of-month reminder shown during the last 3 days of each month.
 * Clicking Open/Revisit scrolls to and expands the MonthlyReviewCard inline
 * in the tracking dashboard — no modal overlay.
 */

import type { MonthlyReview } from '../../domain/types'
import { isEndOfMonth, toMonthId } from '../../domain/dateUtils'
import { ClipboardList, Check } from 'lucide-react'

interface MonthlyReviewBannerProps {
  selectedDay: string
  review: MonthlyReview | undefined
  onOpen: () => void
}

export function MonthlyReviewBanner({ selectedDay, review, onOpen }: MonthlyReviewBannerProps) {
  if (!isEndOfMonth(selectedDay)) return null

  const monthKey = toMonthId(selectedDay)
  const isComplete = Boolean(review?.completedAt)

  const parts = selectedDay.split('-').map(Number)
  const lastDay = new Date(parts[0]!, parts[1]!, 0).getDate()
  const daysLeft = lastDay - Number(parts[2]) + 1

  return isComplete ? (
    <div className="mt-1 flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-500/10 px-3 py-1.5">
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Monthly review done — {monthKey}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="ml-auto text-[10px] text-share-onSurfaceVariant/60 hover:text-share-onBg transition-colors"
      >
        Revisit ↓
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
        onClick={onOpen}
        className="shrink-0 rounded border border-amber-600 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
      >
        Open ↓
      </button>
    </div>
  )
}
