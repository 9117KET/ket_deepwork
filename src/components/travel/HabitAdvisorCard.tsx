import { useState } from "react"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { MaterialIcon } from "../ui/MaterialIcon"
import { countVerdicts } from "../../domain/habitAdvisor"
import type { HabitAdvice, HabitVerdict } from "../../domain/habitAdvisor"

interface Props {
  destination: string
  purpose: string
  durationDays: number
}

const VERDICT_CONFIG: Record<HabitVerdict, { label: string; icon: string; color: string; bg: string }> = {
  keep: { label: "Keep", icon: "check_circle", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  adapt: { label: "Adapt", icon: "tune", color: "text-amber-400", bg: "bg-amber-500/10" },
  suspend: { label: "Suspend", icon: "pause_circle", color: "text-share-onSurfaceVariant", bg: "bg-share-surfaceContainerHigh" },
}

export function HabitAdvisorCard({ destination, purpose, durationDays }: Props) {
  const getAdvice = useAction(api.travel.getHabitAdvice)
  const [advice, setAdvice] = useState<HabitAdvice[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLoad() {
    setLoading(true)
    setError("")
    try {
      const result = await getAdvice({ destination, purpose, durationDays })
      if (result.length === 0) {
        setError("No habits found. Add habits in the Tracking dashboard first.")
        return
      }
      setAdvice(result as HabitAdvice[])
    } catch (err) {
      setError((err as Error).message ?? "Failed to load advice")
    } finally {
      setLoading(false)
    }
  }

  if (!advice) {
    return (
      <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5">
        <div className="flex items-center gap-2 mb-3">
          <MaterialIcon name="self_improvement" className="text-share-primary" />
          <h3 className="text-sm font-bold text-share-onBg">Habit Continuation</h3>
        </div>
        <p className="text-xs text-share-onSurfaceVariant mb-4">
          See which of your habits to keep, adapt, or suspend during this trip.
        </p>
        {error && <p className="text-xs text-share-error mb-3">{error}</p>}
        <button
          type="button"
          onClick={() => void handleLoad()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-share-outlineVariant px-4 py-2 text-sm font-medium text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-primary/40 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-share-primary border-t-transparent" />
            : <MaterialIcon name="auto_awesome" className="text-[0.95rem]" />
          }
          {loading ? "Analysing…" : "Analyse my habits"}
        </button>
      </div>
    )
  }

  const counts = countVerdicts(advice)

  return (
    <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MaterialIcon name="self_improvement" className="text-share-primary" />
        <h3 className="text-sm font-bold text-share-onBg">Habit Continuation</h3>
        <div className="ml-auto flex gap-2">
          <span className="text-[11px] font-bold text-emerald-400">{counts.keep} keep</span>
          <span className="text-[11px] font-bold text-amber-400">{counts.adapt} adapt</span>
          <span className="text-[11px] font-bold text-share-onSurfaceVariant">{counts.suspend} suspend</span>
        </div>
      </div>

      <div className="space-y-2">
        {advice.map((item) => {
          const cfg = VERDICT_CONFIG[item.verdict]
          return (
            <div key={item.habitId} className="flex items-start gap-3 rounded-xl p-3 bg-share-surfaceContainerLow">
              <MaterialIcon name={cfg.icon} className={`mt-0.5 shrink-0 text-[1rem] ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-share-onBg">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-share-onSurfaceVariant mt-0.5">{item.reason}</p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => { setAdvice(null); setError("") }}
        className="text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
      >
        Reset
      </button>
    </div>
  )
}
