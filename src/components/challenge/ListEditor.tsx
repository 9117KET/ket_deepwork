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
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CommitmentRow } from '../../domain/challengeCommitments'

/** The server's caps (`MAX_LIST`, `MAX_ITEM` in convex/challenges.ts). */
const MAX_ITEMS = 10
const MAX_LENGTH = 200

const input =
  'min-h-[44px] w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface sm:text-sm placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary'

interface ListEditorProps {
  items: CommitmentRow[]
  onChange: (items: CommitmentRow[]) => void
  placeholder: string
  idPrefix: string
  editable?: boolean
}

export function ListEditor({ items, onChange, placeholder, idPrefix, editable = false }: ListEditorProps) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { text }])
    setDraft('')
  }
  const edit = (i: number, text: string) => onChange(items.map((row, j) => (j === i ? { ...row, text } : row)))
  return (
    <div className="mt-1 space-y-1">
      {items.map((item, i) => (
        <div key={item.id ?? `${idPrefix}-${i}`} className="flex items-center gap-2 rounded-lg bg-share-surfaceContainer py-0.5 pl-3 pr-0.5 text-sm text-share-onSurface">
          {editable ? (
            <input
              value={item.text}
              onChange={(e) => edit(i, e.target.value)}
              maxLength={MAX_LENGTH}
              aria-label={`Edit "${item.text}"`}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-share-onSurface focus:outline-none sm:text-sm"
            />
          ) : (
            <span className="min-w-0 flex-1 break-words">{item.text}</span>
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="touch-target-coarse flex shrink-0 items-center justify-center rounded p-1.5 text-share-onSurfaceVariant hover:text-share-tertiary"
            aria-label={`Remove "${item.text}"`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            maxLength={MAX_LENGTH}
            placeholder={placeholder}
            className={input}
            aria-label={placeholder}
          />
          <button type="button" onClick={add} className="touch-target-coarse shrink-0 rounded-lg border border-share-outlineVariant/40 px-3 text-sm text-share-onSurface hover:bg-share-surfaceContainerHigh">
            Add
          </button>
        </div>
      )}
    </div>
  )
}
