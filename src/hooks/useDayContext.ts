/**
 * hooks/useDayContext.ts
 *
 * Aggregates data from all sections for a given date into a single context
 * object. Accepts already-loaded state slices rather than fetching them
 * independently so it adds zero Convex overhead.
 */

import { useMemo } from "react"
import { buildDayContext } from "../domain/dayContext"
import type { DayContextData } from "../domain/dayContext"
import type { AppState } from "../domain/types"

interface Options {
  appState: AppState
  habitIds: string[]
  /** Raw expense objects from financial state (date + amountBase + currency). */
  financialExpenses?: Array<{ date?: string; amountBase?: number; amount?: number; currency?: string }>
  /** All travel trips (from useQuery api.travel.list). */
  trips?: Array<{
    _id: string
    name: string
    destination: string
    startDate?: string
    endDate?: string
    durationDays: number
    budgetPreference: string
    budget?: { expenses?: Array<{ date?: string; amountBase?: number; amount?: number; currency?: string }> }
  }>
}

export function useDayContext(date: string, options: Options): DayContextData {
  const { appState, habitIds, financialExpenses = [], trips = [] } = options

  // useActiveTripStatus is already a hook that queries Convex, but we
  // use the trips array directly for computing context so there's no
  // double-query - useActiveTripStatus is used separately for the banner.
  const ctx = useMemo(
    () => buildDayContext(date, appState, habitIds, trips, financialExpenses),
    [date, appState, habitIds, trips, financialExpenses],
  )

  return ctx
}

export type { DayContextData }
