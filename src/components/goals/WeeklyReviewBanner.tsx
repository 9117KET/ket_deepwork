/**
 * components/goals/WeeklyReviewBanner.tsx
 *
 * Pinned weekly review reminder shown on the configured weekday.
 * Clicking Open ↓ scrolls to and expands the inline WeeklyReviewCard
 * in the tracking dashboard.
 */

import type { WeeklyReview } from '../../domain/types'
import { isWeeklyReviewDay } from '../../domain/dateUtils'
import { ClipboardCheck, Check } from 'lucide-react'

interface WeeklyReviewBannerProps {
  selectedDay: string
  review: WeeklyReview | undefined
  reviewWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  onOpen: () => void
}

export function WeeklyReviewBanner({
  selectedDay,
  review,
  reviewWeekday,
  onOpen,
}: WeeklyReviewBannerProps) {
  if (!isWeeklyReviewDay(selectedDay, reviewWeekday)) return null

  const isComplete = Boolean(review?.completedAt)

  return isComplete ? (
    <div className="mt-1 flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-500/10 px-3 py-1.5">
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Weekly review done
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
    <div className="mt-1 flex items-center gap-2 rounded border border-sky-600/50 bg-sky-500/10 px-3 py-2">
      <ClipboardCheck className="h-4 w-4 shrink-0 text-sky-300" />
      <span className="flex-1 text-xs font-medium text-sky-200">
        Weekly review day — take 10 minutes to close the week.
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded border border-sky-600 bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/30 transition-colors"
      >
        Open ↓
      </button>
    </div>
  )
}
