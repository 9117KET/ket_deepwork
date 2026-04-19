/**
 * components/habits/HabitEditorModal.tsx
 *
 * Modal for editing the user's habit list: add, reorder, delete,
 * and set optional habit stacking anchors.
 */

import { useState } from 'react'
import type React from 'react'
import type { HabitDefinition } from '../../domain/types'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Edit Habits</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          <ul className="space-y-3">
            {draft.map((habit, index) => (
              <li key={habit.id} className="rounded border border-slate-800 bg-slate-950 p-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-xs text-slate-600 hover:text-slate-300 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === draft.length - 1}
                      className="text-xs text-slate-600 hover:text-slate-300 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  <input
                    type="text"
                    value={habit.label}
                    onChange={(e) => handleLabelChange(habit.id, e.target.value)}
                    placeholder="Habit name"
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleDelete(habit.id)}
                    className="text-xs text-slate-600 hover:text-red-400"
                    aria-label="Delete habit"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-1.5 ml-7">
                  <input
                    type="text"
                    value={habit.stackAnchor ?? ''}
                    onChange={(e) => handleAnchorChange(habit.id, e.target.value)}
                    placeholder="After... (optional stack anchor)"
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs text-slate-400 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none"
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
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddHabit}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              Add
            </button>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded border border-sky-600 bg-sky-600/20 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-600/30"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
