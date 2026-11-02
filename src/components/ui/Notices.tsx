/**
 * components/ui/Notices.tsx
 *
 * The two shapes a problem takes on screen, each one colour plus an icon so
 * the colour never carries the meaning alone:
 *
 * - `ErrorLine`: something you tried did not work (the `share-error` token);
 * - `WarningLine`: something needs attention soon (the warning amber).
 */

import type { ReactNode } from 'react'

export function ErrorLine({ message, className = '' }: { message: string; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-1.5 text-sm text-share-error ${className}`}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      <span className="min-w-0">{message}</span>
    </p>
  )
}

export function WarningLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-share-tertiary ${className}`}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <path d="M12 3.5 2.5 20h19L12 3.5Z" />
        <path d="M12 10v4.5M12 17.5v.01" />
      </svg>
      <span className="min-w-0">{children}</span>
    </p>
  )
}
