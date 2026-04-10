/**
 * components/planner/NotDoingPanel.tsx
 *
 * Sidebar widget for Drucker's not-to-do list.
 * Shows two sections:
 *   • Global — persistent commitments (synced to user_settings)
 *   • Today — per-day decisions (stored in DayState.notDoingItems)
 */

import { useRef, useState } from 'react'
import type { NotDoingItem } from '../../domain/types'

interface NotDoingPanelProps {
  globalList: NotDoingItem[]
  dayList: NotDoingItem[]
  selectedDay: string
  onAddGlobal: (text: string) => void
  onRemoveGlobal: (id: string) => void
  onAddDay: (text: string) => void
  onRemoveDay: (id: string) => void
}

function NotDoingItem({ item, onRemove }: { item: NotDoingItem; onRemove: () => void }) {
  return (
    <li className="flex items-start gap-1.5 group">
      <span className="mt-px shrink-0 text-red-400/70 text-xs leading-4">✗</span>
      <span className="min-w-0 flex-1 break-words text-xs text-slate-300">{item.text}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs leading-4 transition-opacity"
        aria-label="Remove"
      >
        ×
      </button>
    </li>
  )
}

function AddItemInput({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setValue(''); inputRef.current?.blur() }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={commit}
        className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400 hover:border-red-500/60 hover:text-red-300"
      >
        +
      </button>
    </div>
  )
}

export function NotDoingPanel({
  globalList,
  dayList,
  onAddGlobal,
  onRemoveGlobal,
  onAddDay,
  onRemoveDay,
}: NotDoingPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <section className="rounded-lg border border-red-900/40 bg-slate-900 p-3">
      <header
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400/80">
          Not Doing
        </h3>
        <span className="text-slate-500 text-xs">{collapsed ? '▶' : '▼'}</span>
      </header>

      {!collapsed && (
        <div className="mt-2 space-y-3">
          {/* Global commitments */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
              Always
            </p>
            {globalList.length > 0 ? (
              <ul className="space-y-1">
                {globalList.map((item) => (
                  <NotDoingItem key={item.id} item={item} onRemove={() => onRemoveGlobal(item.id)} />
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-slate-600 italic">No global commitments yet.</p>
            )}
            <AddItemInput placeholder="Add a commitment..." onAdd={onAddGlobal} />
          </div>

          <div className="border-t border-slate-800" />

          {/* Per-day decisions */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">
              Today only
            </p>
            {dayList.length > 0 ? (
              <ul className="space-y-1">
                {dayList.map((item) => (
                  <NotDoingItem key={item.id} item={item} onRemove={() => onRemoveDay(item.id)} />
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-slate-600 italic">Nothing skipped today.</p>
            )}
            <AddItemInput placeholder="Not doing today..." onAdd={onAddDay} />
          </div>
        </div>
      )}
    </section>
  )
}
