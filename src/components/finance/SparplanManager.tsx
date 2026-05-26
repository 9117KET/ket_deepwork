/**
 * components/finance/SparplanManager.tsx
 *
 * Manage monthly ETF savings plans (Sparpläne).
 * Shows total monthly investment, active plans, and broker comparison.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, ETFSparplan } from '../../domain/financialTypes'

function createId(): string {
  return `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const BROKERS = [
  { name: 'Trade Republic', minAmount: 1, executionFee: 0, cashRate: 2.0, note: 'Free for all ETFs. 2% on uninvested cash.' },
  { name: 'Scalable Capital (PRIME+)', minAmount: 1, executionFee: 0, cashRate: 2.5, note: '€4.99/mo plan. Free Sparpläne. 2.5% on cash.' },
  { name: 'Scalable Capital (Free)', minAmount: 1, executionFee: 0.99, cashRate: 0, note: '€0.99/Sparplan execution. No monthly fee.' },
  { name: 'Comdirect', minAmount: 25, executionFee: 0, cashRate: 0, note: 'Free on select ETFs (action plans). Solid traditional broker.' },
  { name: 'DKB', minAmount: 10, executionFee: 1.50, cashRate: 0, note: 'Free for ETF Sparpläne (current promotion).' },
]

interface SparplanForm {
  etfName: string
  isin: string
  monthlyAmount: string
  executionDay: string
  broker: string
  isActive: boolean
}

const EMPTY_FORM: SparplanForm = {
  etfName: '',
  isin: '',
  monthlyAmount: '',
  executionDay: '1',
  broker: 'Trade Republic',
  isActive: true,
}

interface SparplanManagerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function SparplanManager({ state, onUpdate }: SparplanManagerProps) {
  const [addingSparplan, setAddingSparplan] = useState(false)
  const [showBrokers, setShowBrokers] = useState(false)
  const [form, setForm] = useState<SparplanForm>(EMPTY_FORM)

  const sparplaene = state.sparplaene ?? []
  const active = sparplaene.filter((s) => s.isActive)
  const totalMonthly = active.reduce((s, p) => s + p.monthlyAmount, 0)
  const totalAnnual = totalMonthly * 12

  const handleAdd = () => {
    const amount = parseFloat(form.monthlyAmount)
    const day = parseInt(form.executionDay)
    if (!form.etfName.trim() || isNaN(amount) || amount <= 0) return

    const sparplan: ETFSparplan = {
      id: createId(),
      etfName: form.etfName.trim(),
      isin: form.isin.trim(),
      monthlyAmount: amount,
      executionDay: isNaN(day) ? 1 : Math.min(28, Math.max(1, day)),
      broker: form.broker,
      isActive: form.isActive,
    }

    onUpdate((prev) => ({ ...prev, sparplaene: [...(prev.sparplaene ?? []), sparplan] }))
    setForm(EMPTY_FORM)
    setAddingSparplan(false)
  }

  const handleToggleActive = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      sparplaene: (prev.sparplaene ?? []).map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive } : s,
      ),
    }))
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      sparplaene: (prev.sparplaene ?? []).filter((s) => s.id !== id),
    }))
  }

  // Compare against CSP investment bucket
  const cspInvestmentTotal = (state.csp?.expenses ?? [])
    .filter((e) => e.bucket === 'investment')
    .reduce((s, e) => s + e.monthlyAmount, 0)
  const gap = cspInvestmentTotal - totalMonthly

  return (
    <div className="space-y-5">
      {/* Summary */}
      {sparplaene.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Monthly Sparplan</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              €{totalMonthly.toLocaleString('de-DE')}
            </p>
            <p className="text-[10px] text-share-onSurfaceVariant/60 mt-0.5">
              €{totalAnnual.toLocaleString('de-DE')}/year
            </p>
          </div>
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Active plans</p>
            <p className="text-xl font-bold text-share-onBg mt-1">{active.length}</p>
            <p className="text-[10px] text-share-onSurfaceVariant/60 mt-0.5">
              {sparplaene.length - active.length} paused
            </p>
          </div>
        </div>
      )}

      {/* CSP alignment */}
      {cspInvestmentTotal > 0 && sparplaene.length > 0 && (
        <div className={`rounded-xl border p-4 ${gap > 10 ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <p className={`text-xs font-medium ${gap > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {gap > 10
              ? `€${gap.toLocaleString('de-DE')} of your Spending Plan investments not yet in a Sparplan`
              : gap < -10
                ? `Your Sparpläne exceed your Spending Plan by €${Math.abs(gap).toLocaleString('de-DE')}`
                : 'Sparpläne match your Spending Plan'}
          </p>
          <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5">
            CSP investment bucket: €{cspInvestmentTotal}/mo | Active Sparpläne: €{totalMonthly}/mo
          </p>
        </div>
      )}

      {/* Sparplan list */}
      {sparplaene.length > 0 && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-2">
          <p className="text-xs font-semibold text-share-onBg">My Sparpläne</p>
          {sparplaene.map((plan) => (
            <div key={plan.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${plan.isActive ? 'border-share-outlineVariant bg-share-surfaceContainer' : 'border-share-outlineVariant/40 bg-share-surfaceContainer/50'}`}>
              <button
                type="button"
                onClick={() => handleToggleActive(plan.id)}
                className={`flex-shrink-0 mt-0.5 transition-colors ${plan.isActive ? 'text-emerald-400' : 'text-share-onSurfaceVariant/30'}`}
                title={plan.isActive ? 'Pause Sparplan' : 'Activate Sparplan'}
              >
                <MaterialIcon name={plan.isActive ? 'pause_circle' : 'play_circle'} filled className="text-[1.2rem]" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs font-medium ${plan.isActive ? 'text-share-onBg' : 'text-share-onSurfaceVariant/50'}`}>
                    {plan.etfName}
                  </p>
                  {plan.isin && (
                    <span className="text-[9px] text-share-onSurfaceVariant/40 font-mono">{plan.isin}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-share-onSurfaceVariant/70 flex-wrap">
                  <span>{plan.broker}</span>
                  <span>·</span>
                  <span>Executes on the {plan.executionDay}st/th</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-semibold ${plan.isActive ? 'text-emerald-400' : 'text-share-onSurfaceVariant/40'}`}>
                  €{plan.monthlyAmount.toLocaleString('de-DE')}
                </p>
                <p className="text-[10px] text-share-onSurfaceVariant/50">/month</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(plan.id)}
                className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
                aria-label="Delete Sparplan"
              >
                <MaterialIcon name="close" className="text-[0.9rem]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Sparplan form */}
      {addingSparplan ? (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
          <p className="text-xs font-semibold text-share-onBg">Add <FinanceTerm termId="sparplan" label="Sparplan" /></p>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-share-onSurfaceVariant mb-1">ETF name</label>
              <input
                type="text"
                value={form.etfName}
                onChange={(e) => setForm((p) => ({ ...p, etfName: e.target.value }))}
                placeholder="e.g. Vanguard FTSE All-World"
                autoFocus
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">ISIN (optional)</label>
              <input
                type="text"
                value={form.isin}
                onChange={(e) => setForm((p) => ({ ...p, isin: e.target.value.toUpperCase() }))}
                placeholder="IE00BK5BQT80"
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Broker</label>
              <select
                value={form.broker}
                onChange={(e) => setForm((p) => ({ ...p, broker: e.target.value }))}
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              >
                {BROKERS.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Monthly amount (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="1"
                  step="25"
                  value={form.monthlyAmount}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyAmount: e.target.value }))}
                  placeholder="100"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Execution day (1-28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.executionDay}
                onChange={(e) => setForm((p) => ({ ...p, executionDay: e.target.value }))}
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!form.etfName.trim() || !form.monthlyAmount}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Sparplan
            </button>
            <button
              type="button"
              onClick={() => { setAddingSparplan(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-share-outlineVariant/40 px-4 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingSparplan(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors w-full"
        >
          <MaterialIcon name="add_circle" className="text-[1rem]" />
          Add a Sparplan
        </button>
      )}

      {/* Broker comparison */}
      <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowBrokers((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-xs font-semibold text-share-onBg">Broker comparison (2025/2026)</p>
          <MaterialIcon name={showBrokers ? 'expand_less' : 'expand_more'} className="text-share-onSurfaceVariant/50" />
        </button>
        {showBrokers && (
          <div className="space-y-2 pt-1">
            {BROKERS.map((b) => (
              <div key={b.name} className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-share-onBg">{b.name}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-share-onSurfaceVariant">min €{b.minAmount}</span>
                    {b.executionFee === 0
                      ? <span className="text-emerald-400">Free executions</span>
                      : <span className="text-amber-400">€{b.executionFee}/execution</span>}
                    {b.cashRate > 0 && (
                      <span className="text-share-primary">{b.cashRate}% cash</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-share-onSurfaceVariant/70">{b.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
