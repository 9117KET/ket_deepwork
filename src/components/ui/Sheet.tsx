/**
 * components/ui/Sheet.tsx
 *
 * The one sheet. A bottom sheet on a phone, a centred dialog from `sm`, and
 * the same behaviour everywhere:
 *
 * - it is portalled to <body> and the app root is made `inert` while it is
 *   open, so nothing behind it can be focused, read or tapped;
 * - focus moves in on open (to `initialFocus`, else the first control) and is
 *   trapped: Tab and Shift+Tab cycle inside; focus goes back to where it came
 *   from on close;
 * - Escape and a tap on the scrim close it (only the top sheet answers when
 *   one opens over another);
 * - on a coarse pointer the header can be dragged down to dismiss, and only
 *   then is a grabber drawn (HIG: a grabber means "this moves");
 * - the footer is a quiet Cancel and one verb button, unless the caller
 *   brings its own.
 *
 * `ActionSheet` is the destructive-choice form: the choice first, Cancel
 * last, full width. It replaces every `window.confirm`.
 */

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'
import { ErrorLine } from './Notices'

export interface SheetAction {
  label: string
  onClick: () => void
  /** Shown while the action runs; the button is disabled meanwhile. */
  pending?: boolean
  pendingLabel?: string
  disabled?: boolean
}

interface SheetProps {
  onClose: () => void
  title: ReactNode
  /** A short line under the title. */
  description?: ReactNode
  /** A small label above the title (e.g. "Schedule"). */
  kicker?: ReactNode
  children?: ReactNode
  /** The verb button. With it, the footer is Cancel + this. */
  action?: SheetAction
  /** Defaults to "Cancel". */
  cancelLabel?: string
  /** Replaces the default footer entirely. */
  footer?: ReactNode
  /** Where focus lands on open; the first control in the sheet otherwise. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Scrolls inside the sheet past this height. */
  scrollable?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open sheets, newest last: only the top one answers Escape. */
const stack: string[] = []

/** How far down the header has to travel before letting go dismisses. */
const DISMISS_PX = 90

export const sheetPrimaryButton =
  'touch-target inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-surfaceContainerHigh disabled:opacity-60'
export const sheetQuietButton =
  'touch-target inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-share-outlineStrong px-4 py-2 text-sm font-semibold text-share-onSurface transition-colors hover:bg-share-surfaceContainerHighest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-60'

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
}

/** Makes #root inert while any sheet is open. Counted, so nested sheets do not release it early. */
let inertCount = 0
function holdInert(): () => void {
  const root = document.getElementById('root')
  inertCount++
  root?.setAttribute('inert', '')
  root?.setAttribute('aria-hidden', 'true')
  return () => {
    inertCount = Math.max(0, inertCount - 1)
    if (inertCount === 0) {
      root?.removeAttribute('inert')
      root?.removeAttribute('aria-hidden')
    }
  }
}

export function Sheet({
  onClose,
  title,
  description,
  kicker,
  children,
  action,
  cancelLabel = 'Cancel',
  footer,
  initialFocus,
  scrollable = false,
}: SheetProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  const panelRef = useRef<HTMLDivElement>(null)
  const coarse = useCoarsePointer()
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Inert behind, focus in, the stack for Escape, and focus back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const release = holdInert()
    stack.push(id)
    const panel = panelRef.current
    const target = initialFocus?.current ?? (panel ? focusables(panel)[0] : null) ?? panel
    target?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const at = stack.lastIndexOf(id)
      if (at >= 0) stack.splice(at, 1)
      release()
      if (opener && opener.isConnected) opener.focus()
    }
    // Runs once per open: the sheet mounts when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A sheet that turns into its next step (check-in → "Checked in") swaps its
  // controls; the focused one may be gone, so focus comes back inside.
  const titleKey = typeof title === 'string' ? title : null
  useEffect(() => {
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) (focusables(panel)[0] ?? panel).focus()
  }, [titleKey])

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = focusables(panelRef.current)
    if (items.length === 0) {
      e.preventDefault()
      panelRef.current.focus()
      return
    }
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const dragHandlers = coarse
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          dragStart.current = e.clientY
          e.currentTarget.setPointerCapture(e.pointerId)
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          if (dragStart.current === null) return
          setDrag(Math.max(0, e.clientY - dragStart.current))
        },
        onPointerUp: () => {
          const travelled = drag
          dragStart.current = null
          setDrag(0)
          if (travelled > DISMISS_PX) onClose()
        },
        onPointerCancel: () => {
          dragStart.current = null
          setDrag(0)
        },
      }
    : {}

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
        className={`w-full max-w-md rounded-t-2xl border border-share-outlineVariant/60 bg-share-surfaceContainerHigh pb-safe-nav shadow-2xl outline-none sm:rounded-2xl sm:pb-4 ${
          scrollable ? 'max-h-[90dvh] overflow-y-auto overscroll-contain' : ''
        }`}
      >
        <div {...dragHandlers} className={`px-4 pt-3 ${coarse ? 'touch-none' : 'pt-4'}`}>
          {coarse && <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-share-outlineStrong" />}
          {kicker && <p className="text-caption font-semibold text-share-onSurfaceVariant">{kicker}</p>}
          <h2 id={titleId} className="text-section text-share-onBg">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-0.5 text-caption text-share-onSurfaceVariant">
              {description}
            </p>
          )}
        </div>
        <div className="px-4">{children}</div>
        {footer !== undefined ? (
          <div className="px-4">{footer}</div>
        ) : action ? (
          <div className="mt-4 flex gap-2 px-4">
            <button type="button" onClick={onClose} className={sheetQuietButton}>
              {cancelLabel}
            </button>
            <button type="button" onClick={action.onClick} disabled={action.pending || action.disabled} className={sheetPrimaryButton}>
              {action.pending ? (action.pendingLabel ?? `${action.label}…`) : action.label}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

interface ActionSheetProps {
  onClose: () => void
  /** Names the choice, e.g. "Leave Q4 push". */
  title: string
  /** What the choice does, in one or two sentences. */
  message?: ReactNode
  /** The choice itself; usually the same words as the title. */
  actionLabel: string
  onAction: () => void
  pending?: boolean
  /** Shown under the buttons when the choice failed. */
  error?: string | null
}

/** A destructive choice: the choice first, Cancel last. */
export function ActionSheet({ onClose, title, message, actionLabel, onAction, pending = false, error }: ActionSheetProps) {
  return (
    <Sheet
      onClose={onClose}
      title={title}
      description={message}
      footer={
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAction}
            disabled={pending}
            className="touch-target inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-share-error/15 px-4 py-2 text-sm font-bold text-share-error transition-colors hover:bg-share-error/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg disabled:opacity-60"
          >
            {pending ? `${actionLabel}…` : actionLabel}
          </button>
          <button type="button" onClick={onClose} className={`${sheetQuietButton} w-full`}>
            Cancel
          </button>
          {error && <ErrorLine message={error} />}
        </div>
      }
    />
  )
}
