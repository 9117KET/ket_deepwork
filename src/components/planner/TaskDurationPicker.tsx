/**
 * components/planner/TaskDurationPicker.tsx
 *
 * How long a task will take, chosen in focus blocks.
 *
 * The old ladder of minutes (5, 10, 15, 20, 25, 30, 45, 60, 90 …) invited
 * durations that were nothing in particular - a 150-minute task is not a plan,
 * it is a guess with a false precision. Blocks are what actually happen, so the
 * picker offers those, with the minutes spelled out beside each so the cost
 * stays legible.
 *
 * Quick durations survive above them, because a 10-minute errand is real and
 * should not be rounded up into a block it does not deserve. Anything already
 * stored that is not on either list is kept as its own option rather than
 * silently rewritten - the stored minutes are the truth.
 */

import { QUICK_DURATION_OPTIONS, blockPlanOptions, formatBlockCount } from '../../domain/focusBlocks'
import { formatMinutes } from '../../domain/taskProgress'
import { useFocusBlocks } from './focusBlockContext'

interface TaskDurationPickerProps {
  value?: number
  onChange: (minutes: number | undefined) => void
  className?: string
}

export function TaskDurationPicker({ value, onChange, className }: TaskDurationPickerProps) {
  const { blockMinutes } = useFocusBlocks()
  const plans = blockPlanOptions(blockMinutes)
  const known = new Set<number>([...QUICK_DURATION_OPTIONS, ...plans.map((p) => p.minutes)])

  return (
    <select
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        onChange(raw === '' ? undefined : Number(raw))
      }}
      className={`min-h-[36px] rounded border border-share-outlineVariant/40 bg-share-surfaceContainer px-1 py-1 text-xs tabular-nums text-share-onSurface ${className ?? ''}`}
      aria-label="Task duration"
      title={`How many ${blockMinutes}-minute blocks this needs`}
    >
      <option value="">Duration</option>
      {value != null && !known.has(value) && (
        <option value={value}>{formatMinutes(value)}</option>
      )}
      <optgroup label="Quick">
        {QUICK_DURATION_OPTIONS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatMinutes(minutes)}
          </option>
        ))}
      </optgroup>
      <optgroup label={`Blocks of ${blockMinutes}m`}>
        {plans.map((plan) => (
          <option key={plan.blocks} value={plan.minutes}>
            {formatBlockCount(plan.blocks)} · {formatMinutes(plan.minutes)}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
