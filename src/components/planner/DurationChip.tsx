/**
 * components/planner/DurationChip.tsx
 *
 * How long a task will take, on every desktop row. It replaced a native
 * <select> that stayed invisible until the row was hovered.
 *
 * The chip is always there and stays quiet so it never competes with the
 * title: the length when set ("1h30", `formatMinutes`), a dim "Time" when not.
 * Clicking it opens a small popover anchored under it, not a sheet: the rest
 * of the page stays live (nothing is made inert, focus is not trapped). In it:
 *
 *  - a text field that reads a typed length ("2h 30m", "45", "1:30"; the rules
 *    are `parseDurationInput` in domain/durations.ts), Enter saves;
 *  - the ladder as one-tap pills (`durationOptions`, the same list the phone's
 *    schedule sheet offers), with a stored off-ladder value kept in order;
 *  - Clear, when a length is set.
 *
 * It closes after a choice, on Escape (no change) and on a click or focus
 * outside. Leaving by a click outside keeps a valid typed length rather than
 * dropping it (HIG › Popovers: save work when a nonmodal popover closes
 * itself). Focus goes to the field on open and back to the chip after a
 * choice or Escape.
 *
 * Phones never see this: a phone row's one chip opens the schedule sheet,
 * which has the same typed field.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject, SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { durationOptions, parseDurationInput } from '../../domain/durations'
import { formatMinutes } from '../../domain/taskProgress'
import { ErrorLine } from '../ui/Notices'

interface DurationChipProps {
  value?: number
  onChange: (minutes: number | undefined) => void
  className?: string
}

export const DURATION_INPUT_PLACEHOLDER = '2h 30m, 45m or 1:30'
export const DURATION_INPUT_ERROR = 'Try 2h 30m, 45m or 1:30'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
}

/** The typed length when it reads, else null (nothing to keep). */
function typedLength(draft: string): number | null {
  return draft.trim() ? parseDurationInput(draft) : null
}

const GAP_PX = 6
const EDGE_PX = 8

export function DurationChip({ value, onChange, className }: DurationChipProps) {
  const [open, setOpen] = useState(false)
  const chipRef = useRef<HTMLButtonElement>(null)
  const isSet = value != null

  const look = isSet
    ? 'border-share-outlineVariant/40 text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-onSurface'
    : 'border-dashed border-share-outlineVariant/30 text-share-onSurfaceDim hover:border-share-primary/50 hover:text-share-onSurfaceVariant'

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) chipRef.current?.focus()
  }, [])

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          // Escape closes it from the chip too (focus can rest here while it
          // is open); nothing is saved.
          if (open && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close(true)
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`How long: ${isSet ? formatMinutes(value) : 'not set'}`}
        title="How long this will take"
        className={`inline-flex h-7 shrink-0 items-center rounded-full border bg-transparent px-2 text-xs tabular-nums transition-colors touch:min-h-[44px] touch:min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-primary ${look} ${className ?? ''}`}
      >
        {isSet ? formatMinutes(value) : 'Time'}
      </button>
      {open && (
        <DurationPopover
          anchor={chipRef}
          value={value}
          onChoose={(minutes) => {
            if (minutes !== value) onChange(minutes)
            close(true)
          }}
          onDismiss={(minutes, returnFocus) => {
            if (minutes !== null && minutes !== value) onChange(minutes)
            close(returnFocus)
          }}
        />
      )}
    </>
  )
}

interface DurationPopoverProps {
  anchor: RefObject<HTMLButtonElement | null>
  value?: number
  /** A deliberate choice: saved, then the popover closes. */
  onChoose: (minutes: number | undefined) => void
  /** Closed without a choice: a valid typed length (or null for none) is kept. */
  onDismiss: (typed: number | null, returnFocus: boolean) => void
}

function DurationPopover({ anchor, value, onChoose, onDismiss }: DurationPopoverProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(value != null ? formatMinutes(value) : '')
  const [error, setError] = useState(false)

  // The latest draft, for the document listeners below.
  const draftRef = useRef(draft)
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    draftRef.current = draft
    dismissRef.current = onDismiss
  })

  // Anchored under the chip (above it when there is no room below), kept
  // inside the viewport. Written straight to the panel's style: it follows
  // scrolling and resizing without a re-render per frame.
  useLayoutEffect(() => {
    const place = () => {
      const chip = anchor.current
      const panel = panelRef.current
      if (!chip || !panel) return
      const r = chip.getBoundingClientRect()
      const w = panel.offsetWidth
      const h = panel.offsetHeight
      let top = r.bottom + GAP_PX
      if (top + h > window.innerHeight - EDGE_PX && r.top - GAP_PX - h >= EDGE_PX) top = r.top - GAP_PX - h
      const left = Math.min(Math.max(EDGE_PX, r.right - w), window.innerWidth - w - EDGE_PX)
      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
      panel.style.visibility = 'visible'
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const typed = () => typedLength(draftRef.current)
    const isInside = (node: EventTarget | null) =>
      node instanceof Node && (panelRef.current?.contains(node) || anchor.current?.contains(node))

    // A press outside closes it; the chip's own click toggles it instead.
    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target)) dismissRef.current(typed(), false)
    }
    // Tabbing away closes it too: nothing is trapped.
    const onFocusIn = (event: FocusEvent) => {
      if (!isInside(event.target)) dismissRef.current(typed(), false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [anchor])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) {
      onChoose(undefined)
      return
    }
    const minutes = parseDurationInput(draft)
    if (minutes == null) {
      setError(true)
      return
    }
    onChoose(minutes)
  }

  // The panel is portalled to <body>, but React still bubbles its events up
  // the component tree into the row (drag, menus, double-click to edit).
  const contain = (event: SyntheticEvent) => event.stopPropagation()

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="How long"
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onDismiss(null, true)
          return
        }
        // Nothing is trapped. The panel lives at the end of <body>, so Tab
        // past its edges is sent where it would go if the panel sat beside
        // the chip: Shift+Tab off the first control back to the chip, Tab off
        // the last one to whatever follows the chip. Either way a valid typed
        // length is kept.
        if (event.key !== 'Tab' || !panelRef.current) return
        const inside = focusablesIn(panelRef.current)
        const edge = event.shiftKey ? inside[0] : inside[inside.length - 1]
        if (document.activeElement !== edge) return
        event.preventDefault()
        if (event.shiftKey) {
          onDismiss(typedLength(draft), true)
          return
        }
        const chip = anchor.current
        const page = focusablesIn(document).filter((el) => !panelRef.current?.contains(el))
        const next = chip ? page[page.indexOf(chip) + 1] : undefined
        if (next) next.focus() // the focusin listener saves and closes
        else onDismiss(typedLength(draft), false)
      }}
      onClick={contain}
      onDoubleClick={contain}
      onMouseDown={contain}
      onPointerDown={contain}
      onContextMenu={contain}
      className="invisible fixed left-0 top-0 z-[75] w-64 rounded-xl border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-3 shadow-xl shadow-black/30"
    >
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(false)
          }}
          placeholder={DURATION_INPUT_PLACEHOLDER}
          aria-label="Type how long"
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          name="duration"
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-2.5 text-sm tabular-nums text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-lg px-2.5 text-sm font-semibold text-share-onSurface hover:bg-share-surfaceContainerHighest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
        >
          Set
        </button>
      </form>
      {error && (
        <div id={`${id}-error`}>
          <ErrorLine className="mt-2" message={DURATION_INPUT_ERROR} />
        </div>
      )}
      <div role="group" aria-label="Pick a length" className="mt-3 grid grid-cols-4 gap-1">
        {durationOptions(value).map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onChoose(minutes)}
            aria-pressed={minutes === value}
            className={`h-8 rounded-lg border text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg ${
              minutes === value
                ? 'border-share-primary bg-share-primary/15 font-semibold text-share-primary'
                : 'border-share-outlineVariant/40 text-share-onSurface hover:border-share-primary/50'
            }`}
          >
            {formatMinutes(minutes)}
          </button>
        ))}
      </div>
      {value != null && (
        <button
          type="button"
          onClick={() => onChoose(undefined)}
          className="mt-2 -mb-1 h-9 rounded-lg px-2 text-sm text-share-onSurfaceVariant hover:text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg -ml-2"
        >
          Clear
        </button>
      )}
    </div>,
    document.body,
  )
}
