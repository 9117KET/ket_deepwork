/**
 * components/habits/HabitEditorModal.tsx
 *
 * Modal for editing the user's habit list: add, reorder, delete,
 * and set optional habit stacking anchors. A bottom sheet on phones, a
 * centred card from `sm` up; every control is at least 44px.
 */

import { useState } from 'react'
import type React from 'react'
import type { HabitDefinition } from '../../domain/types'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

interface HabitEditorModalProps {
  habits: HabitDefinition[]
  onSave: (habits: HabitDefinition[]) => void
  onClose: () => void
}

function createHabitId(): string {
  return `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function HabitEditorModal({ habits, onSave, onClose }: HabitEditorModalProps) {
  const [draft, setDraft] = useState<HabitDefinition[]>(() => habits.map((h) => ({ ...h })))
  const [newLabel, setNewLabel] = useState('')

  const handleLabelChange = (id: string, label: string) => {
    setDraft((prev) => prev.map((h) => (h.id === id ? { ...h, label } : h)))
  }

  const handleAnchorChange = (id: string, stackAnchor: string) => {
    setDraft((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, stackAnchor: stackAnchor || undefined } : h,
      ),
    )
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setDraft((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    setDraft((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
      return next
    })
  }

  const handleDelete = (id: string) => {
    setDraft((prev) => prev.filter((h) => h.id !== id))
  }

  const handleAddHabit = () => {
    const label = newLabel.trim()
    if (!label) return
    setDraft((prev) => [...prev, { id: createHabitId(), label }])
    setNewLabel('')
  }

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddHabit()
  }

  const handleSave = () => {
    onSave(draft.filter((h) => h.label.trim() !== ''))
    onClose()
  }

  const iconButton =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-share-onSurfaceVariant hover:text-share-onSurface disabled:opacity-30'
  const field =
    'min-h-[44px] rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 text-base text-share-onBg placeholder:text-share-onSurfaceDim focus:border-share-primary focus:outline-none sm:text-sm'

  // A bottom sheet on phones (thumb reach, above the tab bar), the centred
  // card from `sm` up.
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-share-bg/90 sm:items-center sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-editor-title"
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-2xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh shadow-2xl sm:rounded-xl"
      >
        <header className="flex items-center justify-between border-b border-share-outlineVariant/25 py-1 pl-4 pr-1">
          <h2 id="habit-editor-title" className="text-sm font-semibold text-share-onBg">
            Edit Habits
          </h2>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-3">
            {draft.map((habit, index) => (
              <li
                key={habit.id}
                className="rounded-lg border border-share-outlineVariant/25 bg-share-surfaceContainerHighest p-2"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className={iconButton}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === draft.length - 1}
                    className={iconButton}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <input
                    type="text"
                    value={habit.label}
                    onChange={(e) => handleLabelChange(habit.id, e.target.value)}
                    placeholder="Habit name"
                    aria-label="Habit name"
                    className={`${field} min-w-0 flex-1`}
                  />

                  <button
                    type="button"
                    onClick={() => handleDelete(habit.id)}
                    className={`${iconButton} hover:text-share-tertiary`}
                    aria-label="Delete habit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-1.5">
                  <input
                    type="text"
                    value={habit.stackAnchor ?? ''}
                    onChange={(e) => handleAnchorChange(habit.id, e.target.value)}
                    placeholder="After... (optional stack anchor)"
                    aria-label="Stack anchor"
                    className={`${field} w-full text-share-onSurfaceVariant`}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Add new habit..."
              aria-label="New habit"
              className={`${field} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={handleAddHabit}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-4 text-sm text-share-onSurface hover:border-share-primary/60 hover:text-share-primary"
            >
              Add
            </button>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-share-outlineVariant/25 px-4 pt-3 pb-safe-nav sm:pb-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-share-outlineVariant/40 px-4 text-sm text-share-onSurfaceVariant hover:text-share-onBg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-share-primary px-4 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}

