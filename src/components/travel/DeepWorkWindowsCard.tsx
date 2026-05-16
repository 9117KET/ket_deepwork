import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"
import { findDeepWorkWindows, buildDeepWorkActivity } from "../../domain/deepWorkWindows"
import type { DeepWorkWindow, DayPlan } from "../../domain/deepWorkWindows"

interface Props {
  tripId: Id<"travelTrips">
  dailyPlan: DayPlan[]
}

const KIND_CONFIG: Record<DeepWorkWindow["kind"], { icon: string; color: string; bg: string }> = {
  transport_leg: { icon: "flight", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  free_morning: { icon: "wb_twilight", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  free_day: { icon: "spa", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
}

export function DeepWorkWindowsCard({ tripId, dailyPlan }: Props) {
  const updateTrip = useMutation(api.travel.update)
  const windows = findDeepWorkWindows(dailyPlan)

  if (windows.length === 0) return null

  async function handleBlock(win: DeepWorkWindow) {
    const activity = buildDeepWorkActivity(win)
    const updated = dailyPlan.map((d) =>
      d.day === win.day ? { ...d, activities: [activity, ...d.activities] } : d
    )
    await updateTrip({ id: tripId, dailyPlan: updated })
  }

  return (
    <div className="rounded-2xl border border-share-primary/20 bg-share-primary/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MaterialIcon name="laptop" className="text-share-primary" />
        <h3 className="text-sm font-bold text-share-onBg">
          Deep Work Windows
        </h3>
        <span className="ml-auto rounded-full bg-share-primary/15 px-2 py-0.5 text-[11px] font-bold text-share-primary">
          {windows.length} found
        </span>
      </div>

      <p className="text-xs text-share-onSurfaceVariant -mt-1">
        These stretches of your itinerary are good candidates for focused work.
      </p>

      <div className="space-y-2">
        {windows.map((win, i) => {
          const cfg = KIND_CONFIG[win.kind]
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border p-3 ${cfg.bg}`}
            >
              <MaterialIcon name={cfg.icon} className={`mt-0.5 shrink-0 text-[1.1rem] ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-share-onBg">{win.label}</p>
                <p className="text-xs text-share-onSurfaceVariant mt-0.5">{win.reason}</p>
                <p className="text-xs font-medium text-share-primary mt-1">
                  ~{Math.floor(win.estimatedMinutes / 60)}h {win.estimatedMinutes % 60 > 0 ? `${win.estimatedMinutes % 60}m` : ""} available
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleBlock(win)}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-share-primary/30 px-2.5 py-1.5 text-[11px] font-bold text-share-primary hover:bg-share-primary/10 transition-colors"
              >
                <MaterialIcon name="add" className="text-[0.85rem]" />
                Block
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
