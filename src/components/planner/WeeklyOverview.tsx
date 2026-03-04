/**
 * components/planner/WeeklyOverview.tsx
 *
 * Compact progress dashboard: day, week, month, and year views.
 * Keeps the UI simple while giving a quick sense of how you're doing.
 */

import { useState } from 'react'
import type { AppState } from '../../domain/types'
import { computeDayCompletion, computeWeeklyStats } from '../../domain/stats'
import { useLanguage, interpolate } from '../../contexts/LanguageContext'

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
  const { t } = useLanguage()
  const stats = computeWeeklyStats(state, referenceDay)
  const today = computeDayCompletion(state, referenceDay)
  const todayRatio = today.totalCount === 0 ? 0 : today.completedCount / today.totalCount
  const todayPercentage = today.totalCount === 0 ? 0 : Math.round(todayRatio * 100)

  const [refYear, refMonth] = referenceDay.split('-').map((part) => Number(part))

  let monthCompleted = 0
  let monthTotal = 0
  let yearCompleted = 0
  let yearTotal = 0

  for (const [isoDay, dayState] of Object.entries(state.days)) {
    if (!dayState) continue
    const [y, m] = isoDay.split('-').map((part) => Number(part))
    const totalCount = dayState.tasks.length
    const completedCount = dayState.tasks.filter((task) => task.isDone).length

    if (y === refYear) {
      yearCompleted += completedCount
      yearTotal += totalCount
      if (m === refMonth) {
        monthCompleted += completedCount
        monthTotal += totalCount
      }
    }
  }

  const monthPercentage = monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100)

  return (
    <section
      id="progress-dashboard"
      className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">{t('weekly.title')}</h3>
          <p className="text-xs text-slate-400">{t('weekly.subtitle')}</p>
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
              <p>{t('weekly.day.noTasks')}</p>
            ) : (
              <p>
                {interpolate(t('weekly.day.summary'), {
                  percentage: todayPercentage,
                  completed: today.completedCount,
                  total: today.totalCount,
                })}
              </p>
            )}
          </>
        )}
        {view === 'week' && (
          <p>
            {interpolate(t('weekly.week.summary'), {
              completed: stats.totalCompleted,
              total: stats.totalTasks,
            })}
          </p>
        )}
        {view === 'month' && (
          <p>
            {interpolate(t('weekly.month.summary'), {
              percentage: monthPercentage,
              completed: monthCompleted,
              total: monthTotal,
            })}
          </p>
        )}
        {view === 'year' && (
          <p>
            {interpolate(t('weekly.year.summary'), {
              completed: yearCompleted,
              total: yearTotal,
            })}
          </p>
        )}
      </div>

      {view === 'week' && (
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
      )}
    </section>
  )
}

