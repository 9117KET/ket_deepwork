/**
 * components/planner/WeeklyOverview.tsx
 *
 * Compact progress dashboard: day, week, month, and year views.
 * Keeps the UI simple while giving a quick sense of how you're doing.
 */

import { useState } from 'react'
import type { AppState } from '../../domain/types'
import { computeDayCompletion, computeWeeklyStats } from '../../domain/stats'

interface WeeklyOverviewProps {
  state: AppState
  referenceDay: string
}

function formatShortLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map((part) => Number(part))
  const date = new Date(year, month - 1, day)
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  })
  const weekday = formatter.format(date)
  return `${weekday} ${String(day).padStart(2, '0')}`
}

export function WeeklyOverview({ state, referenceDay }: WeeklyOverviewProps) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'year'>('week')
  const stats = computeWeeklyStats(state, referenceDay)
  const today = computeDayCompletion(state, referenceDay)
  const todayRatio = today.totalCount === 0 ? 0 : today.completedCount / today.totalCount
  const todayPercentage = today.totalCount === 0 ? 0 : parseFloat((todayRatio * 100).toFixed(1))

  const [refYear, refMonth] = referenceDay.split('-').map((part) => Number(part))

  let monthCompleted = 0
  let monthTotal = 0
  let yearCompleted = 0
  let yearTotal = 0

  for (const [isoDay, dayState] of Object.entries(state.days)) {
    if (!dayState) continue
    const [y, m] = isoDay.split('-').map((part) => Number(part))
    // Reuse the same weighted scoring so month/year stats are consistent
    const { totalCount, completedCount } = computeDayCompletion(state, isoDay)

    if (y === refYear) {
      yearCompleted += completedCount
      yearTotal += totalCount
      if (m === refMonth) {
        monthCompleted += completedCount
        monthTotal += totalCount
      }
    }
  }

  const monthPercentage = monthTotal === 0 ? 0 : parseFloat(((monthCompleted / monthTotal) * 100).toFixed(1))

  return (
    <section
      id="progress-dashboard"
      className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">Progress</h3>
          <p className="text-xs text-slate-400">Year overview of your tasks.</p>
        </div>
        <div className="inline-flex self-start rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">
          {(['day', 'week', 'month', 'year'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`px-2 py-1 first:rounded-l-full last:rounded-r-full ${
                view === key
                  ? 'bg-sky-600 text-slate-950'
                  : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-3 rounded-md bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
        {view === 'day' && (
          <>
            {today.totalCount === 0 ? (
              <p>
                You haven&apos;t planned any tasks for today yet. Add your 3 must-dos and let the day
                flow from there.
              </p>
            ) : (
              <p>
                You&apos;re{' '}
                <span className="font-semibold text-sky-400">{todayPercentage.toFixed(1)}%</span> done with
                today&apos;s tasks ({today.completedCount.toFixed(1)}/{today.totalCount.toFixed(1)}). Nice work. Keep your
                focus blocks honest and kind to yourself.
              </p>
            )}
          </>
        )}
        {view === 'week' && (
          <p>
            This week you&apos;ve completed{' '}
            <span className="font-semibold text-sky-400">{stats.totalCompleted.toFixed(1)}</span> of{' '}
            <span className="font-semibold">{stats.totalTasks.toFixed(1)}</span> planned tasks. Keep stacking
            small wins.
          </p>
        )}
        {view === 'month' && (
          <p>
            This month you&apos;re at{' '}
            <span className="font-semibold text-sky-400">{monthPercentage.toFixed(1)}%</span> completion (
            {monthCompleted.toFixed(1)}/{monthTotal.toFixed(1)} tasks).
          </p>
        )}
        {view === 'year' && (
          <p>
            This year you&apos;ve finished{' '}
            <span className="font-semibold text-sky-400">{yearCompleted.toFixed(1)}</span> of{' '}
            <span className="font-semibold">{yearTotal.toFixed(1)}</span> tasks you planned.
          </p>
        )}
      </div>

      {view === 'week' && (
        <div className="space-y-1.5">
          {stats.days.map((day) => {
            const ratio = day.totalCount === 0 ? 0 : day.completedCount / day.totalCount
            const percentage = day.totalCount === 0 ? 0 : parseFloat((ratio * 100).toFixed(1))

            return (
              <div key={day.date} className="flex items-center gap-2">
                <div className="w-20 text-xs text-slate-400">{formatShortLabel(day.date)}</div>
                <div className="flex-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-900">
                    <div
                      className="h-1.5 rounded-full bg-sky-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-slate-400">{percentage.toFixed(1)}%</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

