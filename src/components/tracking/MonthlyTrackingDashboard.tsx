/**
 * components/tracking/MonthlyTrackingDashboard.tsx
 *
 * Monthly tracking: block (section) completion from planner tasks and mood per day.
 * Mood shares the block-completion table so day columns align vertically.
 */

import type React from 'react'
import { useState, useMemo, useCallback } from 'react'
import type { AppState, DayState, HabitDefinition } from '../../domain/types'
import { FIXED_SECTIONS } from '../../domain/types'
import {
  toMonthId,
  previousMonthId,
  nextMonthId,
  daysInMonth,
} from '../../domain/dateUtils'
import { getOrCreateDay } from '../../storage/localStorageState'
import { computeSectionCompletion, computeDayCompletion } from '../../domain/stats'

const MOOD_OPTIONS = ['🙂', '😐', '🙁', '😊', '😢', '😤', '😴', '🔥'] as const

interface MonthlyTrackingDashboardProps {
  state: AppState
  referenceDay: string
  onUpdateDay: (isoDate: string, dayState: DayState) => void
  onUpdateSettings: (patch: {
    habitDefinitions?: HabitDefinition[]
    monthTitles?: Record<string, string>
  }) => void
}

function monthLabel(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  const date = new Date(y!, m! - 1, 1)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

export function MonthlyTrackingDashboard({
  state,
  referenceDay,
  onUpdateDay,
  onUpdateSettings,
}: MonthlyTrackingDashboardProps) {
  const [selectedMonthId, setSelectedMonthId] = useState(() => toMonthId(referenceDay))
  const [moodPickerDay, setMoodPickerDay] = useState<string | null>(null)

  const monthDays = useMemo(() => daysInMonth(selectedMonthId), [selectedMonthId])
  const chapterTitle = state.monthTitles?.[selectedMonthId] ?? ''

  const handleSetChapterTitle = useCallback(
    (value: string) => {
      onUpdateSettings({
        monthTitles: { ...(state.monthTitles ?? {}), [selectedMonthId]: value },
      })
    },
    [onUpdateSettings, state.monthTitles, selectedMonthId],
  )

  const handleSetMood = useCallback(
    (isoDate: string, mood: string | null) => {
      const day = getOrCreateDay(state, isoDate)
      onUpdateDay(isoDate, { ...day, mood })
      setMoodPickerDay(null)
    },
    [state, onUpdateDay],
  )

  return (
    <section
      id="tracking-dashboard"
      className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4"
      aria-label="Monthly tracking"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">
            Monthly tracking
          </h3>
          <p className="text-xs text-slate-400">Block completion and mood by day.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonthId(previousMonthId(selectedMonthId))}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-200">
            {monthLabel(selectedMonthId)}
          </span>
          <button
            type="button"
            onClick={() => setSelectedMonthId(nextMonthId(selectedMonthId))}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </header>

      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">This chapter is called:</label>
        <input
          type="text"
          value={chapterTitle}
          onChange={(e) => handleSetChapterTitle(e.target.value)}
          placeholder="e.g. The Foundation"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none"
        />
      </div>

      <BlockCompletionGrid
        state={state}
        monthDays={monthDays}
        moodPickerDay={moodPickerDay}
        onMoodPickerDayChange={setMoodPickerDay}
        onSetMood={handleSetMood}
      />

    </section>
  )
}

/** Short display label for each section in the block grid. */
const SECTION_SHORT_LABELS: Record<string, string> = {
  mustDo: 'Must Do',
  morningRoutine: 'Morning',
  highPriority: 'High',
  mediumPriority: 'Medium',
  lowPriority: 'Low',
  nightRoutine: 'Night',
}

/** Auto-computed day mode derived from overall task completion %. */
interface DayMode {
  emoji: string
  label: string
}

function computeDayMode(total: number, completed: number): DayMode | null {
  if (total === 0) return null
  const pct = (completed / total) * 100
  if (pct === 0)  return { emoji: '⚪', label: 'Rest' }
  if (pct < 40)   return { emoji: '🌱', label: 'Starting' }
  if (pct < 70)   return { emoji: '⚡', label: 'In Progress' }
  if (pct < 90)   return { emoji: '🔥', label: 'Strong' }
  return           { emoji: '🏆', label: 'Elite' }
}

/**
 * Returns the Tailwind bg class for a block cell based on completion ratio.
 * No tasks   → transparent (show dot only)
 * 0% done    → red tint
 * 1–99%      → amber tint
 * 100% done  → sky/green tint
 */
function blockCellClass(total: number, completed: number): string {
  if (total === 0) return ''
  if (completed === 0) return 'bg-red-500/20'
  if (completed >= total) return 'bg-sky-500/25'
  return 'bg-amber-500/20'
}

function blockCellContent(total: number, completed: number): React.ReactNode {
  if (total === 0) return <span className="text-slate-600">·</span>
  if (completed >= total) return <span className="text-sky-400 font-medium">✓</span>
  return (
    <span className="text-[9px] leading-none text-amber-300">
      {completed}/{total}
    </span>
  )
}

function BlockCompletionGrid({
  state,
  monthDays,
  moodPickerDay,
  onMoodPickerDayChange,
  onSetMood,
}: {
  state: AppState
  monthDays: string[]
  moodPickerDay: string | null
  onMoodPickerDayChange: (iso: string | null) => void
  onSetMood: (isoDate: string, mood: string | null) => void
}) {
  const byDay = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeSectionCompletion>> = {}
    for (const isoDate of monthDays) {
      map[isoDate] = computeSectionCompletion(state.days[isoDate]?.tasks ?? [])
    }
    return map
  }, [state.days, monthDays])

  const dayTotals = useMemo(() => {
    const out: Record<string, { total: number; completed: number }> = {}
    for (const isoDate of monthDays) {
      const day = computeDayCompletion(state, isoDate)
      out[isoDate] = { total: day.totalCount, completed: day.completedCount }
    }
    return out
  }, [state, monthDays])

  const dayHeaderCell =
    'border border-slate-700 bg-slate-950 px-0.5 py-1 text-center text-slate-500 w-7 min-w-[1.75rem] max-w-[1.75rem]'
  const dayBodyCell = 'border border-slate-700 p-0 text-center w-7 min-w-[1.75rem] max-w-[1.75rem]'

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-slate-300 mb-1">Block completion rate</h4>
      <p className="text-[10px] text-slate-500 mb-2">
        From your planner tasks. Rate per block (not individual tasks) so it stays accurate as tasks change.
        <span className="ml-2 text-sky-400">✓ = 100%</span>
        <span className="ml-1 text-amber-300">n/m = partial</span>
        <span className="ml-1 text-red-400/70">0%</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-xs table-fixed">
          <colgroup>
            <col className="w-24" />
            {monthDays.map((isoDate) => (
              <col key={isoDate} className="w-7" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border border-slate-700 bg-slate-950 px-1 py-1 text-left font-medium text-slate-400">
                Block
              </th>
              {monthDays.map((isoDate) => (
                <th key={isoDate} className={dayHeaderCell}>
                  {isoDate.split('-')[2]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Overall day row: weighted completion rate (percentage) */}
            <tr>
              <td className="border border-slate-700 bg-slate-950 px-1 py-0.5 font-medium text-slate-400 whitespace-nowrap">
                Day
              </td>
              {monthDays.map((isoDate) => {
                const { total, completed } = dayTotals[isoDate] ?? { total: 0, completed: 0 }
                const pct = total > 0 ? (completed / total) * 100 : 0
                return (
                  <td
                    key={isoDate}
                    title={total > 0 ? `${completed.toFixed(1)}/${total.toFixed(1)} pts` : 'No tasks'}
                    className={`${dayBodyCell} ${blockCellClass(total, completed)}`}
                  >
                    <div className="flex h-6 w-full items-center justify-center">
                      {total === 0 ? (
                        <span className="text-slate-600">·</span>
                      ) : pct >= 100 ? (
                        <span className="text-sky-400 font-medium">✓</span>
                      ) : (
                        <span className="text-[9px] leading-none text-amber-300">{Math.round(pct)}%</span>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
            {/* Mode row: auto-computed badge from overall completion % */}
            <tr>
              <td className="border border-slate-700 bg-slate-950 px-1 py-0.5 font-medium text-slate-400 whitespace-nowrap">
                Mode
              </td>
              {monthDays.map((isoDate) => {
                const { total, completed } = dayTotals[isoDate] ?? { total: 0, completed: 0 }
                const mode = computeDayMode(total, completed)
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                return (
                  <td
                    key={isoDate}
                    className={`${dayBodyCell} bg-slate-950`}
                    title={mode ? `${mode.label} (${pct}%)` : 'No tasks'}
                  >
                    <div className="flex h-6 w-full items-center justify-center text-base leading-none">
                      {mode ? mode.emoji : <span className="text-slate-600">·</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
            {FIXED_SECTIONS.map((section) => (
              <tr key={section.id}>
                <td className="border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-300 whitespace-nowrap">
                  {SECTION_SHORT_LABELS[section.id] ?? section.id}
                </td>
                {monthDays.map((isoDate) => {
                  const entry = byDay[isoDate]?.[section.id]
                  const total = entry?.total ?? 0
                  const completed = entry?.completed ?? 0
                  return (
                    <td
                      key={isoDate}
                      title={total > 0 ? `${completed}/${total} (${total ? Math.round((completed / total) * 100) : 0}%)` : 'No tasks'}
                      className={`${dayBodyCell} ${blockCellClass(total, completed)}`}
                    >
                      <div className="flex h-6 w-full items-center justify-center">
                        {blockCellContent(total, completed)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="border border-slate-700 bg-slate-900 px-1 py-0.5 font-medium text-slate-400 whitespace-nowrap">
                Mood
              </td>
              {monthDays.map((isoDate) => {
                const day = state.days[isoDate]
                const mood = day?.mood ?? null
                const dayNum = isoDate.split('-')[2]
                const isOpen = moodPickerDay === isoDate
                return (
                  <td key={isoDate} className={`${dayBodyCell} align-top bg-slate-900`}>
                    <div className="relative flex h-6 w-full items-center justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          onMoodPickerDayChange(isOpen ? null : isoDate)
                        }
                        className="flex h-full w-full items-center justify-center rounded-sm text-base leading-none hover:bg-slate-800/80"
                        title={`Day ${dayNum}: set mood`}
                      >
                        {mood ?? '·'}
                      </button>
                      {isOpen && (
                        <div className="absolute left-0 top-full z-20 mt-1 flex max-w-[220px] flex-wrap gap-1 rounded border border-slate-700 bg-slate-950 p-2 shadow-lg">
                          {MOOD_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onSetMood(isoDate, emoji)}
                              className="text-xl hover:scale-125 focus:outline-none"
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => onSetMood(isoDate, null)}
                            className="text-xs text-slate-500 hover:text-slate-300"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

