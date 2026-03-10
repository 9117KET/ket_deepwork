/**
 * components/tracking/MonthlyTrackingDashboard.tsx
 *
 * Monthly tracking: habits grid, sleep line chart, mood row.
 * Uses existing AppState and callbacks so persistence stays in the parent.
 */

import type React from 'react'
import { useState, useMemo, useCallback } from 'react'
import type { AppState, DayState, HabitDefinition } from '../../domain/types'
import { DEFAULT_HABIT_DEFINITIONS, FIXED_SECTIONS } from '../../domain/types'
import {
  toMonthId,
  previousMonthId,
  nextMonthId,
  daysInMonth,
} from '../../domain/dateUtils'
import { getOrCreateDay } from '../../storage/localStorageState'
import { computeSectionCompletion } from '../../domain/stats'

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
  const [editHabitsOpen, setEditHabitsOpen] = useState(false)
  const [moodPickerDay, setMoodPickerDay] = useState<string | null>(null)
  const [sleepPickerDay, setSleepPickerDay] = useState<string | null>(null)

  const habits = state.habitDefinitions?.length
    ? state.habitDefinitions
    : DEFAULT_HABIT_DEFINITIONS
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

  const handleToggleHabit = useCallback(
    (isoDate: string, habitId: string) => {
      const day = getOrCreateDay(state, isoDate)
      const current = day.habitCompletions?.[habitId] ?? false
      onUpdateDay(isoDate, {
        ...day,
        habitCompletions: { ...(day.habitCompletions ?? {}), [habitId]: !current },
      })
    },
    [state, onUpdateDay],
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

  const totalPointsPerDay = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const isoDate of monthDays) {
      const day = state.days[isoDate]
      const completions = day?.habitCompletions ?? {}
      totals[isoDate] = habits.filter((h) => completions[h.id]).length
    }
    return totals
  }, [state.days, monthDays, habits])

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
          <p className="text-xs text-slate-400">Habits, sleep, and mood.</p>
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

      {/* Habit grid */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">30 Day Dashboard</span>
          <button
            type="button"
            onClick={() => setEditHabitsOpen(true)}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            Edit habits
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-slate-700 bg-slate-950 px-1 py-1 text-left font-medium text-slate-400 w-32">
                  Habits
                </th>
                {monthDays.map((isoDate) => {
                  const d = isoDate.split('-')[2]
                  return (
                    <th
                      key={isoDate}
                      className="border border-slate-700 bg-slate-950 px-0.5 py-1 text-center text-slate-500 w-7"
                    >
                      {d}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit.id}>
                  <td className="border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200">
                    {habit.label}
                  </td>
                  {monthDays.map((isoDate) => {
                    const day = state.days[isoDate]
                    const checked = (day?.habitCompletions ?? {})[habit.id] ?? false
                    return (
                      <td
                        key={isoDate}
                        className="border border-slate-700 bg-slate-900 p-0 text-center"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleHabit(isoDate, habit.id)}
                          className="h-6 w-full hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          aria-label={`${habit.label} ${isoDate} ${checked ? 'done' : 'not done'}`}
                        >
                          {checked ? (
                            <span className="text-sky-400" aria-hidden>✓</span>
                          ) : (
                            <span className="text-slate-600">·</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td className="border border-slate-700 bg-slate-950 px-1 py-1 font-medium text-slate-400">
                  Total Points
                </td>
                {monthDays.map((isoDate) => (
                  <td
                    key={isoDate}
                    className="border border-slate-700 bg-slate-950 px-0.5 py-1 text-center text-slate-300"
                  >
                    {totalPointsPerDay[isoDate] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Block completion grid */}
      <BlockCompletionGrid state={state} monthDays={monthDays} />

      {editHabitsOpen && (
        <EditHabitsModal
          habits={habits}
          onSave={(next) => {
            onUpdateSettings({ habitDefinitions: next })
            setEditHabitsOpen(false)
          }}
          onClose={() => setEditHabitsOpen(false)}
        />
      )}
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
  // Pre-compute section completion for every day in the month.
  const byDay = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeSectionCompletion>> = {}
    for (const isoDate of monthDays) {
      map[isoDate] = computeSectionCompletion(state.days[isoDate]?.tasks ?? [])
    }
    return map
  }, [state.days, monthDays])

  // Only show sections that have at least one task anywhere in this month.
  const activeSections = useMemo(
    () =>
      FIXED_SECTIONS.filter((s) =>
        monthDays.some((d) => (byDay[d]?.[s.id]?.total ?? 0) > 0),
      ),
    [byDay, monthDays],
  )

  if (activeSections.length === 0) {
    return (
      <div className="mt-4">
        <h4 className="text-xs font-medium text-slate-300 mb-2">Block Completion</h4>
        <p className="text-xs text-slate-500">No tasks logged this month yet.</p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-slate-300 mb-1">Block Completion</h4>
      <p className="text-[10px] text-slate-500 mb-2">
        How many tasks were completed in each planner block per day.
        <span className="ml-2 text-sky-400">✓ = all done</span>
        <span className="ml-1 text-amber-300">n/m = partial</span>
        <span className="ml-1 text-red-400/70">red = nothing done</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-700 bg-slate-950 px-1 py-1 text-left font-medium text-slate-400 w-20">
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
            {activeSections.map((section) => (
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
                      title={total > 0 ? `${completed}/${total} done` : 'No tasks'}
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

function createHabitId(): string {
  return `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function EditHabitsModal({
  habits,
  onSave,
  onClose,
}: {
  habits: HabitDefinition[]
  onSave: (next: HabitDefinition[]) => void
  onClose: () => void
}) {
  const [list, setList] = useState<HabitDefinition[]>(() => [...habits])

  const handleAdd = () => {
    setList((prev) => [...prev, { id: createHabitId(), label: 'New habit' }])
  }

  const handleRemove = (id: string) => {
    setList((prev) => prev.filter((h) => h.id !== id))
  }

  const handleLabelChange = (id: string, label: string) => {
    setList((prev) =>
      prev.map((h) => (h.id === id ? { ...h, label } : h)),
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit habits"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
        <h4 className="text-sm font-semibold text-slate-100 mb-3">Edit habits</h4>
        <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              <input
                type="text"
                value={h.label}
                onChange={(e) => handleLabelChange(h.id, e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-sky-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemove(h.id)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-red-500/20 hover:text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleAdd}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:border-sky-600"
          >
            Add habit
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(list)}
              className="rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs text-slate-950 hover:bg-sky-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
