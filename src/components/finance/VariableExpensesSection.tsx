/**
 * components/finance/VariableExpensesSection.tsx
 *
 * Variable/daily expenses: add items with label, amount, and date.
 * Quick to jot down spending. Shows total and closing balance.
 */

import type { FinanceState, VariableExpense } from '../../domain/financeTypes'
import { createFinanceId } from '../../domain/financeTypes'
import { getOrCreateMonth } from '../../domain/financeState'
import { totalVariableExpensesCents } from '../../domain/financeState'
import { todayIso } from '../../domain/dateUtils'

interface VariableExpensesSectionProps {
  monthId: string
  variableExpenses: VariableExpense[]
  onUpdate: (updater: (prev: FinanceState) => FinanceState) => void
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function VariableExpensesSection({
  monthId,
  variableExpenses,
  onUpdate,
}: VariableExpensesSectionProps) {
  const addExpense = () => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const newExpense: VariableExpense = {
        id: createFinanceId(),
        label: '',
        amountCents: 0,
        date: todayIso(),
      }
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...month,
            variableExpenses: [...month.variableExpenses, newExpense],
          },
        },
      }
    })
  }

  const updateExpense = (id: string, patch: Partial<VariableExpense>) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const variableExpenses = month.variableExpenses.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      )
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, variableExpenses },
        },
      }
    })
  }

  const removeExpense = (id: string) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const variableExpenses = month.variableExpenses.filter((e) => e.id !== id)
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, variableExpenses },
        },
      }
    })
  }

  const variableTotal = totalVariableExpensesCents(variableExpenses)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Other expenses</h3>
      <div className="mb-2">
        <button
          type="button"
          onClick={addExpense}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
        >
          + Add expense
        </button>
      </div>
      <div className="space-y-1">
        {variableExpenses.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center gap-2 rounded border border-slate-700 bg-slate-800/50 px-2 py-1"
          >
            <input
              type="text"
              value={e.label}
              onChange={(ev) => updateExpense(e.id, { label: ev.target.value })}
              placeholder="e.g. Kaufland, Pharmacy"
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={e.amountCents / 100}
              onChange={(ev) => {
                const v = parseFloat(ev.target.value)
                if (!Number.isNaN(v)) updateExpense(e.id, { amountCents: Math.round(v * 100) })
              }}
              className="w-20 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <input
              type="date"
              value={e.date}
              onChange={(ev) => updateExpense(e.id, { date: ev.target.value })}
              className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => removeExpense(e.id)}
              className="text-slate-500 hover:text-red-400"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-slate-700 pt-2 text-xs">
        <p className="text-slate-400">
          Variable expenses total: <span className="font-semibold text-slate-100">{formatCents(variableTotal)}</span>
        </p>
      </div>
    </section>
  )
}
