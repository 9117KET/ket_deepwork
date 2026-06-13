/**
 * domain/financeWaterfall.ts
 *
 * Pure logic for the monthly cash-flow "waterfall" — the user's Excel mental model:
 *
 *   Income + savings
 *     − Savings this month        (pay yourself first)
 *   = Income after savings
 *     − Monthly bills             (recurring fixed costs)
 *     − Critical expenses         (one-offs this month, incl. trips)
 *   = Remaining to spend          (the discretionary envelope)
 *     − Daily spend so far        (variable transactions logged this month)
 *   = Left to spend
 *
 * The waterfall is a *view* derived from the existing Conscious Spending Plan
 * buckets plus the new per-month income/critical-expense lines — no parallel
 * budget storage. Buckets map onto the waterfall like this:
 *   fixed                 → Monthly bills
 *   savings + investment  → Savings this month
 *   guiltFree             → the spendable envelope (drawn down by daily spend)
 */

import type { CSPBucket, FinancialState } from './financialTypes'

export interface WaterfallSummary {
  monthKey: string
  /** Sum of income sources for the month (falls back to csp.monthlyNetIncome). */
  totalIncome: number
  /** True when no income lines exist and we fell back to the CSP net income. */
  incomeUsedFallback: boolean
  /** Pay-yourself-first: savings + investment budget lines + savings-goal contributions. */
  savings: number
  /** Recurring fixed costs (the `fixed` bucket). */
  bills: number
  /** One-off critical expenses for the month. */
  critical: number
  /** totalIncome − savings. */
  afterSavings: number
  /** afterSavings − bills − critical: the discretionary envelope for the month. */
  remaining: number
  /** Variable (guilt-free) spend logged this month. */
  dailySpent: number
  /** All transactions logged this month (for reference). */
  totalSpent: number
  /** remaining − dailySpent: what is genuinely left to spend. */
  leftToSpend: number
  /** Days remaining in the month (whole month for past/future months). */
  daysLeftInMonth: number
}

/** YYYY-MM for a given Date (defaults to now). */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function sumBuckets(state: FinancialState, buckets: CSPBucket[]): number {
  const set = new Set(buckets)
  return (state.csp?.expenses ?? [])
    .filter((e) => set.has(e.bucket))
    .reduce((s, e) => s + (e.monthlyAmount || 0), 0)
}

function daysLeftInMonth(monthKey: string, now: Date = new Date()): number {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return 0
  const totalDays = new Date(year, month, 0).getDate() // last day of month
  const isCurrent = monthKey === monthKeyOf(now)
  if (isCurrent) return Math.max(0, totalDays - now.getDate() + 1)
  return totalDays
}

/** Compute the full waterfall summary for a given month. */
export function computeWaterfall(
  state: FinancialState,
  monthKey: string,
  now: Date = new Date(),
): WaterfallSummary {
  const incomeLines = state.incomeSources?.[monthKey] ?? []
  const incomeUsedFallback = incomeLines.length === 0
  const totalIncome = incomeUsedFallback
    ? state.csp?.monthlyNetIncome ?? 0
    : incomeLines.reduce((s, l) => s + (l.amount || 0), 0)

  const savingsBudget = sumBuckets(state, ['savings', 'investment'])
  const goalContributions = (state.savingsGoals ?? []).reduce(
    (s, g) => s + (g.monthlyContribution || 0),
    0,
  )
  const savings = savingsBudget + goalContributions

  const bills = sumBuckets(state, ['fixed'])

  const critical = (state.criticalExpenses?.[monthKey] ?? []).reduce(
    (s, c) => s + (c.amount || 0),
    0,
  )

  const monthTx = state.transactions?.[monthKey] ?? []
  const dailySpent = monthTx
    .filter((t) => t.bucket === 'guiltFree')
    .reduce((s, t) => s + (t.amount || 0), 0)
  const totalSpent = monthTx.reduce((s, t) => s + (t.amount || 0), 0)

  const afterSavings = totalIncome - savings
  const remaining = afterSavings - bills - critical
  const leftToSpend = remaining - dailySpent

  return {
    monthKey,
    totalIncome,
    incomeUsedFallback,
    savings,
    bills,
    critical,
    afterSavings,
    remaining,
    dailySpent,
    totalSpent,
    leftToSpend,
    daysLeftInMonth: daysLeftInMonth(monthKey, now),
  }
}
