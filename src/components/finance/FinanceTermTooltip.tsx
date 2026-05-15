/**
 * components/finance/FinanceTermTooltip.tsx
 *
 * Inline info tooltip for German finance terms.
 * Wraps any content with a small info icon that shows a popover on hover/click.
 */

import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { GLOSSARY_MAP } from './financeGlossary'

interface FinanceTermTooltipProps {
  termId: string
  children?: React.ReactNode
  /** If true, renders only the info icon without a label wrapper. */
  iconOnly?: boolean
}

export function FinanceTermTooltip({ termId, children, iconOnly = false }: FinanceTermTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const term = GLOSSARY_MAP[termId]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!term) return <>{children}</>

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      {!iconOnly && children}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex text-share-onSurfaceVariant/60 hover:text-share-primary transition-colors"
        aria-label={`Learn about ${term.term}`}
      >
        <MaterialIcon name="info" className="text-[0.9rem]" />
      </button>

      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3 shadow-xl">
          <span className="block text-xs font-semibold text-share-primary mb-1">{term.term}</span>
          <span className="block text-xs text-share-onSurfaceVariant leading-relaxed">
            {term.shortDef}
          </span>
          <span className="block mt-2 text-[10px] text-share-onSurfaceVariant/50">
            Click the Learn tab for the full explanation.
          </span>
        </span>
      )}
    </span>
  )
}

/** Standalone inline term highlight with tooltip. */
export function FinanceTerm({ termId, label }: { termId: string; label?: string }) {
  const term = GLOSSARY_MAP[termId]
  if (!term) return <span>{label}</span>
  return (
    <FinanceTermTooltip termId={termId}>
      <span className="border-b border-dotted border-share-primary/50 text-share-primary cursor-help">
        {label ?? term.term}
      </span>
    </FinanceTermTooltip>
  )
}
