/**
 * DaySummaryCard
 *
 * Compact cross-section day snapshot shown in the planner sidebar.
 * Surfaces data from Tasks, Deep Work, Habits, Travel, and Finances
 * for the selected day in one glance.
 */

import type { DayContextData } from "../../hooks/useDayContext"

interface Props {
  ctx: DayContextData
}

const MOOD_EMOJI: Record<string, string> = {
  great: "😄",
  good: "🙂",
  okay: "😐",
  bad: "😕",
  terrible: "😞",
}

export function DaySummaryCard({ ctx }: Props) {
  const { tasks, deepWorkMinutes, habitCompletions, mood, sleepHours, activeTrip, expenses } = ctx

  const deepWorkHours = Math.floor(deepWorkMinutes / 60)
  const deepWorkMins = deepWorkMinutes % 60
  const deepWorkLabel = deepWorkMinutes > 0
    ? deepWorkHours > 0 ? `${deepWorkHours}h${deepWorkMins > 0 ? ` ${deepWorkMins}m` : ""}` : `${deepWorkMins}m`
    : null

  const hasAnyData =
    tasks.total > 0 ||
    deepWorkMinutes > 0 ||
    habitCompletions.total > 0 ||
    activeTrip !== null ||
    expenses !== null ||
    mood !== undefined ||
    sleepHours !== undefined

  if (!hasAnyData) return null

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Day at a glance</p>

      <div className="grid grid-cols-2 gap-1.5">
        {tasks.total > 0 && (
          <Chip
            icon="✓"
            label={`${tasks.completed}/${tasks.total} tasks`}
            highlight={tasks.completed === tasks.total && tasks.total > 0}
          />
        )}

        {deepWorkLabel && (
          <Chip icon="⏱" label={`${deepWorkLabel} deep work`} highlight />
        )}

        {habitCompletions.total > 0 && (
          <Chip
            icon="💪"
            label={`${habitCompletions.completed}/${habitCompletions.total} habits`}
            highlight={habitCompletions.completed === habitCompletions.total}
          />
        )}

        {sleepHours !== undefined && (
          <Chip icon="😴" label={`${sleepHours}h sleep`} />
        )}

        {mood && (
          <Chip icon={MOOD_EMOJI[mood] ?? "😐"} label={mood} />
        )}

        {expenses && (
          <Chip
            icon="💰"
            label={`${expenses.currency} ${expenses.total.toFixed(0)} spent`}
          />
        )}
      </div>

      {activeTrip && (
        <div className="flex items-center gap-1.5 rounded-lg border border-teal-500/20 bg-teal-500/8 px-2 py-1.5">
          <span className="text-sm">✈️</span>
          <span className="text-teal-300 font-medium">
            Day {activeTrip.day}/{activeTrip.totalDays} · {activeTrip.destination.split(",")[0]}
          </span>
        </div>
      )}
    </div>
  )
}

function Chip({ icon, label, highlight = false }: { icon: string; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1 rounded-md px-2 py-1 ${highlight ? "bg-slate-800 text-slate-200" : "text-slate-400"}`}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}
