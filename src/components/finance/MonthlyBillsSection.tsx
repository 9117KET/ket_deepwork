/**
 * components/finance/MonthlyBillsSection.tsx
 *
 * Recurring monthly bills. Supports "Copy from previous month" and "Apply template"
 * so you edit once and reuse. Shows remaining after bills.
 */

import type { FinanceState, BillLineItem, BillsTemplate } from '../../domain/financeTypes'
import { createFinanceId } from '../../domain/financeTypes'
import { getOrCreateMonth } from '../../domain/financeState'
import { totalBillsCents } from '../../domain/financeState'
import { previousMonthId } from '../../domain/dateUtils'

interface MonthlyBillsSectionProps {
  monthId: string
  bills: BillLineItem[]
  billsTemplate: BillsTemplate
  onUpdate: (updater: (prev: FinanceState) => FinanceState) => void
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function MonthlyBillsSection({
  monthId,
  bills,
  billsTemplate,
  onUpdate,
}: MonthlyBillsSectionProps) {
  const setBills = (newBills: BillLineItem[]) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, bills: newBills },
        },
      }
    })
  }

  const copyFromPreviousMonth = () => {
    const prevId = previousMonthId(monthId)
    onUpdate((prev) => {
      const prevMonth = prev.months[prevId]
      const month = getOrCreateMonth(prev, monthId)
      const newBills = prevMonth?.bills?.length
        ? prevMonth.bills.map((b) => ({ ...b, id: createFinanceId() }))
        : month.bills
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, bills: newBills.length ? newBills : month.bills },
        },
      }
    })
  }

  const applyTemplate = () => {
    if (billsTemplate.items.length === 0) return
    const newBills = billsTemplate.items.map((b) => ({
      id: createFinanceId(),
      name: b.name,
      amountCents: b.amountCents,
    }))
    setBills(newBills)
  }

  const updateBill = (id: string, patch: Partial<BillLineItem>) => {
    setBills(
      bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    )
  }

  const removeBill = (id: string) => {
    setBills(bills.filter((b) => b.id !== id))
  }

  const addBlankBill = () => {
    setBills([...bills, { id: createFinanceId(), name: '', amountCents: 0 }])
  }

  const billsTotal = totalBillsCents(bills)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-amber-200/90">Monthly Bills</h3>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyFromPreviousMonth}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
        >
          Copy from previous month
        </button>
        {billsTemplate.items.length > 0 && (
          <button
            type="button"
            onClick={applyTemplate}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
          >
            Apply template
          </button>
        )}
        <button
          type="button"
          onClick={addBlankBill}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
        >
          + Add bill
        </button>
      </div>
      <div className="space-y-1">
        {bills.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/50 px-2 py-1">
            <input
              type="text"
              value={b.name}
              onChange={(e) => updateBill(b.id, { name: e.target.value })}
              placeholder="Name"
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={b.amountCents / 100}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isNaN(v)) updateBill(b.id, { amountCents: Math.round(v * 100) })
              }}
              className="w-20 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => removeBill(b.id)}
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
          Bills total: <span className="font-semibold text-slate-100">{formatCents(billsTotal)}</span>
        </p>
      </div>
    </section>
  )
}
