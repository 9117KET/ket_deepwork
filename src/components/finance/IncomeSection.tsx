/**
 * components/finance/IncomeSection.tsx
 *
 * Income entries and totals (with/without savings). Supports adding and editing
 * income by source; "Savings from last month" can be prefilled from previous month.
 */

import type { FinanceState, IncomeEntry, IncomeSourceId } from '../../domain/financeTypes'
import { INCOME_SOURCE_LABELS, createFinanceId } from '../../domain/financeTypes'
import { getOrCreateMonth, suggestedSavingsFromLastMonthCents } from '../../domain/financeState'
import {
  totalIncomeCents,
  totalIncomeWithoutSavingsCents,
} from '../../domain/financeState'
import { todayIso } from '../../domain/dateUtils'

interface IncomeSectionProps {
  monthId: string
  income: IncomeEntry[]
  financeState: FinanceState
  onUpdate: (updater: (prev: FinanceState) => FinanceState) => void
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function IncomeSection({ monthId, income, financeState, onUpdate }: IncomeSectionProps) {
  const totalWithSavings = totalIncomeCents(income)
  const totalWithoutSavings = totalIncomeWithoutSavingsCents(income)
  const suggestedSavings = suggestedSavingsFromLastMonthCents(financeState, monthId)
  const hasSavingsEntry = income.some((e) => e.source === 'savingsFromLastMonth')

  const addEntry = (source: IncomeSourceId, amountCents: number = 0, label?: string) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const newEntry: IncomeEntry = {
        id: createFinanceId(),
        source,
        label: source === 'other' ? label : undefined,
        amountCents,
        date: todayIso(),
      }
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, income: [...month.income, newEntry] },
        },
      }
    })
  }

  const updateEntry = (entryId: string, patch: Partial<IncomeEntry>) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const income = month.income.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      )
      return {
        ...prev,
        months: { ...prev.months, [monthId]: { ...month, income } },
      }
    })
  }

  const removeEntry = (entryId: string) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      const income = month.income.filter((e) => e.id !== entryId)
      return {
        ...prev,
        months: { ...prev.months, [monthId]: { ...month, income } },
      }
    })
  }

  const addSavingsFromLastMonth = () => {
    const amount = hasSavingsEntry ? 0 : suggestedSavings
    addEntry('savingsFromLastMonth', amount)
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-amber-200/90">Income</h3>
      <div className="space-y-2">
        {!hasSavingsEntry && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addSavingsFromLastMonth}
              title="Prefilled from previous month's closing balance (you can edit the amount after adding)"
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              Add savings from last month
              {suggestedSavings !== 0 && ` (${formatCents(suggestedSavings)} suggested)`}
            </button>
          </div>
        )}
        {(Object.keys(INCOME_SOURCE_LABELS) as IncomeSourceId[]).map((source) => {
          if (source === 'savingsFromLastMonth') return null
          return (
            <button
              key={source}
              type="button"
              onClick={() => addEntry(source)}
              className="block rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-left text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              + {INCOME_SOURCE_LABELS[source]}
            </button>
          )
        })}
        {income.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-2 rounded border border-slate-700 bg-slate-800/50 px-2 py-1"
          >
            <span className="text-xs text-slate-300">
              {entry.source === 'other' && entry.label ? entry.label : INCOME_SOURCE_LABELS[entry.source]}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={entry.amountCents / 100}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isNaN(v)) updateEntry(entry.id, { amountCents: Math.round(v * 100) })
              }}
              className="w-24 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <input
              type="date"
              value={entry.date}
              onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
              className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => removeEntry(entry.id)}
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
          Total (with savings): <span className="font-semibold text-slate-100">{formatCents(totalWithSavings)}</span>
        </p>
        <p className="text-slate-400">
          Total (without savings): <span className="font-semibold text-slate-100">{formatCents(totalWithoutSavings)}</span>
        </p>
      </div>
    </section>
  )
}
