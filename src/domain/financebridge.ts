/**
 * domain/financebridge.ts
 *
 * Pure functions for bridging travel expenses into the Finance section.
 * Maps travel budget categories to Finance CSP buckets and builds
 * FinanceTransaction objects ready to be inserted into financialState.
 */

export type CSPBucket = "fixed" | "investment" | "savings" | "guiltFree"

export type TravelCategory =
  | "Accommodation"
  | "Food"
  | "Transport"
  | "Activities"
  | "Shopping"
  | "Misc"

export interface TravelExpense {
  id: string
  date: string
  category: TravelCategory
  amount: number
  currency: string
  amountBase: number
  note: string
}

export interface FinanceTransaction {
  id: string
  date: string
  label: string
  amount: number
  bucket: CSPBucket
  category: string
  method: "manual"
  notes?: string
}

// ── Category → bucket mapping ─────────────────────────────────────────────────

const TRAVEL_CATEGORY_BUCKET: Record<TravelCategory, CSPBucket> = {
  Accommodation: "fixed",
  Food: "guiltFree",
  Transport: "fixed",
  Activities: "guiltFree",
  Shopping: "guiltFree",
  Misc: "guiltFree",
}

export function travelCategoryToBucket(category: TravelCategory): CSPBucket {
  return TRAVEL_CATEGORY_BUCKET[category] ?? "guiltFree"
}

// ── Transaction builder ───────────────────────────────────────────────────────

export function buildFinanceTransaction(
  expense: TravelExpense,
  tripName: string,
): FinanceTransaction {
  const label = expense.note.trim()
    ? `${expense.note} (${tripName})`
    : `${expense.category} — ${tripName}`

  return {
    id: `travel-bridge-${expense.id}`,
    date: expense.date,
    label,
    amount: expense.amountBase,
    bucket: travelCategoryToBucket(expense.category),
    category: expense.category,
    method: "manual",
    notes: `Imported from travel: ${tripName}`,
  }
}

// ── Month key helper ──────────────────────────────────────────────────────────

export function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

// ── Duplicate detection ───────────────────────────────────────────────────────

export function isAlreadyBridged(
  transactionsByMonth: Record<string, FinanceTransaction[]>,
  expenseId: string,
): boolean {
  const bridgedId = `travel-bridge-${expenseId}`
  for (const txns of Object.values(transactionsByMonth)) {
    if (txns.some((t) => t.id === bridgedId)) return true
  }
  return false
}
