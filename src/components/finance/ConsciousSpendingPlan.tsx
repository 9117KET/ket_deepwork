/**
 * components/finance/ConsciousSpendingPlan.tsx
 *
 * The Conscious Spending Plan (CSP) - the core of Ramit Sethi's system.
 * Four buckets: Fixed Costs (50-60%), Investments (10%+),
 * Savings Goals (5-10%), Guilt-Free Spending (20-35%).
 *
 * Adapted for Germany: German expense categories and terminology.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import { FinanceTerm, FinanceTermTooltip } from './FinanceTermTooltip'
import type { FinancialState, CSPExpense, CSPBucket } from '../../domain/financialTypes'
import { CSP_TARGETS } from '../../domain/financialTypes'

function createId(): string {
  return `csp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── Preset expense suggestions per bucket ────────────────────────────────────

const BUCKET_PRESETS: Record<CSPBucket, { label: string; category: string }[]> = {
  fixed: [
    { label: 'Miete (Rent)',               category: 'housing'   },
    { label: 'GKV (Health insurance)',      category: 'insurance' },
    { label: 'Haftpflicht',                 category: 'insurance' },
    { label: 'Berufsunfähigkeit (BU)',       category: 'insurance' },
    { label: 'Internet',                    category: 'utilities' },
    { label: 'Handy (Mobile)',              category: 'utilities' },
    { label: 'Strom (Electricity)',         category: 'utilities' },
    { label: 'Lebensmittel (Groceries)',    category: 'food'      },
    { label: 'Streaming (Netflix etc.)',    category: 'subscriptions' },
    { label: 'Gym / Fitness',              category: 'health'    },
    { label: 'Öffentlicher Verkehr',        category: 'transport' },
  ],
  investment: [
    { label: 'ETF-Sparplan',                category: 'etf'       },
    { label: 'bAV Entgeltumwandlung',       category: 'pension'   },
    { label: 'Rürup-Rente',                 category: 'pension'   },
    { label: 'Altersvorsorgedepot (2027+)', category: 'pension'   },
  ],
  savings: [
    { label: 'Notgroschen (Emergency Fund)',category: 'emergency' },
    { label: 'Urlaub (Vacation)',           category: 'travel'    },
    { label: 'Auto / Reparaturen',          category: 'transport' },
    { label: 'Anzahlung (Down payment)',    category: 'housing'   },
    { label: 'Geschenke / Feste',           category: 'gifts'     },
  ],
  guiltFree: [
    { label: 'Restaurants / Cafés',         category: 'dining'    },
    { label: 'Kleidung (Clothing)',         category: 'clothing'  },
    { label: 'Hobbys',                      category: 'hobbies'   },
    { label: 'Ausflüge / Entertainment',   category: 'fun'       },
    { label: 'Sport / Outdoor',            category: 'health'    },
    { label: 'Bücher / Kurse',             category: 'learning'  },
  ],
}

const BUCKET_INFO: Record<CSPBucket, { icon: string; termId?: string; description: string }> = {
  fixed: {
    icon: 'home',
    description: 'Non-negotiable monthly costs: rent, utilities, insurance, phone, groceries, debt minimums.',
  },
  investment: {
    icon: 'trending_up',
    description: 'Money that grows for your future. ETF-Sparplan, bAV, pension products.',
  },
  savings: {
    icon: 'savings',
    description: 'Specific named goals with a target amount: Notgroschen, vacation, car, down payment.',
  },
  guiltFree: {
    icon: 'celebration',
    termId: 'rich-life',
    description: 'Everything you enjoy guilt-free, because savings and investments are already handled.',
  },
}

const BUCKET_COLORS: Record<CSPBucket, { text: string; bg: string; border: string; bar: string; alert: string }> = {
  fixed:      { text: 'text-blue-400',    bg: 'bg-blue-400/8',    border: 'border-blue-400/20',    bar: 'bg-blue-400',    alert: 'text-red-400'    },
  investment: { text: 'text-emerald-400', bg: 'bg-emerald-400/8', border: 'border-emerald-400/20', bar: 'bg-emerald-400', alert: 'text-amber-400'  },
  savings:    { text: 'text-violet-400',  bg: 'bg-violet-400/8',  border: 'border-violet-400/20',  bar: 'bg-violet-400',  alert: 'text-amber-400'  },
  guiltFree:  { text: 'text-amber-400',   bg: 'bg-amber-400/8',   border: 'border-amber-400/20',   bar: 'bg-amber-400',   alert: 'text-amber-400'  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ConsciousSpendingPlanProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface NewExpense {
  label: string
  amount: string
  category: string
}

const EMPTY_EXPENSE: NewExpense = { label: '', amount: '', category: '' }

export function ConsciousSpendingPlan({ state, onUpdate }: ConsciousSpendingPlanProps) {
  const [addingToBucket, setAddingToBucket] = useState<CSPBucket | null>(null)
  const [newExpense, setNewExpense] = useState<NewExpense>(EMPTY_EXPENSE)
  const [showPresets, setShowPresets] = useState<CSPBucket | null>(null)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState(
    state.csp?.monthlyNetIncome?.toString() ?? '',
  )

  const csp = state.csp
  const income = csp?.monthlyNetIncome ?? 0
  const expenses = csp?.expenses ?? []

  const bucketExpenses = (bucket: CSPBucket) => expenses.filter((e) => e.bucket === bucket)
  const bucketTotal = (bucket: CSPBucket) =>
    bucketExpenses(bucket).reduce((sum, e) => sum + e.monthlyAmount, 0)
  const bucketPct = (bucket: CSPBucket) =>
    income > 0 ? Math.round((bucketTotal(bucket) / income) * 100) : 0

  const totalAllocated = expenses.reduce((sum, e) => sum + e.monthlyAmount, 0)
  const unallocated = income > 0 ? income - totalAllocated : 0

  // ── Income ──

  const handleSaveIncome = () => {
    const val = parseFloat(incomeInput)
    if (isNaN(val) || val <= 0) return
    onUpdate((prev) => ({
      ...prev,
      csp: { ...(prev.csp ?? { expenses: [] }), monthlyNetIncome: val },
    }))
    setEditingIncome(false)
  }

  // ── Expenses ──

  const handleAddExpense = (bucket: CSPBucket) => {
    const label = newExpense.label.trim()
    const amount = parseFloat(newExpense.amount)
    if (!label || isNaN(amount) || amount <= 0) return

    const expense: CSPExpense = {
      id: createId(),
      label,
      monthlyAmount: amount,
      bucket,
      category: newExpense.category || undefined,
    }

    onUpdate((prev) => ({
      ...prev,
      csp: {
        monthlyNetIncome: prev.csp?.monthlyNetIncome ?? 0,
        expenses: [...(prev.csp?.expenses ?? []), expense],
      },
    }))
    setNewExpense(EMPTY_EXPENSE)
    setAddingToBucket(null)
    setShowPresets(null)
  }

  const handleDeleteExpense = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      csp: {
        monthlyNetIncome: prev.csp?.monthlyNetIncome ?? 0,
        expenses: (prev.csp?.expenses ?? []).filter((e) => e.id !== id),
      },
    }))
  }

  const handlePresetSelect = (bucket: CSPBucket, preset: { label: string; category: string }) => {
    setNewExpense({ label: preset.label, amount: '', category: preset.category })
    setAddingToBucket(bucket)
    setShowPresets(null)
  }

  return (
    <div className="space-y-6">
      {/* Header explanation */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="donut_small" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">
              Your <FinanceTerm termId="csp" label="Conscious Spending Plan" />
            </h2>
            <p className="text-xs text-share-onSurfaceVariant mt-2 leading-relaxed">
              Allocate your income into four buckets before spending. Once savings and investments are handled automatically, spend the rest guilt-free - no tracking needed.
            </p>
          </div>
        </div>
      </section>

      {/* Monthly income input */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-share-onBg">Monthly net income</h2>
          <FinanceTermTooltip termId="csp" />
        </div>
        <p className="text-xs text-share-onSurfaceVariant mb-3">
          Enter your take-home pay after taxes and social contributions (Netto).
        </p>

        {editingIncome || income === 0 ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-share-onSurfaceVariant text-sm">€</span>
              <input
                type="number"
                min="0"
                step="100"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome()}
                placeholder="2800"
                autoFocus
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2.5 pl-7 pr-3 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveIncome}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2.5 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-share-outlineVariant bg-share-surfaceContainer px-4 py-3">
            <div>
              <span className="text-xl font-bold text-share-onBg">
                €{income.toLocaleString('de-DE')}
              </span>
              <span className="text-xs text-share-onSurfaceVariant ml-2">/month net</span>
            </div>
            <button
              type="button"
              onClick={() => { setEditingIncome(true); setIncomeInput(income.toString()) }}
              className="text-xs text-share-onSurfaceVariant hover:text-share-primary transition-colors"
            >
              <MaterialIcon name="edit" className="text-[1rem]" />
            </button>
          </div>
        )}
      </section>

      {/* Allocation overview bar */}
      {income > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-share-onBg">Allocation overview</h2>
            <span className={`text-xs font-medium ${unallocated < 0 ? 'text-red-400' : unallocated === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {unallocated < 0
                ? `€${Math.abs(unallocated).toLocaleString('de-DE')} over`
                : unallocated === 0
                  ? 'Fully allocated'
                  : `€${unallocated.toLocaleString('de-DE')} remaining`}
            </span>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5 bg-share-surfaceContainerHighest mb-3">
            {(Object.keys(CSP_TARGETS) as CSPBucket[]).map((bucket) => {
              const pct = bucketPct(bucket)
              if (pct === 0) return null
              return (
                <div
                  key={bucket}
                  className={`h-full transition-all duration-500 ${BUCKET_COLORS[bucket].bar}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                  title={`${CSP_TARGETS[bucket].label}: ${pct}%`}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(CSP_TARGETS) as [CSPBucket, typeof CSP_TARGETS[CSPBucket]][]).map(([bucket, cfg]) => {
              const pct = bucketPct(bucket)
              const amount = bucketTotal(bucket)
              const over = pct > cfg.max
              const under = pct < cfg.min && amount > 0
              return (
                <div key={bucket} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${BUCKET_COLORS[bucket].bar}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-share-onSurfaceVariant truncate">{cfg.label}</p>
                    <p className={`text-xs font-medium ${over ? 'text-red-400' : under ? 'text-amber-400' : 'text-share-onBg'}`}>
                      {pct}% <span className="text-share-onSurfaceVariant/50 font-normal text-[10px]">(target {cfg.min}-{cfg.max}%)</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Four bucket sections */}
      {(Object.entries(CSP_TARGETS) as [CSPBucket, typeof CSP_TARGETS[CSPBucket]][]).map(([bucket, cfg]) => {
        const colors = BUCKET_COLORS[bucket]
        const info = BUCKET_INFO[bucket]
        const bucketItems = bucketExpenses(bucket)
        const total = bucketTotal(bucket)
        const pct = bucketPct(bucket)
        const isAdding = addingToBucket === bucket
        const target = CSP_TARGETS[bucket]
        const overTarget = pct > target.max
        const underTarget = income > 0 && pct < target.min && total > 0

        return (
          <section
            key={bucket}
            className={`rounded-xl border bg-share-surfaceContainerLow p-5 space-y-4 ${colors.border}`}
          >
            {/* Bucket header */}
            <div className="flex items-start gap-3">
              <span className={`${colors.text} flex-shrink-0 mt-0.5`}>
                <MaterialIcon name={info.icon} filled className="text-[1.3rem]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-semibold ${colors.text}`}>
                    {cfg.label}
                    {info.termId && (
                      <span className="ml-1">
                        <FinanceTermTooltip termId={info.termId} iconOnly />
                      </span>
                    )}
                  </h3>
                  <div className="text-right flex-shrink-0">
                    {income > 0 && (
                      <span className={`text-xs font-semibold ${overTarget ? 'text-red-400' : underTarget ? 'text-amber-400' : colors.text}`}>
                        {pct}%
                      </span>
                    )}
                    <span className="text-xs text-share-onSurfaceVariant ml-1">
                      target {cfg.min}-{cfg.max}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-share-onSurfaceVariant mt-0.5">{info.description}</p>

                {/* Progress bar */}
                {income > 0 && (
                  <div className="mt-2 h-1 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        overTarget ? 'bg-red-500' : underTarget ? 'bg-amber-500' : colors.bar
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}

                {/* Alerts */}
                {overTarget && (
                  <p className="text-[10px] text-red-400 mt-1">
                    {bucket === 'fixed'
                      ? 'Fixed costs over 60% - this is a structural problem. Consider housing cost or income changes.'
                      : `Over target range - consider reallocating to investments or savings.`}
                  </p>
                )}
                {bucket === 'investment' && income > 0 && pct < target.min && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    Investments below 10% - automating an <FinanceTerm termId="sparplan" label="ETF-Sparplan" /> will fix this.
                  </p>
                )}
              </div>
            </div>

            {/* Expense list */}
            {bucketItems.length > 0 && (
              <ul className="space-y-1.5">
                {bucketItems.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2"
                  >
                    <span className="flex-1 text-xs text-share-onBg truncate">{expense.label}</span>
                    <span className="text-xs font-medium text-share-onBg flex-shrink-0">
                      €{expense.monthlyAmount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label="Remove expense"
                    >
                      <MaterialIcon name="close" className="text-[0.9rem]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Bucket total */}
            {bucketItems.length > 0 && (
              <div className="flex items-center justify-between text-xs border-t border-share-outlineVariant/30 pt-2">
                <span className="text-share-onSurfaceVariant">Total</span>
                <span className={`font-semibold ${colors.text}`}>
                  €{total.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/month
                </span>
              </div>
            )}

            {/* Add expense form */}
            {isAdding ? (
              <div className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newExpense.label}
                    onChange={(e) => setNewExpense((p) => ({ ...p, label: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExpense(bucket)}
                    placeholder="Expense name"
                    autoFocus
                    className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                  />
                  <AudioInput
                    onTranscript={(text) => setNewExpense((p) => ({ ...p, label: text }))}
                    lang="de-DE"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-share-onSurfaceVariant text-sm">€</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddExpense(bucket)}
                      placeholder="Amount"
                      className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-7 pr-3 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                    />
                  </div>
                  <span className="text-xs text-share-onSurfaceVariant">/month</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddExpense(bucket)}
                    disabled={!newExpense.label.trim() || !newExpense.amount}
                    className="rounded-lg border border-share-primary bg-share-primary/10 px-3 py-1.5 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingToBucket(null); setNewExpense(EMPTY_EXPENSE); setShowPresets(null) }}
                    className="rounded-lg border border-share-outlineVariant/40 px-3 py-1.5 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showPresets === bucket ? (
              /* Preset picker */
              <div className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3">
                <p className="text-xs text-share-onSurfaceVariant mb-2 font-medium">Quick add from presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUCKET_PRESETS[bucket].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetSelect(bucket, preset)}
                      className="rounded-full border border-share-outlineVariant bg-share-surfaceContainerHigh px-2.5 py-1 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAddingToBucket(bucket); setShowPresets(null) }}
                    className="text-xs text-share-primary hover:underline"
                  >
                    + Custom expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPresets(null)}
                    className="text-xs text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Add buttons */
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPresets(bucket); setAddingToBucket(null) }}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-share-outlineVariant px-3 py-2 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
                >
                  <MaterialIcon name="bolt" className="text-[0.9rem]" />
                  Quick add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingToBucket(bucket); setShowPresets(null); setNewExpense(EMPTY_EXPENSE) }}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-share-outlineVariant px-3 py-2 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
                >
                  <MaterialIcon name="add" className="text-[0.9rem]" />
                  Custom
                </button>
              </div>
            )}
          </section>
        )
      })}

      {/* Summary */}
      {income > 0 && expenses.length > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <h2 className="text-sm font-semibold text-share-onBg mb-3">Monthly summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-share-onSurfaceVariant">Net income</span>
              <span className="text-share-onBg font-medium">€{income.toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-share-onSurfaceVariant">Total allocated</span>
              <span className="text-share-onBg font-medium">€{totalAllocated.toLocaleString('de-DE')}</span>
            </div>
            <div className="h-px bg-share-outlineVariant my-1" />
            <div className="flex justify-between text-xs">
              <span className={unallocated < 0 ? 'text-red-400' : 'text-share-onSurfaceVariant'}>
                {unallocated < 0 ? 'Over budget' : unallocated === 0 ? 'Fully allocated' : 'Unallocated'}
              </span>
              <span className={`font-semibold ${unallocated < 0 ? 'text-red-400' : unallocated === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                €{Math.abs(unallocated).toLocaleString('de-DE')}
              </span>
            </div>
          </div>

          {unallocated > 0 && (
            <p className="mt-3 text-xs text-amber-400">
              You have €{unallocated.toLocaleString('de-DE')} unallocated. Add it to Investments or Savings - don't leave it as float in your Girokonto.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
