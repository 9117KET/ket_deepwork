/**
 * components/planner/TouchCheckbox.tsx
 *
 * A task checkbox for a finger: 24px to look at, 44px to hit.
 *
 * The native input is the 44x44 target, stretched over the box and made
 * transparent, so it keeps everything a real checkbox does (keyboard, screen
 * readers, `getByRole('checkbox')`). The box drawn underneath follows its
 * state through `peer-checked`.
 */

import { Check } from 'lucide-react'

export function TouchCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  /** Accessible name, e.g. the task title. */
  label: string
}) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 z-10 m-0 h-11 w-11 cursor-pointer appearance-none opacity-0 accent-share-primary"
      />
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-share-outlineVariant bg-share-surfaceContainer text-transparent transition-colors peer-checked:border-share-primary peer-checked:bg-share-primary peer-checked:text-share-onPrimary peer-focus-visible:ring-2 peer-focus-visible:ring-share-primary/60"
      >
        <Check className="h-4 w-4" strokeWidth={3.2} />
      </span>
    </span>
  )
}
