import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"

type TripStatus = "planning" | "active" | "completed"

interface Trip {
  _id: Id<"travelTrips">
  name: string
  destination: string
  startDate?: string
  endDate?: string
  durationDays: number
  purpose: string
  budgetPreference: string
  status: TripStatus
  generatedPlan?: unknown
}

interface Props {
  trip: Trip
  onClick: () => void
}

const STATUS_CONFIG: Record<TripStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-share-primary/15 text-share-primary" },
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-400" },
  completed: { label: "Completed", className: "bg-share-onSurfaceVariant/15 text-share-onSurfaceVariant" },
}

const BUDGET_ICON: Record<string, string> = {
  budget: "savings",
  moderate: "account_balance_wallet",
  comfort: "diamond",
}

export function TripCard({ trip, onClick }: Props) {
  const removeTrip = useMutation(api.travel.remove)
  const statusCfg = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG.planning

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
      void removeTrip({ id: trip._id })
    }
  }

  const dateRange = trip.startDate
    ? `${formatDate(trip.startDate)}${trip.endDate ? ` - ${formatDate(trip.endDate)}` : ""}`
    : `${trip.durationDays} day${trip.durationDays !== 1 ? "s" : ""}`

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 cursor-pointer hover:border-share-primary/40 transition-all hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-share-onBg truncate">{trip.name}</h3>
          <p className="text-sm text-share-onSurfaceVariant mt-0.5 flex items-center gap-1">
            <MaterialIcon name="flight_takeoff" className="text-[1rem]" />
            {trip.destination}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-share-onSurfaceVariant">
        <span className="flex items-center gap-1">
          <MaterialIcon name="calendar_today" className="text-[0.9rem]" />
          {dateRange}
        </span>
        <span className="flex items-center gap-1">
          <MaterialIcon name={BUDGET_ICON[trip.budgetPreference] ?? "wallet"} className="text-[0.9rem]" />
          {trip.budgetPreference.charAt(0).toUpperCase() + trip.budgetPreference.slice(1)}
        </span>
        {trip.generatedPlan != null ? (
          <span className="flex items-center gap-1 text-share-primary">
            <MaterialIcon name="auto_awesome" className="text-[0.9rem]" />
            AI plan ready
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-share-onSurfaceVariant/70 line-clamp-1">{trip.purpose}</p>

      <button
        type="button"
        onClick={handleDelete}
        className="absolute top-3 right-3 hidden group-hover:flex items-center justify-center rounded-lg p-1 text-share-onSurfaceVariant hover:text-share-error transition-colors"
        title="Delete trip"
      >
        <MaterialIcon name="delete_outline" className="text-[1rem]" />
      </button>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
