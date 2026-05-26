import { useState } from 'react'
import type React from 'react'
import type { SideQuestDef, SideQuestCategory } from '../../domain/types'
import { ChevronUp, ChevronDown, X, Gamepad2, BookOpen, Wrench } from 'lucide-react'

interface SideQuestEditorModalProps {
  defs: SideQuestDef[]
  onSave: (defs: SideQuestDef[]) => void
  onClose: () => void
}

function createSideQuestId(): string {
  return `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

type LucideIconComponent = React.ComponentType<{ className?: string }>

const CATEGORY_OPTIONS: { value: SideQuestCategory; Icon: LucideIconComponent; label: string; activeColor: string }[] = [
  { value: 'fun', Icon: Gamepad2, label: 'Fun', activeColor: 'border-violet-500 bg-violet-500/20 text-violet-300' },
  { value: 'serious', Icon: BookOpen, label: 'Serious', activeColor: 'border-amber-500 bg-amber-500/20 text-amber-300' },
  { value: 'technical', Icon: Wrench, label: 'Technical', activeColor: 'border-sky-500 bg-sky-500/20 text-sky-300' },
]

export function SideQuestEditorModal({ defs, onSave, onClose }: SideQuestEditorModalProps) {
  const [draft, setDraft] = useState<SideQuestDef[]>(() => defs.map((d) => ({ ...d })))
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState<SideQuestCategory>('fun')

  const handleTitleChange = (id: string, title: string) => {
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)))
  }

  const handleCategoryChange = (id: string, category: SideQuestCategory) => {
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, category } : d)))
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
    setDraft((prev) => [...prev, { id: createSideQuestId(), title, category: newCategory }])
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-share-bg/90 px-4">
      <div className="w-full max-w-lg rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh shadow-2xl">
        <header className="flex items-center justify-between border-b border-share-outlineVariant/25 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Edit Side Quests</h2>
            <p className="mt-0.5 text-[10px] text-share-onSurfaceVariant/60">
              Set them once - they appear every time you hit 90%. One quest per category is picked daily.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-share-onSurfaceVariant/60 hover:text-share-onBg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Category legend */}
        <div className="flex gap-2 border-b border-share-outlineVariant/25 px-4 py-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <span key={opt.value} className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] ${opt.activeColor}`}>
              <opt.Icon className="h-3 w-3" /> {opt.label}
            </span>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {draft.map((def, index) => {
              const cat = def.category ?? 'fun'
              const catOpt = CATEGORY_OPTIONS.find(o => o.value === cat)!
              return (
                <li key={def.id} className="rounded border border-share-outlineVariant/25 bg-share-surfaceContainerHighest p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-share-onSurfaceVariant/40 hover:text-share-onSurface disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === draft.length - 1}
                        className="text-share-onSurfaceVariant/40 hover:text-share-onSurface disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={def.title}
                      onChange={(e) => handleTitleChange(def.id, e.target.value)}
                      placeholder="Quest name"
                      className="flex-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-violet-600 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleDelete(def.id)}
                      className="text-share-onSurfaceVariant/40 hover:text-red-400"
                      aria-label="Delete quest"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Category chips */}
                  <div className="mt-1.5 flex gap-1 pl-7">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleCategoryChange(def.id, opt.value)}
                        className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                          cat === opt.value
                            ? opt.activeColor
                            : 'border-share-outlineVariant/30 text-share-onSurfaceVariant/60 hover:border-share-outlineVariant/50 hover:text-share-onSurfaceVariant'
                        }`}
                      >
                        <opt.Icon className="h-3 w-3" /> {opt.label}
                      </button>
                    ))}
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] text-share-onSurfaceVariant/40 self-center">
                      <catOpt.Icon className="h-3 w-3" /> {catOpt.label}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="Add a quest... e.g. Guitar practice"
                className="flex-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHighest px-2 py-1.5 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-violet-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 py-1.5 text-xs text-share-onSurface hover:border-violet-600 hover:text-violet-300"
              >
                Add
              </button>
            </div>
            <div className="flex items-center gap-1 pl-1">
              <span className="text-[10px] text-share-onSurfaceVariant/40 mr-1">Category:</span>
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewCategory(opt.value)}
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                    newCategory === opt.value
                      ? opt.activeColor
                      : 'border-share-outlineVariant/30 text-share-onSurfaceVariant/60 hover:border-share-outlineVariant/50 hover:text-share-onSurfaceVariant'
                  }`}
                >
                  <opt.Icon className="h-3 w-3" /> {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-share-outlineVariant/25 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-share-outlineVariant/40 px-3 py-1.5 text-xs text-share-onSurfaceVariant hover:text-share-onBg"
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
