/**
 * components/timer/BlockLengthLine.tsx
 *
 * Two small pieces the desktop timer card and the phone Focus tab share, so
 * the rule behind each is written once:
 *
 * - `BlockLengthLine`: what your block is, and the one-tap way to adopt the
 *   length you just picked.
 * - `SoundToggle`: mute for this device.
 *
 * Each takes a `size`: `compact` for the desktop rail, `phone` for a thumb.
 */

import { useState, type ReactNode } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundEnabled, playChime, setSoundEnabled } from '../../audio/chimes'
import { suggestedBreakMinutes } from '../../domain/focusBlocks'

type Size = 'compact' | 'phone'

/**
 * The offer only appears when the two disagree, because that is the only
 * moment the question is live - you have reached for 60m twice in a row and
 * the planner is still drawing your tasks in 45s. The warning is not
 * decoration: the block length is the unit every progress row is drawn in, so
 * changing it re-buckets work already logged. Nothing is lost, but the shape of
 * every row changes, and that is worth saying before the tap rather than after.
 */
export function BlockLengthLine({
  durationMinutes,
  blockMinutes,
  breakMinutes,
  disabled,
  onSetBlockLength,
  trailing,
  size = 'compact',
}: {
  durationMinutes: number
  blockMinutes: number
  breakMinutes: number
  disabled: boolean
  onSetBlockLength?: (minutes: number, breakMinutes: number) => void
  /** Rendered at the end of the line (the desktop card puts mute here). */
  trailing?: ReactNode
  size?: Size
}) {
  const differs = durationMinutes !== blockMinutes
  const phone = size === 'phone'

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
        phone ? 'text-xs text-share-onSurfaceVariant' : 'text-[11px] text-share-onSurfaceVariant/70'
      }`}
    >
      <span className="flex items-center gap-1">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-share-primary" />
        Your block: {blockMinutes}m on · {breakMinutes}m off
      </span>
      {onSetBlockLength && differs && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSetBlockLength(durationMinutes, suggestedBreakMinutes(durationMinutes))}
          title="Draw every task's progress row in blocks of this length. Work already logged re-buckets; nothing is lost."
          className={
            phone
              ? `min-h-[44px] px-1 text-xs font-semibold text-share-primary ${disabled ? 'cursor-not-allowed opacity-50' : ''}`
              : `rounded-full border border-share-outlineVariant/40 px-2 py-0.5 transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-share-primary/60 hover:text-share-primary'
                }`
          }
        >
          Make {durationMinutes}m my block
        </button>
      )}
      {trailing}
    </div>
  )
}

/**
 * Mute for this device.
 *
 * Turning it on plays the sound it turns on, which is both the obvious preview
 * and the only way iOS ever hears any of them: a browser unlocks audio on a
 * user gesture, and this button is one.
 */
export function SoundToggle({ size = 'compact', className = '' }: { size?: Size; className?: string }) {
  const [enabled, setEnabled] = useState(() => isSoundEnabled())
  const phone = size === 'phone'

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled
        setSoundEnabled(next)
        setEnabled(next)
        if (next) playChime('taskTicked')
      }}
      title={enabled ? 'Sounds on — mute this device' : 'Sounds muted — turn them on'}
      aria-label={enabled ? 'Mute sounds on this device' : 'Turn sounds on'}
      aria-pressed={enabled}
      className={
        phone
          ? `flex h-11 w-11 items-center justify-center rounded-full text-share-onSurfaceVariant ${className}`
          : `touch-target-coarse rounded-full border border-share-outlineVariant/40 p-1 transition-colors hover:border-share-primary/60 hover:text-share-primary ${className}`
      }
    >
      {enabled ? (
        <Volume2 className={phone ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
      ) : (
        <VolumeX className={phone ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
      )}
    </button>
  )
}
