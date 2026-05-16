/**
 * hooks/useActiveTripStatus.ts
 *
 * Returns the trip that is currently active (today's date falls within its
 * startDate..endDate range), or null if none. Skips the query when not
 * authenticated to avoid unnecessary Convex calls.
 */

import { useQuery, useConvexAuth } from "convex/react"
import { api } from "../../convex/_generated/api"
import { computeTripDay } from "../domain/dayContext"

export interface ActiveTripStatus {
  tripId: string
  name: string
  destination: string
  day: number
  totalDays: number
  budgetPreference: string
  startDate: string
  endDate?: string
}

export function useActiveTripStatus(date?: string): ActiveTripStatus | null {
  const { isAuthenticated } = useConvexAuth()
  const today = date ?? new Date().toISOString().slice(0, 10)

  const trip = useQuery(
    api.travel.getActiveOnDate,
    isAuthenticated ? { date: today } : "skip",
  )

  if (!trip || !trip.startDate) return null

  const day = computeTripDay(trip.startDate, today)
  if (day < 1 || day > trip.durationDays) return null

  return {
    tripId: trip._id,
    name: trip.name,
    destination: trip.destination,
    day,
    totalDays: trip.durationDays,
    budgetPreference: trip.budgetPreference,
    startDate: trip.startDate,
    endDate: trip.endDate,
  }
}
