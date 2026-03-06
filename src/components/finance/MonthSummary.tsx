/**
 * components/finance/MonthSummary.tsx
 *
 * Derived totals for a month: remaining after savings, remaining after bills,
 * and closing balance (for next month's "Savings from last month").
 */

import type { MonthData } from '../../domain/financeTypes'
import {
  totalIncomeCents,
  remainingAfterSavingsCents,
  totalBillsCents,
  remainingAfterBillsCents,
  totalVariableExpensesCents,
  closingBalanceCents,
} from '../../domain/financeState'

interface MonthSummaryProps {
  month: MonthData
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function MonthSummary({ month }: MonthSummaryProps) {
  const totalIncome = totalIncomeCents(month.income)
  const remainingAfterSavings = remainingAfterSavingsCents(
    totalIncome,
    month.savingsAllocationCents,
    month.emergencyAllocationCents,
  )
  const billsTotal = totalBillsCents(month.bills)
  const remainingAfterBills = remainingAfterBillsCents(remainingAfterSavings, billsTotal)
  const variableTotal = totalVariableExpensesCents(month.variableExpenses)
  const closing = closingBalanceCents(remainingAfterBills, variableTotal)

  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs">
      <h4 className="mb-2 font-semibold text-amber-200/90">Summary</h4>
      <p className="text-slate-400">
        Remaining after savings & emergency: <span className="font-medium text-slate-100">{formatCents(remainingAfterSavings)}</span>
      </p>
      <p className="text-slate-400">
        Remaining after bills: <span className="font-medium text-slate-100">{formatCents(remainingAfterBills)}</span>
      </p>
      <p className="text-slate-400">
        Closing balance (→ next month savings): <span className="font-semibold text-amber-200">{formatCents(closing)}</span>
      </p>
    </div>
  )
}
