/**
 * components/finance/BillsTemplateSection.tsx
 *
 * Edit the global bills template once; then "Apply template" in any month
 * to prefill that month's bills with these default names and amounts.
 */

import type { FinanceState, BillLineItem } from '../../domain/financeTypes'
import { createFinanceId } from '../../domain/financeTypes'
import { useState } from 'react'

interface BillsTemplateSectionProps {
  billsTemplate: FinanceState['billsTemplate']
  onUpdate: (updater: (prev: FinanceState) => FinanceState) => void
}

export function BillsTemplateSection({ billsTemplate, onUpdate }: BillsTemplateSectionProps) {
  const [open, setOpen] = useState(false)
  const items = billsTemplate.items

  const setItems = (newItems: BillLineItem[]) => {
    onUpdate((prev) => ({
      ...prev,
      billsTemplate: { items: newItems },
    }))
  }

  const updateItem = (id: string, patch: Partial<BillLineItem>) => {
    setItems(
      items.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    )
  }

  const removeItem = (id: string) => {
    setItems(items.filter((b) => b.id !== id))
  }

  const addItem = () => {
    setItems([...items, { id: createFinanceId(), name: '', amountCents: 0 }])
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200"
      >
        <span>Bills template (edit once, apply to any month)</span>
        <span className="text-slate-500">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {items.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/50 px-2 py-1">
              <input
                type="text"
                value={b.name}
                onChange={(e) => updateItem(b.id, { name: e.target.value })}
                placeholder="e.g. Health insurance, Rent"
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={b.amountCents / 100}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v)) updateItem(b.id, { amountCents: Math.round(v * 100) })
                }}
                className="w-20 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => removeItem(b.id)}
                className="text-slate-500 hover:text-red-400"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
          >
            + Add to template
          </button>
        </div>
      )}
    </div>
  )
}
