/**
 * storage/activeBlock.ts
 *
 * The running focus block, written to localStorage so it outlives the tab.
 *
 * The timer already counts against a wall clock - `start()` stores the instant
 * the block lands on, not a decrementing number - so it is *correct* across an
 * absence and only ever forgot because the target lived in React state. A
 * refresh, a phone locking Chrome out, or a tab evicted while you were out
 * running threw away real minutes with no trace.
 *
 * That matters most for the work you are not at the desk for. Starting a block
 * and walking away is the honest way to record an hour of jogging: the interval
 * is committed to in advance and measured by a clock, not typed in afterwards.
 * For that to hold, the block has to survive the walk.
 *
 * Device-local on purpose, like `uiPrefs` and for the same reason: a countdown
 * is a property of this tab on this machine, and syncing it would both make no
 * sense across devices and add write churn to the Convex settings path.
 */

const ACTIVE_BLOCK_KEY = 'deepblock_active_block_v1'

/**
 * A block that was running when the app last had the page. `endsAt` is an
 * absolute epoch, which is what makes the record readable after any gap.
 */
export interface PersistedActiveBlock {
  /** The day the block belongs to, so it is never credited to a later one. */
  dayIso: string
  taskId?: string
  label: string
  totalMinutes: number
  /** ISO timestamp the block began. */
  startedAt: string
  status: 'running' | 'paused'
  /** Epoch ms the countdown lands on. Null while paused. */
  endsAt: number | null
  /** Frozen remainder while paused. */
  remainingMs: number
}

export function readActiveBlock(): PersistedActiveBlock | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_BLOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedActiveBlock>
    if (!isUsable(parsed)) {
      // A malformed record is worse than none - it would restore a countdown
      // that means nothing. Drop it rather than carry it forward.
      clearActiveBlock()
      return null
    }
    return parsed as PersistedActiveBlock
  } catch {
    return null
  }
}

export function writeActiveBlock(block: PersistedActiveBlock): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_BLOCK_KEY, JSON.stringify(block))
  } catch {
    // ignore quota / private-mode errors - the countdown still runs in memory
  }
}

export function clearActiveBlock(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ACTIVE_BLOCK_KEY)
  } catch {
    // ignore
  }
}

/**
 * How long a finished-while-away block stays claimable. Past this the gap is
 * long enough that "did you actually work it?" has no honest answer - you were
 * asleep, or the tab sat open for two days - so the block is dropped rather
 * than offered.
 */
export const AWAY_BLOCK_MAX_AGE_MS = 12 * 60 * 60 * 1000

function isUsable(block: Partial<PersistedActiveBlock>): boolean {
  if (typeof block.dayIso !== 'string' || block.dayIso.length === 0) return false
  if (typeof block.label !== 'string') return false
  if (typeof block.startedAt !== 'string') return false
  if (!Number.isFinite(block.totalMinutes) || (block.totalMinutes ?? 0) <= 0) return false
  if (block.status !== 'running' && block.status !== 'paused') return false
  if (block.status === 'running' && !Number.isFinite(block.endsAt ?? NaN)) return false
  if (block.status === 'paused' && !Number.isFinite(block.remainingMs ?? NaN)) return false
  return true
}
