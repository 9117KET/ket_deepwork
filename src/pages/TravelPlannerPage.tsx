import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useConvexAuth } from "convex/react"
import { api } from "../../convex/_generated/api"
import { AppChrome } from "../components/layout/AppChrome"
import { MaterialIcon } from "../components/ui/MaterialIcon"
import { TripCard } from "../components/travel/TripCard"
import { CreateTripModal } from "../components/travel/CreateTripModal"

export function TravelPlannerPage() {
  const { isAuthenticated } = useConvexAuth()
  const trips = useQuery(api.travel.list, isAuthenticated ? {} : "skip")
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  function handleCreated(id: string) {
    setShowCreate(false)
    navigate(`/travel/${id}`)
  }

  const planning = trips?.filter((t) => t.status === "planning") ?? []
  const active = trips?.filter((t) => t.status === "active") ?? []
  const completed = trips?.filter((t) => t.status === "completed") ?? []

  return (
    <AppChrome headerPositionClass="top-0" mobileActive="travel" maxWidthClass="max-w-4xl">
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-share-onBg">Travel Planner</h1>
            <p className="text-sm text-share-onSurfaceVariant mt-0.5">
              AI-powered trip planning with live weather, visa, and budget data
            </p>
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:opacity-90 transition-opacity"
            >
              <MaterialIcon name="add" className="text-[1rem]" />
              New Trip
            </button>
          )}
        </div>

        {/* Unauthenticated state */}
        {!isAuthenticated && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer py-16 px-6 text-center gap-4">
            <MaterialIcon name="flight" className="text-[3rem] text-share-primary opacity-60" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-share-onBg">Sign in to plan your trips</p>
              <p className="text-xs text-share-onSurfaceVariant">
                Get AI-generated itineraries with live weather forecasts, currency info, visa requirements, and smart packing lists.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isAuthenticated && trips === undefined && (
          <div className="flex items-center justify-center py-16 text-share-onSurfaceVariant">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-share-primary border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {isAuthenticated && trips?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-share-outlineVariant py-16 px-6 text-center gap-4">
            <MaterialIcon name="flight_takeoff" className="text-[3rem] opacity-20" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-share-onBg">No trips yet</p>
              <p className="text-xs text-share-onSurfaceVariant">
                Create your first trip to get an AI-generated plan with weather, budget, and day-by-day itinerary.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-share-primary px-5 py-2.5 text-sm font-bold text-share-onPrimary hover:opacity-90 transition-opacity"
            >
              <MaterialIcon name="add" />
              Plan your first trip
            </button>
          </div>
        )}

        {/* Trip sections */}
        {active.length > 0 && (
          <TripSection title="Active" icon="flight_takeoff" trips={active} onOpen={(id) => navigate(`/travel/${id}`)} />
        )}
        {planning.length > 0 && (
          <TripSection title="Planning" icon="edit_calendar" trips={planning} onOpen={(id) => navigate(`/travel/${id}`)} />
        )}
        {completed.length > 0 && (
          <TripSection title="Completed" icon="check_circle" trips={completed} onOpen={(id) => navigate(`/travel/${id}`)} />
        )}
      </div>

      {showCreate && (
        <CreateTripModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </AppChrome>
  )
}

function TripSection({
  title,
  icon,
  trips,
  onOpen,
}: {
  title: string
  icon: string
  trips: Array<{
    _id: string
    name: string
    destination: string
    startDate?: string
    endDate?: string
    durationDays: number
    purpose: string
    budgetPreference: string
    status: "planning" | "active" | "completed"
    generatedPlan?: unknown
  }>
  onOpen: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-share-onSurfaceVariant">
        <MaterialIcon name={icon} className="text-[0.95rem]" />
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {trips.map((trip) => (
          <TripCard
            key={trip._id}
            trip={trip as never}
            onClick={() => onOpen(trip._id)}
          />
        ))}
      </div>
    </div>
  )
}
