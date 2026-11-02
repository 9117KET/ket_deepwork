/**
 * components/planner/TaskDurationPicker.tsx
 *
 * How long a task will take: one ascending list, the short errands then 30
 * minutes to 8 hours (`durationOptions` in domain/durations.ts), the same
 * list the phone's schedule sheet offers.
 *
 * It must not compete with the title. A set length reads as a quiet chip; an
 * unset one stays out of sight on a mouse until the row is hovered or the
 * control takes keyboard focus, so a fresh list does not show a boxed control
 * per row. Under a finger it is always visible.
 *
 * A stored length that is not on the list is kept as its own option, in
 * order, rather than silently rewritten: the stored minutes are the truth.
 */

import { durationOptions } from '../../domain/durations'
import { formatMinutes } from '../../domain/taskProgress'

interface TaskDurationPickerProps {
  value?: number
  onChange: (minutes: number | undefined) => void
  className?: string
}

export function TaskDurationPicker({ value, onChange, className }: TaskDurationPickerProps) {
  const isSet = value != null
  const look = isSet
    ? 'border-share-outlineVariant/40 text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-onSurface'
    : 'border-transparent text-share-onSurfaceDim opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 touch:opacity-100'

  return (
    <select
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        onChange(raw === '' ? undefined : Number(raw))
      }}
      className={`h-7 touch:h-auto touch:min-h-[44px] touch:min-w-[44px] cursor-pointer appearance-none rounded-full border bg-transparent px-2 py-0 text-center text-xs tabular-nums transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-primary [&>option]:bg-share-surfaceContainer [&>option]:text-share-onSurface ${look} ${className ?? ''}`}
      name="durationMinutes"
      autoComplete="off"
      aria-label="How long"
      title="How long this will take"
    >
      <option value="">Not set</option>
      {durationOptions(value).map((minutes) => (
        <option key={minutes} value={minutes}>
          {formatMinutes(minutes)}
        </option>
      ))}
    </select>
  )
}
