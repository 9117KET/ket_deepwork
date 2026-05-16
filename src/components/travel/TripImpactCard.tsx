import { MaterialIcon } from "../ui/MaterialIcon"
import { computeTripImpact } from "../../domain/tripImpact"
import type { DayState } from "../../domain/types"

interface HabitDef {
  id: string
  label: string
}

interface Props {
  startDate: string
  endDate: string
  status: "planning" | "active" | "completed"
  dayStates: Record<string, DayState | undefined>
  habits: HabitDef[]
}

const MOOD_EMOJI: Record<string, string> = {
  great: "😄", good: "🙂", okay: "😐", bad: "😕", terrible: "😞",
}

export function TripImpactCard({ startDate, endDate, status, dayStates, habits }: Props) {
  if (status === "planning") return null

  const habitIds = habits.map((h) => h.id)
  const habitLabels = Object.fromEntries(habits.map((h) => [h.id, h.label]))
  const impact = computeTripImpact(startDate, endDate, dayStates, habitIds, habitLabels)

  if (impact.daysWithData === 0) return null

  const isActive = status === "active"
  const habitPct = Math.round(impact.habits.averageCompletionRate * 100)
  const taskPct = impact.tasks.totalCreated > 0
    ? Math.round(impact.tasks.completionRate * 100)
    : null

  return (
    <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MaterialIcon name="insights" className="text-share-primary" />
        <h3 className="text-sm font-bold text-share-onBg">
          {isActive ? "Trip so far" : "Trip impact"}
        </h3>
        <span className="ml-auto text-xs text-share-onSurfaceVariant">
          {impact.daysWithData} of {impact.durationDays} days tracked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Habits */}
        <StatBlock
          icon="self_improvement"
          label="Habits"
          value={`${habitPct}%`}
          sub={`avg per day`}
          color={habitPct >= 70 ? "text-emerald-400" : habitPct >= 40 ? "text-amber-400" : "text-share-error"}
        />

        {/* Deep work */}
        <StatBlock
          icon="laptop"
          label="Deep work"
          value={`${impact.deepWork.totalHours}h`}
          sub={`${impact.deepWork.sessionsCount} sessions`}
          color="text-share-primary"
        />

        {/* Tasks */}
        {taskPct !== null && (
          <StatBlock
            icon="check_circle"
            label="Tasks done"
            value={`${taskPct}%`}
            sub={`${impact.tasks.totalCompleted}/${impact.tasks.totalCreated}`}
            color={taskPct >= 60 ? "text-emerald-400" : "text-share-onSurfaceVariant"}
          />
        )}

        {/* Mood */}
        {impact.mood.mostCommon && (
          <StatBlock
            icon="sentiment_satisfied"
            label="Mood"
            value={MOOD_EMOJI[impact.mood.mostCommon] ?? "😐"}
            sub={`${impact.mood.mostCommon} (${impact.mood.entries}d)`}
            color="text-share-onBg"
          />
        )}
      </div>

      {/* Per-habit breakdown (compact) */}
      {impact.habits.tracked > 0 && (
        <div className="space-y-1.5">
          {impact.habits.perHabit
            .filter((h) => h.completedDays > 0 || impact.daysWithData > 0)
            .map((h) => {
              const pct = Math.round(h.rate * 100)
              return (
                <div key={h.habitId} className="flex items-center gap-2">
                  <span className="w-32 truncate text-xs text-share-onSurfaceVariant">{h.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-share-surfaceContainerHigh overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-share-error/60"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-share-onSurfaceVariant">{pct}%</span>
                </div>
              )
            })}
        </div>
      )}

      {impact.tasks.shallowCount > 0 && (
        <p className="text-xs text-share-onSurfaceVariant/70">
          {impact.tasks.shallowCount} shallow task{impact.tasks.shallowCount !== 1 ? "s" : ""} logged (logistics, admin).
        </p>
      )}
    </div>
  )
}

function StatBlock({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color: string
}) {
  return (
    <div className="rounded-xl bg-share-surfaceContainerLow p-3">
      <MaterialIcon name={icon} className={`text-[1rem] ${color} mb-1`} />
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-share-onSurfaceVariant uppercase tracking-wide">{label}</p>
      <p className="text-[10px] text-share-onSurfaceVariant/60 mt-0.5">{sub}</p>
    </div>
  )
}
