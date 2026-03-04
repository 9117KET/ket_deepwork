/**
 * components/planner/WeeklyOverview.tsx
 *
 * Shows a compact summary of this week's task completion.
 */

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
  const stats = computeWeeklyStats(state, referenceDay)
  const today = computeDayCompletion(state, referenceDay)
  const todayRatio = today.totalCount === 0 ? 0 : today.completedCount / today.totalCount
  const todayPercentage = today.totalCount === 0 ? 0 : Math.round(todayRatio * 100)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">Weekly overview</h3>
          <p className="text-xs text-slate-400">Tasks completed this week</p>
        </div>
        <p className="text-xs text-slate-400">
          {stats.totalCompleted}/{stats.totalTasks} done
        </p>
      </header>

      <div className="mb-3 rounded-md bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
        {today.totalCount === 0 ? (
          <p>
            You haven&apos;t planned any tasks for today yet. Add your 3 must-dos and let the day
            flow from there.
          </p>
        ) : (
          <p>
            You&apos;re{' '}
            <span className="font-semibold text-sky-400">{todayPercentage}%</span> done with
            today&apos;s tasks ({today.completedCount}/{today.totalCount}). Nice work. Keep your
            focus blocks honest and kind to yourself.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {stats.days.map((day) => {
          const ratio = day.totalCount === 0 ? 0 : day.completedCount / day.totalCount
          const percentage = day.totalCount === 0 ? 0 : Math.round(ratio * 100)

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
              <div className="w-16 text-right text-xs text-slate-400">{percentage}%</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

