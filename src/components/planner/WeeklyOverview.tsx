/**
 * components/planner/WeeklyOverview.tsx
 *
 * Shows a compact summary of this week's task completion.
 */

import type { AppState } from '../../domain/types'
import { computeWeeklyStats } from '../../domain/stats'

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
              <div className="w-16 text-right text-xs text-slate-400">
                {day.completedCount}/{day.totalCount}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

