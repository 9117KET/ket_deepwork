/**
 * ActiveTripBanner
 *
 * Compact banner shown in the day planner when a trip is currently active.
 * Communicates to the user that today is a travel day so expectations
 * (deep work, habits, productivity) are contextualised.
 */

import { useNavigate } from "react-router-dom"
import type { ActiveTripStatus } from "../../hooks/useActiveTripStatus"

interface Props {
  trip: ActiveTripStatus
}

export function ActiveTripBanner({ trip }: Props) {
  const navigate = useNavigate()
  const city = trip.destination.split(",")[0]?.trim() ?? trip.destination

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-teal-500/25 bg-teal-500/8 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0" aria-hidden>✈️</span>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-teal-300">
            Day {trip.day} of {trip.totalDays} — {city}
          </span>
          <span className="ml-2 text-xs text-teal-300/60">{trip.name}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/travel/${trip.tripId}`)}
        className="shrink-0 rounded-lg border border-teal-500/30 px-2.5 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/10 transition-colors"
      >
        Trip
      </button>
    </div>
  )
}
