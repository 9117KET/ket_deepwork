/**
 * components/planner/BlockAmountPicker.tsx
 *
 * "How much of what you set aside did you actually do?", answered in the units
 * the question was asked in.
 *
 * A task planned as eight blocks is eight chips on the row; when the work went
 * unwatched, the honest answer is almost always a count of those chips, not a
 * number of minutes. So the picker is the same blocks again - tap 2 and you
 * have said "two of them", and the minutes those two blocks actually hold are
 * spelled out underneath rather than guessed at. One tap selects, because a
 * stepper makes "I did six" six taps, and a record that is tedious to make is a
 * record that does not get made.
 *
 * Only empty blocks are offered. Minutes already earned on the timer are never
 * inside a choice here, so no amount of tapping can overwrite them or claim
 * them twice.
 */

import type { BlockAmountOption } from '../../domain/taskProgress'
import { formatMinutes } from '../../domain/taskProgress'

interface BlockAmountPickerProps {
  options: BlockAmountOption[]
  /** Blocks currently chosen, matching `BlockAmountOption.blocks`. */
  value: number
  onChange: (blocks: number) => void
  /** Labels the row for screen readers, e.g. "How many blocks did you do?". */
  label: string
  className?: string
}

export function BlockAmountPicker({
  options,
  value,
  onChange,
  label,
  className,
}: BlockAmountPickerProps) {
  if (options.length === 0) return null

  return (
    <div className={className}>
      {/* Horizontal scroll rather than wrapping: a long task keeps one countable
          row of chips, in the same shape as the progress row it mirrors. */}
      <div
        role="radiogroup"
        aria-label={label}
        className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5"
      >
        {options.map((option) => {
          const isSelected = option.blocks === value
          const tone = option.isOverflow
            ? isSelected
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
              : 'border-amber-500/30 text-amber-300/70 hover:text-amber-200'
            : isSelected
              ? 'border-share-primary/60 bg-share-primary/15 text-share-primary'
              : 'border-share-outlineVariant/40 text-share-onSurfaceVariant hover:border-share-primary/40 hover:text-share-onSurface'
          return (
            <button
              key={option.blocks}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.blocks)}
              title={`${option.blocks === 1 ? '1 block' : `${option.blocks} blocks`} · ${formatMinutes(option.minutes)}${
                option.isOverflow ? ' (past the estimate)' : ''
              }`}
              className={`min-h-[32px] min-w-[32px] shrink-0 rounded-md border px-2 text-xs tabular-nums transition-colors touch-target-coarse ${tone}`}
            >
              {option.blocks}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-share-onSurfaceVariant">
        {describeSelection(options, value)}
      </p>
    </div>
  )
}

/** "3 of 6 blocks · 2h15" - the count they picked and what it really costs. */
function describeSelection(options: BlockAmountOption[], value: number): string {
  const selected = options.find((option) => option.blocks === value)
  if (!selected) return ''
  // The denominator is what was actually set aside. Headroom past the estimate
  // is offered but never counted into "of N", or a task planned as three blocks
  // would describe itself as five.
  const planned = options.filter((option) => !option.isOverflow).length
  const minutes = formatMinutes(selected.minutes)
  if (selected.isOverflow) return `${minutes} — past the estimate`
  return `${selected.blocks} of ${planned} ${planned === 1 ? 'block' : 'blocks'} · ${minutes}`
}
