/**
 * components/ui/TextButton.tsx
 *
 * The quiet text action: Share, Nudge, Edit, Leave, "Whole season". Always
 * 44px tall with real side padding, so it is a thumb target without negative
 * margins, and never cyan: cyan is the one primary action on a screen.
 * `textButtonClass` (./textButtonClass) gives a `<Link>` the same shape.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { textButtonClass, type TextButtonTone } from './textButtonClass'

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: TextButtonTone
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton(
  { tone = 'default', className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={textButtonClass(tone, className)} {...rest} />
})
