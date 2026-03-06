/**
 * components/finance/SavingsEmergencySection.tsx
 *
 * Savings and emergency allocations and derived "remaining after savings and emergency".
 */

import type { FinanceState } from '../../domain/financeTypes'
import { getOrCreateMonth } from '../../domain/financeState'
import {
  totalSavingsAndEmergencyCents,
  remainingAfterSavingsCents,
} from '../../domain/financeState'

interface SavingsEmergencySectionProps {
  monthId: string
  savingsAllocationCents: number
  emergencyAllocationCents: number
  totalIncomeCents: number
  onUpdate: (updater: (prev: FinanceState) => FinanceState) => void
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function SavingsEmergencySection({
  monthId,
  savingsAllocationCents,
  emergencyAllocationCents,
  totalIncomeCents,
  onUpdate,
}: SavingsEmergencySectionProps) {
  const savingsEmergencyTotal = totalSavingsAndEmergencyCents(
    savingsAllocationCents,
    emergencyAllocationCents,
  )
  const remainingAfterSavings = remainingAfterSavingsCents(
    totalIncomeCents,
    savingsAllocationCents,
    emergencyAllocationCents,
  )

  const updateAllocation = (field: 'savingsAllocationCents' | 'emergencyAllocationCents', value: number) => {
    onUpdate((prev) => {
      const month = getOrCreateMonth(prev, monthId)
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: { ...month, [field]: value },
        },
      }
    })
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-emerald-950/30 p-3">
      <h3 className="mb-2 text-sm font-semibold text-emerald-200/90">Savings & Emergency</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="w-24 text-xs text-slate-400">Savings</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={savingsAllocationCents / 100}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isNaN(v)) updateAllocation('savingsAllocationCents', Math.round(v * 100))
            }}
            className="w-24 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-xs text-slate-400">Emergency</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={emergencyAllocationCents / 100}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isNaN(v)) updateAllocation('emergencyAllocationCents', Math.round(v * 100))
            }}
            className="w-24 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
          />
        </div>
      </div>
      <div className="mt-2 border-t border-slate-700 pt-2 text-xs">
        <p className="text-slate-400">
          Total (savings + emergency): <span className="font-semibold text-slate-100">{formatCents(savingsEmergencyTotal)}</span>
        </p>
        <p className="text-slate-400">
          Remaining after savings & emergency: <span className="font-semibold text-amber-200/90">{formatCents(remainingAfterSavings)}</span>
        </p>
      </div>
    </section>
  )
}
