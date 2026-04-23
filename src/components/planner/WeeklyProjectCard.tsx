/**
 * components/planner/WeeklyProjectCard.tsx
 *
 * Sidebar card that shows weekly project rotation assignments.
 * Each project is pinned to a specific day of the week so side commitments
 * (InfradarAI, KET Academy, Palavar) appear on their day without bloating
 * the High Priority list every day.
 */

import { useState } from 'react'
import type { WeeklyProjectAssignment } from '../../domain/types'

const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
}

const DAY_FULL: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
  5: 'Friday', 6: 'Saturday', 7: 'Sunday',
}

const COLOR_CLASSES: Record<NonNullable<WeeklyProjectAssignment['color']>, { badge: string; dot: string; border: string }> = {
  sky:     { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',     dot: 'bg-sky-400',     border: 'border-sky-500/40' },
  amber:   { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400',   border: 'border-amber-500/40' },
  emerald: { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', border: 'border-emerald-500/40' },
  violet:  { badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400',  border: 'border-violet-500/40' },
  rose:    { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',   dot: 'bg-rose-400',    border: 'border-rose-500/40' },
}

const DEFAULT_COLOR_CLASSES = { badge: 'bg-slate-700/60 text-slate-300 border-slate-600', dot: 'bg-slate-400', border: 'border-slate-700' }

function getColorClasses(color?: WeeklyProjectAssignment['color']) {
  return color ? COLOR_CLASSES[color] : DEFAULT_COLOR_CLASSES
}

/** Returns ISO weekday (1=Mon … 7=Sun) for a given ISO date string. */
function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  const dow = date.getDay() // 0=Sun
  return dow === 0 ? 7 : dow
}

const COLORS: Array<WeeklyProjectAssignment['color']> = ['sky', 'amber', 'emerald', 'violet', 'rose']

interface WeeklyProjectCardProps {
  selectedDate: string
  projects: WeeklyProjectAssignment[]
  onUpdate: (projects: WeeklyProjectAssignment[]) => void
}

export function WeeklyProjectCard({ selectedDate, projects, onUpdate }: WeeklyProjectCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WeeklyProjectAssignment[]>([])

  const todayDow = isoWeekday(selectedDate)
  const todayProject = projects.find(p => p.dayOfWeek === todayDow)

  const openEdit = () => {
    setDraft(projects.map(p => ({ ...p })))
    setEditing(true)
  }

  const addProject = () => {
    const usedDays = new Set(draft.map(p => p.dayOfWeek))
    const freeDays = ([1, 2, 3, 4, 5, 6, 7] as const).filter(d => !usedDays.has(d))
    const day = freeDays[0] ?? 1
    const colorIdx = draft.length % COLORS.length
    setDraft(prev => [...prev, {
      id: `proj-${Date.now()}`,
      name: '',
      dayOfWeek: day,
      color: COLORS[colorIdx],
    }])
  }

  const updateDraft = (id: string, patch: Partial<WeeklyProjectAssignment>) => {
    setDraft(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const removeDraft = (id: string) => {
    setDraft(prev => prev.filter(p => p.id !== id))
  }

  const save = () => {
    const valid = draft.filter(p => p.name.trim() !== '')
    onUpdate(valid)
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  // Week grid: Mon–Sun with assigned projects
  const allDays = [1, 2, 3, 4, 5, 6, 7] as const
  const projectByDay = Object.fromEntries(projects.map(p => [p.dayOfWeek, p]))

  if (editing) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-3 sm:p-4">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Weekly projects</h3>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
            <button type="button" onClick={save} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500">Save</button>
          </div>
        </header>
        <div className="space-y-3">
          {draft.map(p => (
            <div key={p.id} className="space-y-2 rounded-md border border-slate-700 bg-slate-800 p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={e => updateDraft(p.id, { name: e.target.value })}
                  placeholder="Project name"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
                <button type="button" onClick={() => removeDraft(p.id)} className="shrink-0 text-xs text-slate-500 hover:text-red-400">✕</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={p.dayOfWeek}
                  onChange={e => updateDraft(p.id, { dayOfWeek: Number(e.target.value) as WeeklyProjectAssignment['dayOfWeek'] })}
                  className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
                >
                  {allDays.map(d => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
                </select>
                <div className="flex gap-1">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateDraft(p.id, { color: c })}
                      className={`h-4 w-4 rounded-full ${COLOR_CLASSES[c!].dot} ${p.color === c ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-slate-800' : 'opacity-60 hover:opacity-100'}`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={p.description ?? ''}
                onChange={e => updateDraft(p.id, { description: e.target.value || undefined })}
                placeholder="Short description (optional)"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>
          ))}
          {draft.length < 7 && (
            <button
              type="button"
              onClick={addProject}
              className="w-full rounded-md border border-dashed border-slate-700 py-1.5 text-xs text-slate-500 hover:border-sky-500 hover:text-sky-400"
            >
              + Add project
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Weekly projects</h3>
          <p className="text-xs text-slate-400">Side commitments pinned to their day</p>
        </div>
        <button
          type="button"
          onClick={openEdit}
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          Edit
        </button>
      </header>

      {/* Today's project highlight */}
      {todayProject && (() => {
        const cls = getColorClasses(todayProject.color)
        return (
          <div className={`mb-3 rounded-md border px-3 py-2 ${cls.border} bg-slate-800/60`}>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Today's commitment</p>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${cls.dot}`} />
              <span className="text-sm font-medium text-slate-100">{todayProject.name}</span>
            </div>
            {todayProject.description && (
              <p className="mt-0.5 text-xs text-slate-400">{todayProject.description}</p>
            )}
          </div>
        )
      })()}

      {/* Week grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-7 gap-0.5">
          {allDays.map(day => {
            const proj = projectByDay[day]
            const isToday = day === todayDow
            const cls = proj ? getColorClasses(proj.color) : null
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] font-medium ${isToday ? 'text-sky-400' : 'text-slate-500'}`}>
                  {DAY_LABELS[day]}
                </span>
                {proj ? (
                  <div
                    title={`${proj.name}${proj.description ? ` — ${proj.description}` : ''}`}
                    className={`flex h-7 w-full items-center justify-center rounded border text-[9px] font-semibold leading-tight text-center px-0.5 ${cls!.badge} ${isToday ? 'ring-1 ring-sky-400/50' : ''}`}
                  >
                    {proj.name.length > 6 ? proj.name.slice(0, 5) + '…' : proj.name}
                  </div>
                ) : (
                  <div className={`h-7 w-full rounded border border-dashed ${isToday ? 'border-slate-600' : 'border-slate-800'}`} />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={openEdit}
          className="w-full rounded-md border border-dashed border-slate-700 py-3 text-xs text-slate-500 hover:border-sky-500 hover:text-sky-400"
        >
          + Pin your first weekly project
        </button>
      )}
    </section>
  )
}
