/**
 * domain/travelBudget.ts
 *
 * Pure functions for the travel budget tracker.
 * No framework or Convex dependencies - fully unit-testable.
 */

export const BUDGET_CATEGORIES = [
  "Accommodation",
  "Food",
  "Transport",
  "Activities",
  "Shopping",
  "Misc",
] as const

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]

export interface BudgetAllocation {
  category: BudgetCategory
  amount: number
}

export interface Expense {
  id: string
  date: string
  category: BudgetCategory
  amount: number
  currency: string
  amountBase: number
  note: string
}

export interface TripBudget {
  totalBudget: number
  currency: string
  allocations: Partial<Record<BudgetCategory, number>>
  expenses: Expense[]
}

// ── Default allocations (percentages of total) ───────────────────────────────

const DEFAULT_ALLOCATION_PCT: Record<BudgetCategory, number> = {
  Accommodation: 0.35,
  Food: 0.25,
  Transport: 0.15,
  Activities: 0.15,
  Shopping: 0.05,
  Misc: 0.05,
}

export function buildDefaultAllocations(totalBudget: number): Partial<Record<BudgetCategory, number>> {
  const result: Partial<Record<BudgetCategory, number>> = {}
  for (const cat of BUDGET_CATEGORIES) {
    result[cat] = Math.round(totalBudget * DEFAULT_ALLOCATION_PCT[cat])
  }
  return result
}

// ── Spending calculations ────────────────────────────────────────────────────

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountBase, 0)
}

export function spentByCategory(expenses: Expense[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const cat of BUDGET_CATEGORIES) {
    result[cat] = 0
  }
  for (const e of expenses) {
    result[e.category] = (result[e.category] ?? 0) + e.amountBase
  }
  return result
}

export function remainingBudget(budget: TripBudget): number {
  return budget.totalBudget - totalSpent(budget.expenses)
}

export function categoryBudgetStatus(
  _category: BudgetCategory,
  spent: number,
  allocated: number,
): "ok" | "warning" | "over" {
  if (allocated <= 0) return "ok"
  const ratio = spent / allocated
  if (ratio >= 1) return "over"
  if (ratio >= 0.8) return "warning"
  return "ok"
}

export function dailyBudgetRate(budget: TripBudget, durationDays: number): number {
  if (durationDays <= 0) return 0
  return budget.totalBudget / durationDays
}

export function dailySpendRate(expenses: Expense[], tripStartIso: string, today = new Date().toISOString().slice(0, 10)): number {
  const daysPassed = Math.max(1, daysBetween(tripStartIso, today) + 1)
  return totalSpent(expenses) / daysPassed
}

export function budgetPaceStatus(
  budget: TripBudget,
  durationDays: number,
  tripStartIso: string,
  today = new Date().toISOString().slice(0, 10),
): "on_track" | "over_pace" | "under_pace" {
  const targetDaily = dailyBudgetRate(budget, durationDays)
  const actualDaily = dailySpendRate(budget.expenses, tripStartIso, today)
  if (actualDaily > targetDaily * 1.1) return "over_pace"
  if (actualDaily < targetDaily * 0.85) return "under_pace"
  return "on_track"
}

// ── Date helpers ─────────────────────────────────────────────────────────────

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00")
  const b = new Date(isoB + "T00:00:00")
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

// ── Expense helpers ──────────────────────────────────────────────────────────

export function createExpense(
  fields: Omit<Expense, "id">,
): Expense {
  return { ...fields, id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
}

export function expensesByDate(expenses: Expense[]): Record<string, Expense[]> {
  const result: Record<string, Expense[]> = {}
  for (const e of expenses) {
    if (!result[e.date]) result[e.date] = []
    result[e.date]!.push(e)
  }
  return result
}
