/**
 * domain/financeState.ts
 *
 * Pure derivations for the Financial Planner: totals, remaining amounts,
 * and cumulative savings (closing balance) for "Savings from last month".
 */

import type {
  FinanceState,
  MonthData,
  IncomeEntry,
  BillLineItem,
  VariableExpense,
} from './financeTypes'
import { previousMonthId } from './dateUtils'

/** Sum of income amounts (all sources). */
export function totalIncomeCents(income: IncomeEntry[]): number {
  return income.reduce((sum, e) => sum + e.amountCents, 0)
}

/** Sum of income excluding "savings from last month" (current income only). */
export function totalIncomeWithoutSavingsCents(income: IncomeEntry[]): number {
  return income
    .filter((e) => e.source !== 'savingsFromLastMonth')
    .reduce((sum, e) => sum + e.amountCents, 0)
}

/** Sum of income from "savings from last month" only. */
export function savingsFromLastMonthCents(income: IncomeEntry[]): number {
  return income
    .filter((e) => e.source === 'savingsFromLastMonth')
    .reduce((sum, e) => sum + e.amountCents, 0)
}

/** Total of savings + emergency allocations. */
export function totalSavingsAndEmergencyCents(
  savingsAllocationCents: number,
  emergencyAllocationCents: number,
): number {
  return savingsAllocationCents + emergencyAllocationCents
}

/** Sum of bill amounts. */
export function totalBillsCents(bills: BillLineItem[]): number {
  return bills.reduce((sum, b) => sum + b.amountCents, 0)
}

/** Sum of variable expenses. */
export function totalVariableExpensesCents(expenses: VariableExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
}

/**
 * Remaining after savings and emergency = total income (with savings) − (savings + emergency).
 */
export function remainingAfterSavingsCents(
  totalIncomeWithSavings: number,
  savingsAllocationCents: number,
  emergencyAllocationCents: number,
): number {
  return (
    totalIncomeWithSavings -
    totalSavingsAndEmergencyCents(savingsAllocationCents, emergencyAllocationCents)
  )
}

/**
 * Remaining after bills = remaining after savings − bills total.
 */
export function remainingAfterBillsCents(
  remainingAfterSavings: number,
  billsTotalCents: number,
): number {
  return remainingAfterSavings - billsTotalCents
}

/**
 * Closing balance for a month = remaining after bills − variable expenses.
 * This is the amount that can become "Savings from last month" for the next month.
 */
export function closingBalanceCents(
  remainingAfterBills: number,
  variableExpensesTotalCents: number,
): number {
  return remainingAfterBills - variableExpensesTotalCents
}

/**
 * Get or create month data for a given month id. Returns a default empty month if missing.
 */
export function getOrCreateMonth(
  state: FinanceState,
  monthId: string,
): MonthData {
  const existing = state.months[monthId]
  if (existing) return existing
  return {
    monthId,
    income: [],
    savingsAllocationCents: 0,
    emergencyAllocationCents: 0,
    bills: [],
    variableExpenses: [],
  }
}

/**
 * Compute closing balance for a month (for use as next month's "Savings from last month").
 * Uses state so we can derive from previous month's data.
 */
export function computeClosingBalanceForMonth(
  state: FinanceState,
  monthId: string,
): number {
  const month = getOrCreateMonth(state, monthId)
  const totalWithSavings = totalIncomeCents(month.income)
  const savingsEmergency = totalSavingsAndEmergencyCents(
    month.savingsAllocationCents,
    month.emergencyAllocationCents,
  )
  const remainingAfterSavings = totalWithSavings - savingsEmergency
  const billsTotal = totalBillsCents(month.bills)
  const remainingAfterBills = remainingAfterSavings - billsTotal
  const variableTotal = totalVariableExpensesCents(month.variableExpenses)
  return closingBalanceCents(remainingAfterBills, variableTotal)
}

/**
 * Suggested "Savings from last month" for a given month = previous month's closing balance.
 * Returns 0 if no previous month or for first month ever.
 */
export function suggestedSavingsFromLastMonthCents(
  state: FinanceState,
  monthId: string,
): number {
  const prevId = previousMonthId(monthId)
  const prevData = state.months[prevId]
  if (!prevData) return 0
  return computeClosingBalanceForMonth(state, prevId)
}
