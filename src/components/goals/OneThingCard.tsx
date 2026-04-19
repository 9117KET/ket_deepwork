/**
 * components/goals/OneThingCard.tsx
 *
 * Sidebar card showing the user's ONE Thing at three time horizons:
 *   Today → This Week → This Month
 *
 * Each row is click-to-edit (inline). Values are stored in AppState and
 * persisted via the normal sync path.
 *
 * Framework: The ONE Thing (Gary Keller)
 * "What's the ONE thing you can do such that by doing it, everything else
 *  becomes easier or unnecessary?"
 */

import { useState, useRef, useCallback } from 'react'
import { weekForDay } from '../../domain/dateUtils'

interface OneThingCardProps {
  selectedDay: string
  dayOneThings: Record<string, string>
  weekOneThings: Record<string, string>
  monthOneThings: Record<string, string>
  onSetDay: (date: string, value: string) => void
  onSetWeek: (weekStart: string, value: string) => void
  onSetMonth: (monthKey: string, value: string) => void
}

interface RowProps {
  label: string
  sublabel: string
  value: string
  placeholder: string
  accentClass: string
  onSave: (value: string) => void
}

function OneThingRow({ label, sublabel, value, placeholder, accentClass, onSave }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(value)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function save() {
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 border-t border-slate-800 first:border-t-0">
      <div className="flex-none pt-px">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${accentClass}`}>
          {label}
        </span>
        {sublabel && (
          <div className="mt-0.5 text-[9px] text-slate-600">{sublabel}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full rounded border border-amber-700 bg-slate-950 px-1.5 py-0.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to set your ONE thing"
            className="w-full text-left"
          >
            {value ? (
              <span className="text-xs text-slate-200 leading-snug">{value}</span>
            ) : (
              <span className="text-xs text-slate-600 italic">{placeholder}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function OneThingCard({
  selectedDay,
  dayOneThings,
  weekOneThings,
  monthOneThings,
  onSetDay,
  onSetWeek,
  onSetMonth,
}: OneThingCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const weekStart = weekForDay(selectedDay).days[0]!
  const monthKey = selectedDay.slice(0, 7)

  const todayValue = dayOneThings[selectedDay] ?? ''
  const weekValue = weekOneThings[weekStart] ?? ''
  const monthValue = monthOneThings[monthKey] ?? ''

  const allSet = Boolean(todayValue && weekValue && monthValue)

  const handleSetDay = useCallback((v: string) => onSetDay(selectedDay, v), [onSetDay, selectedDay])
  const handleSetWeek = useCallback((v: string) => onSetWeek(weekStart, v), [onSetWeek, weekStart])
  const handleSetMonth = useCallback((v: string) => onSetMonth(monthKey, v), [onSetMonth, monthKey])

  return (
    <div className="rounded-lg border border-amber-900/40 bg-slate-900 p-3 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200 transition-colors"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <span className="text-[10px] leading-none">{collapsed ? '▸' : '▾'}</span>
          The ONE Thing
          {!collapsed && (
            <span
              className={`ml-1 h-1.5 w-1.5 rounded-full ${allSet ? 'bg-emerald-400' : 'bg-amber-500'}`}
              title={allSet ? 'All horizons set' : 'Some horizons empty'}
            />
          )}
        </button>
      </div>

      {!collapsed && (
        <div>
          <OneThingRow
            label="Today"
            sublabel={selectedDay}
            value={todayValue}
            placeholder="What's your ONE thing today?"
            accentClass="bg-amber-500/20 text-amber-300"
            onSave={handleSetDay}
          />
          <OneThingRow
            label="Week"
            sublabel={`w/o ${weekStart}`}
            value={weekValue}
            placeholder="What's your ONE thing this week?"
            accentClass="bg-orange-500/20 text-orange-300"
            onSave={handleSetWeek}
          />
          <OneThingRow
            label="Month"
            sublabel={monthKey}
            value={monthValue}
            placeholder="What's your ONE thing this month?"
            accentClass="bg-rose-500/20 text-rose-300"
            onSave={handleSetMonth}
          />
        </div>
      )}
    </div>
  )
}
