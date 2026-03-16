/**
 * components/tracking/MonthlyTrackingDashboard.tsx
 *
 * Monthly tracking: block (section) completion from planner tasks, sleep, mood.
 * No per-task or custom-habit grid — completion rates per block are derived from
 * actual day tasks so the metric stays accurate as tasks change daily.
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

const SLEEP_HOUR_OPTIONS = [3, 4, 5, 6, 7, 8, 9] as const
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
  const [sleepPickerDay, setSleepPickerDay] = useState<string | null>(null)

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

  const handleSetSleep = useCallback(
    (isoDate: string, hours: number | null) => {
      const day = getOrCreateDay(state, isoDate)
      onUpdateDay(isoDate, { ...day, sleepHours: hours })
      setSleepPickerDay(null)
    },
    [state, onUpdateDay],
  )

  const handleSetMood = useCallback(
    (isoDate: string, mood: string | null) => {
      const day = getOrCreateDay(state, isoDate)
      onUpdateDay(isoDate, { ...day, mood })
      setMoodPickerDay(null)
    },
    [state, onUpdateDay],
  )

  const sleepData = useMemo(() => {
    return monthDays.map((isoDate) => {
      const day = state.days[isoDate]
      const hours = day?.sleepHours
      return { isoDate, hours: hours != null ? Math.min(9, Math.max(3, hours)) : null }
    })
  }, [state.days, monthDays])

  const sleepValues = sleepData.map((d) => d.hours).filter((h): h is number => h != null)
  const sleepMin = sleepValues.length ? Math.min(...sleepValues, 8) : 8
  const sleepMax = 9
  const sleepRange = sleepMax - sleepMin || 1
  const chartHeight = 80
  const sleepPoints = useMemo(() => {
    const defined = sleepData
      .map((d, i) => (d.hours != null ? { i, hours: d.hours } : null))
      .filter((x): x is { i: number; hours: number } => x != null)
    return defined.map(({ i, hours }) => {
      const y = chartHeight - ((hours - sleepMin) / sleepRange) * chartHeight
      return `${i * 8},${y}`
    })
  }, [sleepData, sleepMin, sleepRange])

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
          <p className="text-xs text-slate-400">Block completion, sleep, and mood.</p>
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

      {/* Block completion (from planner tasks) — primary metric; no individual tasks */}
      <BlockCompletionGrid state={state} monthDays={monthDays} />

      {/* Sleep tracker */}
      <div className="mb-4">
        <h4 className="text-xs font-medium text-slate-300 mb-2">Sleep Tracker</h4>
        <div className="flex items-end gap-0.5" style={{ height: chartHeight + 24 }}>
          <div className="flex flex-col justify-between text-[10px] text-slate-500 pr-1 h-full">
            <span>8+</span>
            <span>6</span>
            <span>4</span>
          </div>
          <div className="flex-1 min-w-0">
            <svg
              viewBox={`0 0 ${monthDays.length * 8} ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {sleepPoints.length > 0 && (
                <polyline
                  fill="none"
                  stroke="rgb(56 189 248)"
                  strokeWidth="1.5"
                  points={sleepPoints.join(' ')}
                />
              )}
            </svg>
            <div className="flex justify-between mt-0.5 text-[10px] text-slate-500">
              {monthDays.map((isoDate, i) => (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() =>
                    setSleepPickerDay(sleepPickerDay === isoDate ? null : isoDate)
                  }
                  className="flex-1 min-w-0 truncate hover:text-sky-400"
                  title={`Day ${i + 1}: set sleep`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
        {sleepPickerDay && (
          <div className="mt-2 flex flex-wrap gap-1 p-2 rounded border border-slate-700 bg-slate-950">
            {SLEEP_HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleSetSleep(sleepPickerDay, h)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:border-sky-600"
              >
                {h}h
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSetSleep(sleepPickerDay, null)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-500 hover:border-sky-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Mood tracker */}
      <div>
        <h4 className="text-xs font-medium text-slate-300 mb-2">Mood Tracker</h4>
        <div className="flex gap-0.5 flex-wrap">
          {monthDays.map((isoDate) => {
            const day = state.days[isoDate]
            const mood = day?.mood ?? null
            const dayNum = isoDate.split('-')[2]
            const isOpen = moodPickerDay === isoDate
            return (
              <div key={isoDate} className="relative">
                <button
                  type="button"
                  onClick={() => setMoodPickerDay(isOpen ? null : isoDate)}
                  className="flex flex-col items-center justify-center w-8 h-9 rounded border border-slate-700 bg-slate-800 hover:border-sky-600 text-lg"
                  title={`Day ${dayNum}: set mood`}
                >
                  <span>{mood ?? '·'}</span>
                  <span className="text-[10px] text-slate-500">{dayNum}</span>
                </button>
                {isOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 p-2 rounded border border-slate-700 bg-slate-950 shadow-lg">
                    {MOOD_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleSetMood(isoDate, emoji)}
                        className="text-xl hover:scale-125 focus:outline-none"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleSetMood(isoDate, null)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

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
}: {
  state: AppState
  monthDays: string[]
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
        <table className="w-full min-w-[600px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-700 bg-slate-950 px-1 py-1 text-left font-medium text-slate-400 w-24">
                Block
              </th>
              {monthDays.map((isoDate) => (
                <th
                  key={isoDate}
                  className="border border-slate-700 bg-slate-950 px-0.5 py-1 text-center text-slate-500 w-7"
                >
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
                    className={`border border-slate-700 p-0 text-center ${blockCellClass(total, completed)}`}
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
                      className={`border border-slate-700 p-0 text-center ${blockCellClass(total, completed)}`}
                    >
                      <div className="flex h-6 w-full items-center justify-center">
                        {blockCellContent(total, completed)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

