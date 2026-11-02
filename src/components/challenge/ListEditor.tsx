/**
 * components/challenge/ListEditor.tsx
 *
 * A short list of goals or don'ts: type and Add, × to remove. Used by the
 * create form, the join page and the commitments sheet.
 *
 * Rows carry an optional id. With `editable`, each row's text can be changed
 * in place and keeps its id, so editing a don't stays the same don't (its
 * past confessions keep pointing at it). Without it, rows are read-only text,
 * as on the create form.
 *
 * Text left in the Add box is never dropped. Leaving the box commits it as a
 * row, except when the box is left by pressing a button: inserting a row at
 * that moment moves the button before the press ends and swallows the tap.
 * For those presses the parent folds the draft in itself (`onDraftChange` +
 * `withDraft`), so one tap on Save, Create or Join sends it, and a tap on
 * Add adds it once.
 */

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MAX_COMMITMENTS, commitDraft, type CommitmentRow } from '../../domain/challengeCommitments'

/** The server's caps (`MAX_LIST`, `MAX_ITEM` in convex/challenges.ts). */
const MAX_ITEMS = MAX_COMMITMENTS
const MAX_LENGTH = 200
/** A blur this soon after a press on a button belongs to that press (touch blurs after the finger lifts). */
const BUTTON_PRESS_MS = 1000

const input =
  'min-h-[44px] w-full rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface sm:text-sm placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg'

interface ListEditorProps {
  items: CommitmentRow[]
  onChange: (items: CommitmentRow[]) => void
  placeholder: string
  /** The Add box's accessible name ("Add a goal"); the placeholder is only an example. */
  label?: string
  idPrefix: string
  editable?: boolean
  /** The text in the Add box, so a submit can include it (`withDraft`). */
  onDraftChange?: (draft: string) => void
}

export function ListEditor({ items, onChange, placeholder, label, idPrefix, editable = false, onDraftChange }: ListEditorProps) {
  const [draft, setDraftState] = useState('')
  // The ref is read by `add`, so a second call before a render sees the
  // cleared draft: one row, not two.
  const draftRef = useRef('')
  const setDraft = (value: string) => {
    draftRef.current = value
    setDraftState(value)
    onDraftChange?.(value)
  }
  const add = () => {
    const next = commitDraft(items, draftRef.current, MAX_ITEMS)
    if (!next) return
    onChange(next)
    setDraft('')
  }

  const buttonPressAt = useRef(-Infinity)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const onButton = e.target instanceof Element && e.target.closest('button, a, [role="button"]') !== null
      buttonPressAt.current = onButton ? performance.now() : -Infinity
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
  const onBlur = () => {
    // A press on a button: that button's own action takes the draft (or leaves it in the box).
    if (performance.now() - buttonPressAt.current < BUTTON_PRESS_MS) return
    add()
  }
  const edit = (i: number, text: string) => onChange(items.map((row, j) => (j === i ? { ...row, text } : row)))
  return (
    <div className="mt-1.5 space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id ?? `${idPrefix}-${i}`}
          className="flex items-center gap-2 rounded-lg bg-share-surfaceContainer pl-3 text-sm text-share-onSurface focus-within:ring-1 focus-within:ring-share-onBg"
        >
          {editable ? (
            <input
              value={item.text}
              onChange={(e) => edit(i, e.target.value)}
              maxLength={MAX_LENGTH}
              aria-label={`Edit "${item.text}"`}
              name={`${idPrefix}-${i}`}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-share-onSurface focus:outline-none sm:text-sm"
            />
          ) : (
            <span className="min-w-0 flex-1 break-words">{item.text}</span>
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
            aria-label={`Remove "${item.text}"`}
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            maxLength={MAX_LENGTH}
            placeholder={placeholder}
            className={input}
            aria-label={label ?? placeholder}
            name={`${idPrefix}-new`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={add}
            className="min-h-11 shrink-0 rounded-lg border border-share-outlineStrong px-3 text-sm font-semibold text-share-onSurface hover:bg-share-surfaceContainerHigh focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
