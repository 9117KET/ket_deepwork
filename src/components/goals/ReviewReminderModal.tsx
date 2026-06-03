/**
 * components/goals/ReviewReminderModal.tsx
 *
 * One-time-per-session popup shown when a weekly or monthly review is due
 * and the user hasn't completed it yet.
 */

interface ReviewReminderModalProps {
  type: 'weekly' | 'monthly'
  onGoToReview: () => void
  onDismiss: () => void
}

export function ReviewReminderModal({ type, onGoToReview, onDismiss }: ReviewReminderModalProps) {
  const isWeekly = type === 'weekly'

  const icon = isWeekly ? '📅' : '📋'
  const title = isWeekly ? 'Weekly Review Due' : 'Monthly Review Due'
  const body = isWeekly
    ? "It's your weekly review day. Take 10 minutes to reflect on the week and set your focus for next week."
    : "The month is ending. Complete your monthly review to capture wins, gaps, and your ONE Thing for next month."
  const accentBorder = isWeekly ? 'border-sky-700/50' : 'border-amber-700/50'
  const accentBg = isWeekly ? 'bg-sky-500/10' : 'bg-amber-500/10'
  const accentText = isWeekly ? 'text-sky-300' : 'text-amber-300'
  const btnBorder = isWeekly
    ? 'border-sky-700 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300'
    : 'border-amber-700 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className={`w-full max-w-sm rounded-xl border ${accentBorder} ${accentBg} p-5 shadow-2xl`}>
        <div className="mb-3 flex items-start gap-3">
          <span className="text-2xl leading-none">{icon}</span>
          <div>
            <p className={`text-sm font-semibold ${accentText}`}>{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-share-onSurfaceVariant">{body}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onGoToReview}
            className={`w-full rounded border ${btnBorder} py-2 text-xs font-semibold transition-colors`}
          >
            Go to review →
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded border border-share-outlineVariant/30 bg-share-surfaceContainerHigh py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
