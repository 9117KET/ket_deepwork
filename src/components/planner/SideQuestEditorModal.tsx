/**
 * components/planner/SideQuestEditorModal.tsx
 *
 * Modal for managing the recurring side quest definition list.
 * These definitions appear as checkboxes whenever the Side Quest section unlocks (90%+ day completion).
 * Set them once; they wait for you every time you earn them.
 */

import { useState } from 'react'
import type React from 'react'
import type { SideQuestDef } from '../../domain/types'

interface SideQuestEditorModalProps {
  defs: SideQuestDef[]
  onSave: (defs: SideQuestDef[]) => void
  onClose: () => void
}

function createSideQuestId(): string {
  return `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function SideQuestEditorModal({ defs, onSave, onClose }: SideQuestEditorModalProps) {
  const [draft, setDraft] = useState<SideQuestDef[]>(() => defs.map((d) => ({ ...d })))
  const [newTitle, setNewTitle] = useState('')

  const handleTitleChange = (id: string, title: string) => {
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)))
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
    setDraft((prev) => prev.filter((d) => d.id !== id))
  }

  const handleAdd = () => {
    const title = newTitle.trim()
    if (!title) return
    setDraft((prev) => [...prev, { id: createSideQuestId(), title }])
    setNewTitle('')
  }

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleSave = () => {
    onSave(draft.filter((d) => d.title.trim() !== ''))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Edit Side Quests</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Set them once — they appear every time you hit 90%.
            </p>
          </div>
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
          <ul className="space-y-2">
            {draft.map((def, index) => (
              <li key={def.id} className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950 p-2">
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
                  value={def.title}
                  onChange={(e) => handleTitleChange(def.id, e.target.value)}
                  placeholder="Quest name"
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-600 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleDelete(def.id)}
                  className="text-xs text-slate-600 hover:text-red-400"
                  aria-label="Delete quest"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Add a quest... e.g. 🎸 Guitar practice"
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-600 hover:text-violet-300"
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
            className="rounded border border-violet-600 bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/30"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
