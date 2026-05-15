/**
 * components/finance/ETFPortfolio.tsx
 *
 * ETF holdings tracker with allocation chart, gains/losses,
 * and popular German ETF quick-add presets.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, ETFHolding, ETFDistributionType } from '../../domain/financialTypes'

function createId(): string {
  return `etf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── Popular German ETF presets ───────────────────────────────────────────────

interface ETFPreset {
  name: string
  isin: string
  type: ETFDistributionType
  ter: number
  description: string
  recommended: boolean
}

const ETF_PRESETS: ETFPreset[] = [
  {
    name: 'Vanguard FTSE All-World (Acc)',
    isin: 'IE00BK5BQT80',
    type: 'accumulating',
    ter: 0.22,
    description: '~4,000 stocks, developed + emerging markets. Best one-ETF global solution.',
    recommended: true,
  },
  {
    name: 'iShares Core MSCI World (Acc)',
    isin: 'IE00B4L5Y983',
    type: 'accumulating',
    ter: 0.20,
    description: '~1,500 stocks, developed markets only. Add EM ETF for full coverage.',
    recommended: true,
  },
  {
    name: 'SPDR MSCI ACWI (Acc)',
    isin: 'IE00B44Z5B48',
    type: 'accumulating',
    ter: 0.12,
    description: 'Cheapest all-world ETF. Developed + emerging markets.',
    recommended: false,
  },
  {
    name: 'iShares Core MSCI EM IMI (Acc)',
    isin: 'IE00BKM4GZ66',
    type: 'accumulating',
    ter: 0.18,
    description: 'Emerging markets complement for MSCI World holders.',
    recommended: false,
  },
  {
    name: 'Vanguard FTSE All-World (Dist)',
    isin: 'IE00B3RBWM25',
    type: 'distributing',
    ter: 0.22,
    description: 'Distributing version - pays dividends quarterly.',
    recommended: false,
  },
]

// ─── Allocation colours (cycle through a palette) ────────────────────────────

const PALETTE = [
  '#00daf3', '#10b981', '#a78bfa', '#f59e0b', '#f87171',
  '#60a5fa', '#34d399', '#c084fc', '#fbbf24', '#ef4444',
]

// ─── New holding form ─────────────────────────────────────────────────────────

interface HoldingForm {
  name: string
  isin: string
  type: ETFDistributionType
  shares: string
  currentPriceEur: string
  purchasePriceEur: string
  depot: string
}

const EMPTY_FORM: HoldingForm = {
  name: '',
  isin: '',
  type: 'accumulating',
  shares: '',
  currentPriceEur: '',
  purchasePriceEur: '',
  depot: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ETFPortfolioProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function ETFPortfolio({ state, onUpdate }: ETFPortfolioProps) {
  const [addingHolding, setAddingHolding] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [form, setForm] = useState<HoldingForm>(EMPTY_FORM)

  const holdings = state.portfolio ?? []

  // Totals
  const holdingsWithValue = holdings.map((h) => ({
    ...h,
    value: h.currentPriceEur != null ? h.shares * h.currentPriceEur : null,
    cost: h.purchasePriceEur != null ? h.shares * h.purchasePriceEur : null,
  }))
  const totalValue = holdingsWithValue.reduce((s, h) => s + (h.value ?? 0), 0)
  const totalCost = holdingsWithValue.reduce((s, h) => s + (h.cost ?? 0), 0)
  const totalGain = totalValue - totalCost
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  // Allocation by holding (for stacked bar)
  const allocation = holdingsWithValue
    .filter((h) => h.value != null && totalValue > 0)
    .map((h, i) => ({
      id: h.id,
      name: h.name,
      pct: Math.round(((h.value ?? 0) / totalValue) * 100),
      color: PALETTE[i % PALETTE.length],
    }))

  const handlePresetSelect = (preset: ETFPreset) => {
    setForm({
      name: preset.name,
      isin: preset.isin,
      type: preset.type,
      shares: '',
      currentPriceEur: '',
      purchasePriceEur: '',
      depot: '',
    })
    setShowPresets(false)
    setAddingHolding(true)
  }

  const handleAdd = () => {
    const shares = parseFloat(form.shares)
    if (!form.name.trim() || isNaN(shares) || shares <= 0) return

    const holding: ETFHolding = {
      id: createId(),
      name: form.name.trim(),
      isin: form.isin.trim(),
      type: form.type,
      shares,
      currentPriceEur: form.currentPriceEur ? parseFloat(form.currentPriceEur) : undefined,
      purchasePriceEur: form.purchasePriceEur ? parseFloat(form.purchasePriceEur) : undefined,
      depot: form.depot.trim(),
    }

    onUpdate((prev) => ({ ...prev, portfolio: [...(prev.portfolio ?? []), holding] }))
    setForm(EMPTY_FORM)
    setAddingHolding(false)
  }

  const handleUpdatePrice = (id: string, field: 'currentPriceEur' | 'purchasePriceEur', val: string) => {
    const price = parseFloat(val)
    onUpdate((prev) => ({
      ...prev,
      portfolio: (prev.portfolio ?? []).map((h) =>
        h.id === id ? { ...h, [field]: isNaN(price) ? undefined : price } : h,
      ),
    }))
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      portfolio: (prev.portfolio ?? []).filter((h) => h.id !== id),
    }))
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Portfolio value</p>
            <p className="text-base font-bold text-share-onBg mt-1">
              {totalValue > 0
                ? `€${totalValue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Total cost</p>
            <p className="text-base font-bold text-share-onBg mt-1">
              {totalCost > 0
                ? `€${totalCost.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Total gain/loss</p>
            <p className={`text-base font-bold mt-1 ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalCost > 0
                ? `${totalGain >= 0 ? '+' : ''}€${totalGain.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Allocation bar */}
      {allocation.length > 1 && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
          <p className="text-xs font-semibold text-share-onBg mb-3">Allocation</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {allocation.map((a) => (
              <div
                key={a.id}
                style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                title={`${a.name}: ${a.pct}%`}
                className="h-full transition-all duration-500"
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {allocation.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-[10px] text-share-onSurfaceVariant">{a.name} <span className="font-medium text-share-onBg">{a.pct}%</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings list */}
      {holdings.length > 0 && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-2">
          <p className="text-xs font-semibold text-share-onBg">Holdings</p>
          {holdingsWithValue.map((h) => (
            <HoldingRow
              key={h.id}
              holding={h}
              value={h.value}
              gain={h.value != null && h.cost != null ? h.value - h.cost : null}
              onUpdateCurrent={(v) => handleUpdatePrice(h.id, 'currentPriceEur', v)}
              onUpdatePurchase={(v) => handleUpdatePrice(h.id, 'purchasePriceEur', v)}
              onDelete={() => handleDelete(h.id)}
            />
          ))}
        </div>
      )}

      {/* Add / Presets */}
      {showPresets ? (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-share-onBg">Popular German ETFs</p>
            <button type="button" onClick={() => setShowPresets(false)} className="text-xs text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant">✕</button>
          </div>
          <div className="space-y-2">
            {ETF_PRESETS.map((preset) => (
              <button
                key={preset.isin}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className="w-full text-left rounded-lg border border-share-outlineVariant bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-share-onBg">{preset.name}</p>
                      {preset.recommended && (
                        <span className="text-[9px] rounded-full border border-share-primary/40 text-share-primary px-1.5 py-0.5">Recommended</span>
                      )}
                    </div>
                    <p className="text-[10px] text-share-onSurfaceVariant mt-0.5">{preset.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-share-onSurfaceVariant">{preset.isin}</p>
                    <p className="text-[10px] text-share-onSurfaceVariant/60">{preset.ter}% <FinanceTerm termId="ter" label="TER" /></p>
                    <p className={`text-[10px] mt-0.5 ${preset.type === 'accumulating' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {preset.type}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setShowPresets(false); setAddingHolding(true) }}
            className="text-xs text-share-primary hover:underline"
          >
            + Enter a custom ETF instead
          </button>
        </div>
      ) : addingHolding ? (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
          <p className="text-xs font-semibold text-share-onBg">Add ETF holding</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-share-onSurfaceVariant mb-1">ETF name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Vanguard FTSE All-World"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">ISIN</label>
              <input
                type="text"
                value={form.isin}
                onChange={(e) => setForm((p) => ({ ...p, isin: e.target.value.toUpperCase() }))}
                placeholder="IE00BK5BQT80"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Depot / Broker</label>
              <input
                type="text"
                value={form.depot}
                onChange={(e) => setForm((p) => ({ ...p, depot: e.target.value }))}
                placeholder="e.g. Trade Republic"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {(['accumulating', 'distributing'] as ETFDistributionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: t }))}
                className={[
                  'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                  form.type === t
                    ? t === 'accumulating'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                    : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg',
                ].join(' ')}
              >
                {t === 'accumulating' ? 'Thesaurierend (Acc)' : 'Ausschüttend (Dist)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Shares / Units</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.shares}
                onChange={(e) => setForm((p) => ({ ...p, shares: e.target.value }))}
                placeholder="10.5"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Current price (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentPriceEur}
                  onChange={(e) => setForm((p) => ({ ...p, currentPriceEur: e.target.value }))}
                  placeholder="120.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-6 pr-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Avg. purchase price (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePriceEur}
                  onChange={(e) => setForm((p) => ({ ...p, purchasePriceEur: e.target.value }))}
                  placeholder="95.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-6 pr-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!form.name.trim() || !form.shares}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add holding
            </button>
            <button
              type="button"
              onClick={() => { setAddingHolding(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPresets(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="bolt" className="text-[1rem]" />
            Add from popular ETFs
          </button>
          <button
            type="button"
            onClick={() => setAddingHolding(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="add" className="text-[1rem]" />
            Custom ETF
          </button>
        </div>
      )}

      {/* Info note about accumulating ETFs */}
      <div className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-4">
        <p className="text-[10px] text-share-onSurfaceVariant leading-relaxed">
          <span className="font-medium text-share-onBg">Accumulating (thesaurierend) ETFs</span> are preferred for German investors. They reinvest dividends automatically and only trigger the small annual <FinanceTerm termId="vorabpauschale" label="Vorabpauschale" /> instead of full <FinanceTerm termId="abgeltungssteuer" label="Abgeltungssteuer" /> on each dividend payment.
        </p>
      </div>
    </div>
  )
}

// ─── Holding row ──────────────────────────────────────────────────────────────

interface HoldingRowProps {
  holding: ETFHolding
  value: number | null
  gain: number | null
  onUpdateCurrent: (v: string) => void
  onUpdatePurchase: (v: string) => void
  onDelete: () => void
}

function HoldingRow({ holding, value, gain, onUpdateCurrent, onDelete }: HoldingRowProps) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(holding.currentPriceEur?.toString() ?? '')

  return (
    <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-share-onBg truncate">{holding.name}</p>
            <span className={`text-[9px] rounded-full px-1.5 py-0.5 border ${holding.type === 'accumulating' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'}`}>
              {holding.type === 'accumulating' ? 'Acc' : 'Dist'}
            </span>
            {holding.isin && (
              <span className="text-[9px] text-share-onSurfaceVariant/50 font-mono">{holding.isin}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
            <span className="text-share-onSurfaceVariant">{holding.shares} shares</span>
            {holding.depot && <span className="text-share-onSurfaceVariant/60">@ {holding.depot}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {editingPrice ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onUpdateCurrent(priceInput); setEditingPrice(false) }
                  }}
                  autoFocus
                  className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-100 focus:border-share-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { onUpdateCurrent(priceInput); setEditingPrice(false) }}
                  className="text-[10px] text-share-primary hover:underline"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setPriceInput(holding.currentPriceEur?.toString() ?? ''); setEditingPrice(true) }}
                className="text-xs text-share-onSurfaceVariant hover:text-share-primary transition-colors"
              >
                {holding.currentPriceEur != null ? `€${holding.currentPriceEur.toFixed(2)}/share` : 'Add current price'}
              </button>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {value != null && (
            <p className="text-xs font-semibold text-share-onBg">
              €{value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          )}
          {gain != null && (
            <p className={`text-[10px] font-medium ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gain >= 0 ? '+' : ''}€{gain.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
          aria-label="Delete holding"
        >
          <MaterialIcon name="close" className="text-[0.9rem]" />
        </button>
      </div>
    </div>
  )
}
