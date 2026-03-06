/**
 * components/finance/FinancePlanner.tsx
 *
 * Container for the Financial Planner view. Orchestrates month selection,
 * finance state, and all sections (income, savings, bills, expenses).
 */

import { usePersistentFinanceState } from '../../storage/financeStorage'
import { currentAndNextMonthIds } from '../../domain/dateUtils'
import { getOrCreateMonth } from '../../domain/financeState'
import { MonthSelector } from './MonthSelector'
import { IncomeSection } from './IncomeSection'
import { SavingsEmergencySection } from './SavingsEmergencySection'
import { MonthlyBillsSection } from './MonthlyBillsSection'
import { VariableExpensesSection } from './VariableExpensesSection'
import { MonthSummary } from './MonthSummary'
import { BillsTemplateSection } from './BillsTemplateSection'
import { useMemo, useState } from 'react'

export function FinancePlanner() {
  const [financeState, updateFinance] = usePersistentFinanceState()
  const { current: defaultCurrent, next: defaultNext } = currentAndNextMonthIds()
  const [currentMonthId, setCurrentMonthId] = useState(defaultCurrent)
  const [nextMonthId, setNextMonthId] = useState(defaultNext)

  const currentMonth = useMemo(
    () => getOrCreateMonth(financeState, currentMonthId),
    [financeState, currentMonthId],
  )
  const nextMonth = useMemo(
    () => getOrCreateMonth(financeState, nextMonthId),
    [financeState, nextMonthId],
  )

  const monthIds = useMemo(() => [currentMonthId, nextMonthId], [currentMonthId, nextMonthId])

  return (
    <div className="space-y-6">
      <BillsTemplateSection billsTemplate={financeState.billsTemplate} onUpdate={updateFinance} />
      <MonthSelector
        currentMonthId={currentMonthId}
        nextMonthId={nextMonthId}
        onCurrentMonthChange={setCurrentMonthId}
        onNextMonthChange={setNextMonthId}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {monthIds.map((monthId) => {
          const month = monthId === currentMonthId ? currentMonth : nextMonth
          return (
            <MonthPanel
              key={monthId}
              monthId={monthId}
              month={month}
              financeState={financeState}
              updateFinance={updateFinance}
            />
          )
        })}
      </div>
    </div>
  )
}

interface MonthPanelProps {
  monthId: string
  month: ReturnType<typeof getOrCreateMonth>
  financeState: import('../../domain/financeTypes').FinanceState
  updateFinance: (updater: (prev: import('../../domain/financeTypes').FinanceState) => import('../../domain/financeTypes').FinanceState) => void
}

function MonthPanel({ monthId, month, financeState, updateFinance }: MonthPanelProps) {
  const monthLabel = useMemo(() => {
    const [y, m] = monthId.split('-').map(Number)
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(y!, m! - 1, 1),
    )
  }, [monthId])

  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
      aria-label={`Finance: ${monthLabel}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{monthLabel}</h2>
      <div className="space-y-4">
        <IncomeSection
          monthId={monthId}
          income={month.income}
          financeState={financeState}
          onUpdate={updateFinance}
        />
        <SavingsEmergencySection
          monthId={monthId}
          savingsAllocationCents={month.savingsAllocationCents}
          emergencyAllocationCents={month.emergencyAllocationCents}
          totalIncomeCents={month.income.reduce((s, e) => s + e.amountCents, 0)}
          onUpdate={updateFinance}
        />
        <MonthlyBillsSection
          monthId={monthId}
          bills={month.bills}
          billsTemplate={financeState.billsTemplate}
          onUpdate={updateFinance}
        />
        <VariableExpensesSection
          monthId={monthId}
          variableExpenses={month.variableExpenses}
          onUpdate={updateFinance}
        />
        <MonthSummary month={month} />
      </div>
    </section>
  )
}
