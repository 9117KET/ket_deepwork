/**
 * domain/dayContext.ts
 *
 * Pure functions for computing the unified day context across all sections.
 * No framework or Convex dependencies - fully unit-testable.
 */

import { computeDailyDeepWorkMinutes } from "./stats"
import type { AppState, DayState } from "./types"

export interface ActiveTripInfo {
  tripId: string
  name: string
  destination: string
  day: number
  totalDays: number
  budgetPreference: string
  startDate: string
  endDate?: string
}

export interface DailyExpenseSummary {
  total: number
  currency: string
  count: number
}

export interface DayContextData {
  date: string
  tasks: { total: number; completed: number; deepWork: number; shallow: number }
  deepWorkMinutes: number
  habitCompletions: { total: number; completed: number; habitIds: string[] }
  mood?: string
  sleepHours?: number
  activeTrip: ActiveTripInfo | null
  expenses: DailyExpenseSummary | null
}

// ── Trip date helpers ─────────────────────────────────────────────────────────

export function computeTripDay(startIso: string, dateIso: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number)
  const [dy, dm, dd] = dateIso.split("-").map(Number)
  const start = Date.UTC(sy!, sm! - 1, sd!)
  const day = Date.UTC(dy!, dm! - 1, dd!)
  return Math.floor((day - start) / 86_400_000) + 1
}

export function isTripActiveOnDate(
  startDate: string | undefined,
  endDate: string | undefined,
  date: string,
): boolean {
  if (!startDate) return false
  if (date < startDate) return false
  if (endDate && date > endDate) return false
  return true
}

// ── Task summary ──────────────────────────────────────────────────────────────

export function computeTaskSummary(dayState: DayState | undefined): DayContextData["tasks"] {
  if (!dayState) return { total: 0, completed: 0, deepWork: 0, shallow: 0 }
  const rootTasks = dayState.tasks.filter((t) => !t.parentId)
  return {
    total: rootTasks.length,
    completed: rootTasks.filter((t) => t.isDone).length,
    deepWork: rootTasks.filter((t) => !t.isShallow && !t.isDone).length,
    shallow: rootTasks.filter((t) => t.isShallow === true).length,
  }
}

// ── Habit summary ─────────────────────────────────────────────────────────────

export function computeHabitSummary(
  dayState: DayState | undefined,
  habitIds: string[],
): DayContextData["habitCompletions"] {
  if (!dayState || habitIds.length === 0) {
    return { total: habitIds.length, completed: 0, habitIds }
  }
  const completions = dayState.habitCompletions ?? {}
  const completed = habitIds.filter((id) => completions[id] === true).length
  return { total: habitIds.length, completed, habitIds }
}

// ── Expense summary from financial state ─────────────────────────────────────

interface RawExpense {
  date?: string
  amountBase?: number
  amount?: number
  currency?: string
}

export function computeExpenseSummary(
  expenses: RawExpense[],
  date: string,
): DailyExpenseSummary | null {
  const dayExpenses = expenses.filter((e) => e.date === date)
  if (dayExpenses.length === 0) return null
  const total = dayExpenses.reduce((sum, e) => sum + (e.amountBase ?? e.amount ?? 0), 0)
  const currency = dayExpenses[0]?.currency ?? "EUR"
  return { total, currency, count: dayExpenses.length }
}

// ── Full day context builder ──────────────────────────────────────────────────

interface TripRecord {
  _id: string
  name: string
  destination: string
  startDate?: string
  endDate?: string
  durationDays: number
  budgetPreference: string
  budget?: { expenses?: RawExpense[] }
}

export function buildDayContext(
  date: string,
  appState: AppState,
  habitIds: string[],
  trips: TripRecord[],
  financialExpenses: RawExpense[],
): DayContextData {
  const dayState = appState.days[date]
  const deepWorkMinutes = computeDailyDeepWorkMinutes(dayState)

  // Find active trip for this date
  let activeTrip: ActiveTripInfo | null = null
  for (const trip of trips) {
    if (isTripActiveOnDate(trip.startDate, trip.endDate, date)) {
      const tripDay = computeTripDay(trip.startDate!, date)
      if (tripDay >= 1 && tripDay <= trip.durationDays) {
        activeTrip = {
          tripId: trip._id,
          name: trip.name,
          destination: trip.destination,
          day: tripDay,
          totalDays: trip.durationDays,
          budgetPreference: trip.budgetPreference,
          startDate: trip.startDate!,
          endDate: trip.endDate,
        }
        break
      }
    }
  }

  // Combine expenses from financial state and active trip budget
  const tripExpenses = activeTrip
    ? (trips.find((t) => t._id === activeTrip!.tripId)?.budget?.expenses ?? [])
    : []
  const allExpenses = [...financialExpenses, ...tripExpenses]
  const expenses = computeExpenseSummary(allExpenses, date)

  return {
    date,
    tasks: computeTaskSummary(dayState),
    deepWorkMinutes,
    habitCompletions: computeHabitSummary(dayState, habitIds),
    mood: dayState?.mood,
    sleepHours: dayState?.sleepHours,
    activeTrip,
    expenses,
  }
}
