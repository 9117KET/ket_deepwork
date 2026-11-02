/**
 * components/ui/textButtonClass.ts
 *
 * The quiet text action's classes, for a `<Link>` that should look and size
 * like a `TextButton`: always 44px tall with real side padding, never cyan.
 */

export type TextButtonTone = 'default' | 'quiet' | 'danger'

const TONES: Record<TextButtonTone, string> = {
  default: 'text-share-onSurface hover:bg-share-surfaceContainerHigh',
  quiet: 'text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface',
  danger: 'text-share-error hover:bg-share-error/10',
}

export function textButtonClass(tone: TextButtonTone = 'default', extra = ''): string {
  return `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]} ${extra}`.trim()
}
