/**
 * domain/focusBlocks.ts
 *
 * The focus block - one uninterrupted run of the timer, and the unit the whole
 * planner counts in.
 *
 * A task is not budgeted in arbitrary minutes any more; it is budgeted in
 * blocks, because a block is the thing you can actually start. That makes the
 * progress row on a task a row of *startable* units rather than a ruler laid
 * over a duration, and it removes the ragged half-boxes a fixed 30-minute grid
 * produced against durations that were never multiples of 30.
 *
 * Minutes remain the stored truth everywhere (`Task.durationMinutes`,
 * `DeepWorkSession.durationMinutes`, `Task.manualLoggedMinutes`). The block
 * length is only a lens: change it and existing work re-buckets correctly with
 * no migration, at the cost of an occasional short trailing block - which the
 * UI draws narrow, so it never claims to be a full one.
 */

export interface FocusBlockPreset {
  minutes: number
  /** The rest that belongs with this block, ~20% of it. */
  breakMinutes: number
  name: string
  /** Why this length exists, shown as the chip's tooltip. */
  blurb: string
}

/**
 * The four lengths worth offering. Each is a real practice rather than a round
 * number: 50/10 is deliberately left out because it is too close to 45 to be a
 * separate choice, and anyone who wants it can type it.
 */
export const FOCUS_BLOCK_PRESETS: FocusBlockPreset[] = [
  {
    minutes: 25,
    breakMinutes: 5,
    name: 'Classic',
    blurb: "Cirillo's pomodoro - 25 on, 5 off, a longer break every fourth",
  },
  {
    minutes: 45,
    breakMinutes: 10,
    name: 'Deep',
    blurb: 'Long enough to get properly in, short enough to repeat all day',
  },
  {
    minutes: 60,
    breakMinutes: 15,
    name: 'Hour',
    blurb: 'Clean arithmetic when you plan the day in hours',
  },
  {
    minutes: 90,
    breakMinutes: 20,
    name: 'Ultradian',
    blurb: 'One full basic rest-activity cycle - the deep work purist option',
  },
]

export const DEFAULT_FOCUS_BLOCK_MINUTES = 45
export const MIN_FOCUS_BLOCK_MINUTES = 10
export const MAX_FOCUS_BLOCK_MINUTES = 120

/** Most tasks fit inside a working day; past this the row stops being readable. */
export const MAX_PLANNED_BLOCKS = 8

/**
 * Durations below a block are still worth setting - a 10-minute errand has a
 * cost - they just do not earn a progress row. Offered above the block plans.
 */
export const QUICK_DURATION_OPTIONS = [5, 10, 15, 20]

/** Clamp whatever is in storage (or a custom input) to something usable. */
export function normalizeFocusBlockMinutes(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_FOCUS_BLOCK_MINUTES
  const rounded = Math.round(value)
  if (rounded < MIN_FOCUS_BLOCK_MINUTES) return MIN_FOCUS_BLOCK_MINUTES
  if (rounded > MAX_FOCUS_BLOCK_MINUTES) return MAX_FOCUS_BLOCK_MINUTES
  return rounded
}

/**
 * The break that goes with a block: the preset's own value where there is one,
 * otherwise ~20% of the block rounded to five minutes. Only ever a default -
 * the stored `focusBreakMinutes` wins once the user has touched it.
 */
export function suggestedBreakMinutes(blockMinutes: number): number {
  const preset = FOCUS_BLOCK_PRESETS.find((p) => p.minutes === blockMinutes)
  if (preset) return preset.breakMinutes
  return Math.max(5, Math.round((blockMinutes * 0.2) / 5) * 5)
}

export interface BlockPlanOption {
  blocks: number
  minutes: number
}

/** The block counts offered by a task's duration picker. */
export function blockPlanOptions(blockMinutes: number): BlockPlanOption[] {
  const options: BlockPlanOption[] = []
  for (let blocks = 1; blocks <= MAX_PLANNED_BLOCKS; blocks += 1) {
    options.push({ blocks, minutes: blocks * blockMinutes })
  }
  return options
}

/**
 * How many blocks a duration works out to, rounded up - a task 5 minutes over
 * two blocks still needs a third sitting to finish.
 */
export function blocksForMinutes(minutes: number, blockMinutes: number): number {
  if (blockMinutes <= 0) return 0
  return Math.ceil(minutes / blockMinutes)
}

/** "1 block" / "3 blocks". */
export function formatBlockCount(blocks: number): string {
  return blocks === 1 ? '1 block' : `${blocks} blocks`
}
