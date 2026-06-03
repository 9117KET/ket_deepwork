/**
 * components/tracking/MonthlyTrackingDashboard.tsx
 *
 * Monthly tracking: block (section) completion from planner tasks and mood per day.
 * Mood shares the block-completion table so day columns align vertically.
 */

import { useState, useMemo, useCallback, useRef, useEffect, Component } from 'react'
import type React from 'react'
import type { AppState, DayState, GoalCascade, HabitDefinition, MonthlyReview, WeeklyReview } from '../../domain/types'
import { DEFAULT_HABIT_DEFINITIONS, FIXED_SECTIONS } from '../../domain/types'
import { GoalCascadeSection } from '../goals/GoalCascadeSection'
import { MonthlyReviewCard } from '../goals/MonthlyReviewCard'
import { WeeklyReviewCard } from '../goals/WeeklyReviewCard'
import { ReviewReminderModal } from '../goals/ReviewReminderModal'
import { isReviewReminderDismissed, dismissReviewReminder } from '../goals/reviewReminderUtils'
import {
  toMonthId,
  previousMonthId,
  nextMonthId,
  daysInMonth,
  todayIso,
  weekdayName,
  isWeeklyReviewDay,
} from '../../domain/dateUtils'
import { getOrCreateDay } from '../../storage/localStorageState'
import { computeSectionCompletion, computeDayCompletion, computePerHabitStreaks, computeDailyDeepWorkMinutes, computeWeeklyDeepWorkHours, moodByDeepWork, moodByHabits } from '../../domain/stats'
import { weekForDay } from '../../domain/dateUtils'

const MOOD_OPTIONS = ['🙂', '😐', '🙁', '😊', '😢', '😤', '😴', '🔥'] as const

interface MonthlyTrackingDashboardProps {
  state: AppState
  referenceDay: string
  onUpdateDay: (isoDate: string, dayState: DayState) => void
  onUpdateSettings: (patch: {
    habitDefinitions?: HabitDefinition[]
    monthTitles?: Record<string, string>
    depthPhilosophy?: AppState['depthPhilosophy']
    deepWorkGoalHoursPerWeek?: number
    goalCascade?: GoalCascade
    monthlyReviews?: Record<string, MonthlyReview>
    weeklyReviews?: Record<string, WeeklyReview>
    weeklyReviewDay?: AppState['weeklyReviewDay']
    weeklyReviewQuestions?: AppState['weeklyReviewQuestions']
  }) => void
  /** Increment to scroll to and expand the monthly review card. */
  scrollToReview?: number
  /** Increment to scroll to and expand the weekly review card. */
  weeklyReviewOpenTrigger?: number
  /** Handler to save weekly review updates. */
  onUpdateWeeklyReview?: (dateKey: string, review: WeeklyReview) => void
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
  scrollToReview,
  weeklyReviewOpenTrigger,
  onUpdateWeeklyReview,
}: MonthlyTrackingDashboardProps) {
  const [selectedMonthId, setSelectedMonthId] = useState(() => toMonthId(referenceDay))
  const [moodPickerDay, setMoodPickerDay] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [editingReviewDay, setEditingReviewDay] = useState(false)
  const reviewRef = useRef<HTMLDivElement>(null)
  const weeklyReviewRef = useRef<HTMLDivElement>(null)
  // Internal force-open counters so the reminder modal can expand cards without needing parent props
  const [localScrollToReview, setLocalScrollToReview] = useState(0)
  const [localWeeklyTrigger, setLocalWeeklyTrigger] = useState(0)
  const effectiveScrollToReview = (scrollToReview ?? 0) + localScrollToReview
  const effectiveWeeklyTrigger = (weeklyReviewOpenTrigger ?? 0) + localWeeklyTrigger

  // Determine which review reminder to show (if any). Weekly takes priority.
  const today = todayIso()
  const reviewWeekday = state.weeklyReviewDay ?? 5
  const currentMonthKey = today.slice(0, 7)
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
  const lastDayOfMonth = new Date(todayYear!, todayMonth!, 0).getDate()
  const isMonthlyReviewDue =
    Number(todayDay) >= lastDayOfMonth - 2 &&
    currentMonthKey === selectedMonthId &&
    !state.monthlyReviews?.[currentMonthKey]?.completedAt
  const isWeeklyReviewDue =
    isWeeklyReviewDay(today, reviewWeekday) &&
    !state.weeklyReviews?.[referenceDay]?.completedAt
  const [reminderDismissed, setReminderDismissed] = useState(() => ({
    weekly: isReviewReminderDismissed('weekly'),
    monthly: isReviewReminderDismissed('monthly'),
  }))
  const activeReminder: 'weekly' | 'monthly' | null =
    isWeeklyReviewDue && !reminderDismissed.weekly ? 'weekly'
    : isMonthlyReviewDue && !reminderDismissed.monthly ? 'monthly'
    : null

  useEffect(() => {
    if (effectiveScrollToReview > 0) {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [effectiveScrollToReview])

  useEffect(() => {
    if (effectiveWeeklyTrigger > 0) {
      weeklyReviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [effectiveWeeklyTrigger])

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

  const handleUpdateCascade = useCallback(
    (cascade: GoalCascade) => {
      onUpdateSettings({ goalCascade: cascade })
    },
    [onUpdateSettings],
  )

  // Mood correlation insights
  const habitIds = useMemo(
    () => (state.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS).map(h => h.id),
    [state.habitDefinitions],
  )
  const moodDwInsight = useMemo(
    () => moodByDeepWork(state.days, monthDays),
    [state.days, monthDays],
  )
  const moodHabitInsight = useMemo(
    () => moodByHabits(state.days, habitIds, monthDays),
    [state.days, habitIds, monthDays],
  )

  const handleUpdateReview = useCallback(
    (monthKey: string, review: MonthlyReview) => {
      onUpdateSettings({
        monthlyReviews: { ...(state.monthlyReviews ?? {}), [monthKey]: review },
      })
    },
    [onUpdateSettings, state.monthlyReviews],
  )

  return (
    <section
      id="tracking-dashboard"
      className="rounded-lg border border-share-outlineVariant/30 bg-share-surfaceContainerLow p-3 sm:p-4"
      aria-label="Monthly tracking"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-share-onBg">
            Monthly tracking
          </h3>
          <p className="text-xs text-share-onSurfaceVariant">Block completion and mood by day.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonthId(previousMonthId(selectedMonthId))}
            className="rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onSurface hover:border-sky-600 hover:text-sky-300"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-share-onBg">
            {monthLabel(selectedMonthId)}
          </span>
          <button
            type="button"
            onClick={() => setSelectedMonthId(nextMonthId(selectedMonthId))}
            className="rounded border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onSurface hover:border-sky-600 hover:text-sky-300"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </header>

      <GoalCascadeSection
        goalCascade={state.goalCascade}
        onUpdate={handleUpdateCascade}
      />

      <div className="mb-3">
        <label className="block text-xs text-share-onSurfaceVariant mb-1">This chapter is called:</label>
        <input
          type="text"
          value={chapterTitle}
          onChange={(e) => handleSetChapterTitle(e.target.value)}
          placeholder="e.g. The Foundation"
          className="w-full rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-1.5 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-sky-600 focus:outline-none"
        />
      </div>

      {(() => {
        const weekDays = weekForDay(referenceDay).days
        const weeklyHours = computeWeeklyDeepWorkHours(state.days, weekDays)
        const goalHours = state.deepWorkGoalHoursPerWeek ?? 20
        const progressPct = Math.min(100, (weeklyHours / goalHours) * 100)
        const maxDayMinutes = Math.max(
          1,
          ...weekDays.map((d) => computeDailyDeepWorkMinutes(state.days[d]))
        )
        return (
          <div className="mb-4 rounded border border-share-outlineVariant/30 bg-share-surfaceContainerLow p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-teal-300">Deep Work This Week</span>
              <span className="flex items-center gap-1 text-xs text-share-onSurfaceVariant">
                {weeklyHours.toFixed(1)}h /&nbsp;
                {editingGoal ? (
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={goalInput}
                    autoFocus
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={() => {
                      const v = Number(goalInput)
                      if (v > 0) onUpdateSettings({ deepWorkGoalHoursPerWeek: v })
                      setEditingGoal(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditingGoal(false)
                    }}
                    className="w-10 rounded border border-teal-600 bg-share-surfaceContainerHigh px-1 py-0.5 text-xs text-share-onBg focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setGoalInput(String(goalHours)); setEditingGoal(true) }}
                    className="rounded px-0.5 text-teal-400 underline decoration-dotted hover:text-teal-300"
                    title="Click to edit weekly goal"
                  >
                    {goalHours}h
                  </button>
                )}
                &nbsp;goal
              </span>
            </div>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-share-outlineVariant/25">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-end justify-between gap-0.5">
              {weekDays.map((d) => {
                const mins = computeDailyDeepWorkMinutes(state.days[d])
                const barPct = Math.round((mins / maxDayMinutes) * 100)
                const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="flex h-8 w-full items-end justify-center">
                      {mins > 0 && (
                        <div
                          className="w-full max-w-[1.5rem] rounded-t bg-teal-500/70"
                          style={{ height: `${Math.max(4, barPct)}%` }}
                          title={`${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-share-onSurfaceVariant/50">{dayLabel}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 border-t border-share-outlineVariant/30 pt-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-share-onSurfaceVariant/50">Depth Philosophy</div>
              <div className="flex gap-1.5">
                {(['rhythmic', 'journalistic', 'bimodal'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdateSettings({ depthPhilosophy: state.depthPhilosophy === p ? undefined : p })}
                    className={`rounded border px-2 py-0.5 text-xs capitalize transition-colors ${
                      state.depthPhilosophy === p
                        ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                        : 'border-share-outlineVariant/40 bg-share-surfaceContainerHigh text-share-onSurfaceVariant hover:border-share-outlineVariant/60 hover:text-share-onBg'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 border-t border-share-outlineVariant/30 pt-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-share-onSurfaceVariant/50">Weekly Review Day</div>
              {editingReviewDay ? (
                <select
                  autoFocus
                  defaultValue={state.weeklyReviewDay ?? 5}
                  onChange={e => {
                    onUpdateSettings({ weeklyReviewDay: Number(e.target.value) as 1|2|3|4|5|6|7 })
                    setEditingReviewDay(false)
                  }}
                  onBlur={() => setEditingReviewDay(false)}
                  className="rounded border border-sky-600 bg-share-surfaceContainerHigh px-2 py-0.5 text-xs text-share-onBg focus:outline-none"
                >
                  {([1,2,3,4,5,6,7] as const).map(d => (
                    <option key={d} value={d}>{weekdayName(d)}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingReviewDay(true)}
                  className="rounded px-1 text-xs text-sky-400 underline decoration-dotted hover:text-sky-300"
                  title="Click to change weekly review day"
                >
                  {weekdayName(state.weeklyReviewDay ?? 5)}
                </button>
              )}
            </div>
          </div>
        )
      })()}
      <BlockCompletionGrid
        state={state}
        monthDays={monthDays}
        moodPickerDay={moodPickerDay}
        onMoodPickerDayChange={setMoodPickerDay}
        onSetMood={handleSetMood}
      />

      {/* Mood correlation insights */}
      {(moodDwInsight.highAvg != null || moodHabitInsight.highAvg != null) && (
        <div className="mt-3 rounded border border-share-outlineVariant/25 bg-share-surfaceContainerLow p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-share-onSurfaceVariant/50">
            Mood insights this month
          </p>
          <div className="space-y-1.5">
            {moodDwInsight.highAvg != null && moodDwInsight.lowAvg != null && (
              <p className="text-xs text-share-onSurfaceVariant">
                Your mood averages{' '}
                <span className="font-semibold text-teal-300">{moodDwInsight.highAvg}/5</span> on days
                with 2+ h deep work vs.{' '}
                <span className="font-semibold text-share-onSurface">{moodDwInsight.lowAvg}/5</span> on
                lighter days.
              </p>
            )}
            {moodHabitInsight.highAvg != null && moodHabitInsight.lowAvg != null && (
              <p className="text-xs text-share-onSurfaceVariant">
                Your mood averages{' '}
                <span className="font-semibold text-sky-300">{moodHabitInsight.highAvg}/5</span> when
                you complete 60%+ of habits vs.{' '}
                <span className="font-semibold text-share-onSurface">{moodHabitInsight.lowAvg}/5</span>{' '}
                on lower-completion days.
              </p>
            )}
            <p className="text-[9px] italic text-share-onSurfaceVariant/40">
              Based on {monthDays.filter(d => state.days[d]?.mood).length} mood-logged days this month.
              Min 3 per group for an insight to appear.
            </p>
          </div>
        </div>
      )}

      <div ref={reviewRef}>
        <MonthlyReviewCard
          monthKey={selectedMonthId}
          questions={state.monthlyReviewQuestions ?? []}
          review={state.monthlyReviews?.[selectedMonthId]}
          onUpdate={handleUpdateReview}
          forceOpen={effectiveScrollToReview}
        />
      </div>

      {/* Weekly review card */}
      {onUpdateWeeklyReview && (
        <div ref={weeklyReviewRef}>
          <WeeklyReviewCard
            dateKey={referenceDay}
            questions={state.weeklyReviewQuestions ?? []}
            review={state.weeklyReviews?.[referenceDay]}
            onUpdate={onUpdateWeeklyReview}
            forceOpen={effectiveWeeklyTrigger}
          />
        </div>
      )}

      {/* Review reminder popup — shown once per session when a review is due */}
      {activeReminder && (
        <ReviewReminderModal
          type={activeReminder}
          onGoToReview={() => {
            if (activeReminder === 'monthly') {
              setLocalScrollToReview(v => v + 1)
            } else {
              setLocalWeeklyTrigger(v => v + 1)
            }
            dismissReviewReminder(activeReminder)
            setReminderDismissed(prev => ({ ...prev, [activeReminder]: true }))
          }}
          onDismiss={() => {
            dismissReviewReminder(activeReminder)
            setReminderDismissed(prev => ({ ...prev, [activeReminder]: true }))
          }}
        />
      )}

      <HabitGridBoundary>
        <HabitTrackingGrid
          state={state}
          monthDays={monthDays}
        />
      </HabitGridBoundary>

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
  if (total === 0) return <span className="text-share-onSurfaceVariant/40">·</span>
  if (completed >= total) return <span className="text-sky-400 font-medium">✓</span>
  return (
    <span className="text-[9px] leading-none text-amber-300">
      {completed}/{total}
    </span>
  )
}

/** Error boundary so a crash in the habit grid never takes down the block-completion grid. */
class HabitGridBoundary extends Component<{ children: React.ReactNode }, { error: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: false, message: '' }
  }
  static getDerivedStateFromError(error: unknown) {
    return { error: true, message: String(error) }
  }
  override componentDidCatch(error: unknown) {
    console.error('[HabitTrackingGrid] render error:', error)
  }
  override render() {
    if (this.state.error) {
      return (
        <p className="mt-2 text-xs text-red-400">
          Habit grid failed to render — check the console for details.
        </p>
      )
    }
    return this.props.children
  }
}

function HabitTrackingGrid({
  state,
  monthDays,
}: {
  state: AppState
  monthDays: string[]
}) {
  const habits = state.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS
  if (habits.length === 0) return null

  // Compute streaks as of today (or the last day of the visible month, whichever is earlier).
  const today = todayIso()
  const lastMonthDay = monthDays[monthDays.length - 1] ?? today
  const untilDate = lastMonthDay <= today ? lastMonthDay : today

  const habitIds = habits.map((h) => h.id)
  const streaks = computePerHabitStreaks(state.days, habitIds, untilDate)

  const dayHeaderCell =
    'border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-0.5 py-1 text-center text-share-onSurfaceVariant/50 w-7 min-w-[1.75rem] max-w-[1.75rem]'
  const dayBodyCell = 'border border-share-outlineVariant/30 p-0 text-center w-7 min-w-[1.75rem] max-w-[1.75rem]'

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-share-onSurface mb-1">Habit tracking</h4>
      <p className="text-[10px] text-share-onSurfaceVariant/50 mb-2">
        Check off each habit daily. Streak = consecutive completed days.
        <span className="ml-2 text-sky-400">✓ = done</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-xs table-fixed">
          <colgroup>
            <col className="w-24" />
            {monthDays.map((d) => (
              <col key={d} className="w-7" />
            ))}
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-1 py-1 text-left font-medium text-share-onSurfaceVariant">
                Habit
              </th>
              {monthDays.map((isoDate) => (
                <th key={isoDate} className={dayHeaderCell}>
                  {isoDate.split('-')[2]}
                </th>
              ))}
              <th className="border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-1 py-1 text-center font-medium text-share-onSurfaceVariant">
                🔥
              </th>
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => (
              <tr key={habit.id}>
                <td
                  className="border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-1 py-0.5 text-share-onSurface whitespace-nowrap overflow-hidden text-ellipsis max-w-[6rem]"
                  title={habit.label}
                >
                  {habit.label}
                </td>
                {monthDays.map((isoDate) => {
                  const done = state.days[isoDate]?.habitCompletions?.[habit.id] === true
                  return (
                    <td
                      key={isoDate}
                      className={`${dayBodyCell} ${done ? 'bg-sky-500/20' : 'bg-share-surfaceContainerLow'}`}
                      title={done ? 'Completed' : 'Not completed'}
                    >
                      <div className="flex h-6 w-full items-center justify-center">
                        {done ? (
                          <span className="text-sky-400 font-medium">✓</span>
                        ) : (
                          <span className="text-share-onSurfaceVariant/40">·</span>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-1 py-0.5 text-center">
                  {(streaks[habit.id] ?? 0) > 0 ? (
                    <span className="text-xs text-orange-400">{streaks[habit.id]}</span>
                  ) : (
                    <span className="text-share-onSurfaceVariant/40">·</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    'border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-0.5 py-1 text-center text-share-onSurfaceVariant/50 w-7 min-w-[1.75rem] max-w-[1.75rem]'
  const dayBodyCell = 'border border-share-outlineVariant/30 p-0 text-center w-7 min-w-[1.75rem] max-w-[1.75rem]'

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-share-onSurface mb-1">Block completion rate</h4>
      <p className="text-[10px] text-share-onSurfaceVariant/50 mb-2">
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
              <th className="border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-1 py-1 text-left font-medium text-share-onSurfaceVariant">
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
              <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-1 py-0.5 font-medium text-share-onSurfaceVariant whitespace-nowrap">
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
                        <span className="text-share-onSurfaceVariant/40">·</span>
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
              <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerLow px-1 py-0.5 font-medium text-share-onSurfaceVariant whitespace-nowrap">
                Mode
              </td>
              {monthDays.map((isoDate) => {
                const { total, completed } = dayTotals[isoDate] ?? { total: 0, completed: 0 }
                const mode = computeDayMode(total, completed)
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                return (
                  <td
                    key={isoDate}
                    className={`${dayBodyCell} bg-share-surfaceContainerLow`}
                    title={mode ? `${mode.label} (${pct}%)` : 'No tasks'}
                  >
                    <div className="flex h-6 w-full items-center justify-center text-base leading-none">
                      {mode ? mode.emoji : <span className="text-share-onSurfaceVariant/40">·</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
            {FIXED_SECTIONS.map((section) => (
              <tr key={section.id}>
                <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-1 py-0.5 text-share-onSurface whitespace-nowrap">
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
              <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-1 py-0.5 text-share-onSurfaceVariant whitespace-nowrap">
                Abandoned
              </td>
              {monthDays.map((isoDate) => {
                const count = state.days[isoDate]?.abandonedTasks?.length ?? 0
                return (
                  <td
                    key={isoDate}
                    className={`${dayBodyCell} bg-share-surfaceContainerHigh`}
                    title={count > 0 ? `${count} task${count === 1 ? '' : 's'} abandoned` : 'None abandoned'}
                  >
                    <div className="flex h-6 w-full items-center justify-center">
                      {count > 0 ? (
                        <span className="text-[9px] leading-none text-share-onSurfaceVariant">{count}</span>
                      ) : (
                        <span className="text-share-onSurfaceVariant/40">·</span>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
            <tr>
              <td className="border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-1 py-0.5 font-medium text-share-onSurfaceVariant whitespace-nowrap">
                Mood
              </td>
              {monthDays.map((isoDate) => {
                const day = state.days[isoDate]
                const mood = day?.mood ?? null
                const dayNum = isoDate.split('-')[2]
                const isOpen = moodPickerDay === isoDate
                return (
                  <td key={isoDate} className={`${dayBodyCell} align-top bg-share-surfaceContainerHigh`}>
                    <div className="relative flex h-6 w-full items-center justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          onMoodPickerDayChange(isOpen ? null : isoDate)
                        }
                        className="flex h-full w-full items-center justify-center rounded-sm text-base leading-none hover:bg-share-surfaceContainerHighest"
                        title={`Day ${dayNum}: set mood`}
                      >
                        {mood ?? '·'}
                      </button>
                      {isOpen && (
                        <div className="absolute left-0 top-full z-20 mt-1 flex max-w-[220px] flex-wrap gap-1 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow p-2 shadow-lg">
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
                            className="text-xs text-share-onSurfaceVariant/50 hover:text-share-onBg"
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

