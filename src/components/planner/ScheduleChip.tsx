/**
 * components/planner/ScheduleChip.tsx
 *
 * The one control on a task row that talks about time. Unscheduled it reads
 * "Schedule"; scheduled it shows the start time. Either way it opens the
 * schedule sheet, where the calendar does the actual placing.
 *
 * The button is the 44px touch target; the pill inside is what you see, so a
 * row of tasks does not turn into a column of boxes on a phone.
 */

import { CalendarClock } from 'lucide-react'

export function ScheduleChip({
  scheduledAt,
  onClick,
}: {
  scheduledAt?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/chip touch-target-coarse inline-flex shrink-0 items-center justify-center"
      aria-label={scheduledAt ? `Scheduled at ${scheduledAt}. Change` : 'Schedule in calendar'}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors ${
          scheduledAt
            ? 'border-share-primary/40 bg-share-primary/10 text-share-primary group-hover/chip:border-share-primary'
            : 'border-share-outlineVariant/40 text-share-onSurfaceVariant group-hover/chip:border-share-primary/60 group-hover/chip:text-share-primary'
        }`}
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {scheduledAt ?? <span className="sr-only sm:not-sr-only">Schedule</span>}
      </span>
    </button>
  )
}
