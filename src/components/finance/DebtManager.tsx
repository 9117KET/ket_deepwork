/**
 * components/finance/DebtManager.tsx
 *
 * Debt tracker with avalanche and snowball payoff calculators.
 * Avalanche: pay highest interest rate first (mathematically optimal).
 * Snowball: pay lowest balance first (psychological wins, slightly more interest paid).
 */

import { useState, useMemo } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, Debt, DebtType, DebtPayoffStrategy } from '../../domain/financialTypes'

function createId(): string {
  return `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  dispo: 'Dispo (Overdraft)',
  creditCard: 'Credit Card',
  studentLoan: 'Student Loan (BAföG / Studienkredit)',
  carLoan: 'Car Loan (Autokredit)',
  mortgage: 'Mortgage (Hypothek)',
  other: 'Other',
}

const DEBT_TYPE_ICONS: Record<DebtType, string> = {
  dispo: 'money_off',
  creditCard: 'credit_card',
  studentLoan: 'school',
  carLoan: 'directions_car',
  mortgage: 'home',
  other: 'receipt_long',
}

const DEBT_TYPE_COLORS: Record<DebtType, string> = {
  dispo: 'text-red-400',
  creditCard: 'text-orange-400',
  studentLoan: 'text-blue-400',
  carLoan: 'text-amber-400',
  mortgage: 'text-violet-400',
  other: 'text-share-onSurfaceVariant',
}

// ─── Payoff calculator ────────────────────────────────────────────────────────

interface PayoffResult {
  debt: Debt
  monthsToPayoff: number
  totalInterestPaid: number
  payoffOrder: number
}

interface PayoffSummary {
  results: PayoffResult[]
  totalMonths: number
  totalInterest: number
  minOnlyMonths: number
  minOnlyInterest: number
}

function calculatePayoff(
  debts: Debt[],
  strategy: DebtPayoffStrategy,
  extraMonthlyPayment: number,
): PayoffSummary {
  if (debts.length === 0) {
    return { results: [], totalMonths: 0, totalInterest: 0, minOnlyMonths: 0, minOnlyInterest: 0 }
  }

  const sorted = [...debts].sort((a, b) =>
    strategy === 'avalanche'
      ? b.interestRate - a.interestRate
      : a.balance - b.balance,
  )

  const simulate = (extra: number): { results: PayoffResult[]; totalMonths: number; totalInterest: number } => {
    const balances = sorted.map((d) => d.balance)
    const interest = sorted.map(() => 0)
    const monthsPaid = sorted.map(() => 0)
    const paidOff = sorted.map(() => false)
    let extraPool = extra
    let month = 0
    const MAX_MONTHS = 600

    while (balances.some((b) => b > 0) && month < MAX_MONTHS) {
      month++
      // Accrue monthly interest
      for (let i = 0; i < sorted.length; i++) {
        if (paidOff[i]) continue
        const monthlyRate = sorted[i].interestRate / 100 / 12
        const accrued = balances[i] * monthlyRate
        interest[i] += accrued
        balances[i] += accrued
      }

      // Pay minimums first, collect freed minimums
      let freedPayments = 0
      for (let i = 0; i < sorted.length; i++) {
        if (paidOff[i]) continue
        const minPay = Math.min(sorted[i].minimumPayment, balances[i])
        balances[i] -= minPay
        if (balances[i] <= 0.01) {
          freedPayments += sorted[i].minimumPayment
          balances[i] = 0
          if (!paidOff[i]) {
            monthsPaid[i] = month
            paidOff[i] = true
          }
        }
      }

      // Add freed minimums to extra pool
      extraPool += freedPayments

      // Apply extra to first unpaid debt in sorted order
      let remaining = extraPool
      for (let i = 0; i < sorted.length; i++) {
        if (paidOff[i] || balances[i] <= 0) continue
        const apply = Math.min(remaining, balances[i])
        balances[i] -= apply
        remaining -= apply
        if (balances[i] <= 0.01) {
          balances[i] = 0
          if (!paidOff[i]) {
            monthsPaid[i] = month
            paidOff[i] = true
          }
        }
        if (remaining <= 0) break
      }
    }

    const results: PayoffResult[] = sorted.map((debt, i) => ({
      debt,
      monthsToPayoff: monthsPaid[i] || month,
      totalInterestPaid: Math.round(interest[i]),
      payoffOrder: i + 1,
    }))

    return {
      results,
      totalMonths: month,
      totalInterest: Math.round(interest.reduce((a, b) => a + b, 0)),
    }
  }

  const withExtra = simulate(extraMonthlyPayment)
  const minOnly = simulate(0)

  return {
    ...withExtra,
    minOnlyMonths: minOnly.totalMonths,
    minOnlyInterest: minOnly.totalInterest,
  }
}

function monthsToText(months: number): string {
  if (months <= 0) return '0 months'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}mo`
  if (m === 0) return `${y}yr`
  return `${y}yr ${m}mo`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DebtManagerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface NewDebtForm {
  label: string
  type: DebtType
  balance: string
  interestRate: string
  minimumPayment: string
}

const EMPTY_FORM: NewDebtForm = {
  label: '',
  type: 'dispo',
  balance: '',
  interestRate: '',
  minimumPayment: '',
}

export function DebtManager({ state, onUpdate }: DebtManagerProps) {
  const [addingDebt, setAddingDebt] = useState(false)
  const [form, setForm] = useState<NewDebtForm>(EMPTY_FORM)
  const [extraPayment, setExtraPayment] = useState('0')
  const strategy = state.debtPayoffStrategy ?? 'avalanche'

  const debts = state.debts ?? []
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0)
  const totalMinimums = debts.reduce((sum, d) => sum + d.minimumPayment, 0)
  const extra = parseFloat(extraPayment) || 0

  const payoff = useMemo(
    () => calculatePayoff(state.debts ?? [], strategy, extra),
    [state.debts, strategy, extra],
  )

  const monthsSaved = payoff.minOnlyMonths - payoff.totalMonths
  const interestSaved = payoff.minOnlyInterest - payoff.totalInterest

  const setStrategy = (s: DebtPayoffStrategy) => {
    onUpdate((prev) => ({ ...prev, debtPayoffStrategy: s }))
  }

  const handleAddDebt = () => {
    const label = form.label.trim() || DEBT_TYPE_LABELS[form.type]
    const balance = parseFloat(form.balance)
    const rate = parseFloat(form.interestRate)
    const min = parseFloat(form.minimumPayment)
    if (isNaN(balance) || isNaN(rate) || isNaN(min)) return

    const debt: Debt = {
      id: createId(),
      label,
      type: form.type,
      balance,
      interestRate: rate,
      minimumPayment: min,
    }

    onUpdate((prev) => ({ ...prev, debts: [...(prev.debts ?? []), debt] }))
    setForm(EMPTY_FORM)
    setAddingDebt(false)
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      debts: (prev.debts ?? []).filter((d) => d.id !== id),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="credit_card" filled className="text-red-400 text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Debt Manager</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Track all your debts and use the payoff calculator to see exactly when you will be debt-free and how much interest you will save.{' '}
              <FinanceTerm termId="dispo" label="Dispo" /> at 9-12% APR is always the first priority.
            </p>
          </div>
        </div>
      </section>

      {/* Debt list */}
      {debts.length > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-share-onBg">My debts</h3>
            <div className="text-right">
              <p className="text-[10px] text-share-onSurfaceVariant">Total debt</p>
              <p className="text-sm font-semibold text-red-400">
                €{totalDebt.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {debts.map((debt) => (
              <li key={debt.id} className="flex items-center gap-3 rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3">
                <span className={`flex-shrink-0 ${DEBT_TYPE_COLORS[debt.type]}`}>
                  <MaterialIcon name={DEBT_TYPE_ICONS[debt.type]} className="text-[1.2rem]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-share-onBg">{debt.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-red-400/80">{debt.interestRate}% APR</span>
                    <span className="text-[10px] text-share-onSurfaceVariant/50">min €{debt.minimumPayment}/mo</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-red-400">
                    €{debt.balance.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(debt.id)}
                  className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
                  aria-label="Delete debt"
                >
                  <MaterialIcon name="close" className="text-[0.9rem]" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-xs border-t border-share-outlineVariant/30 pt-2">
            <span className="text-share-onSurfaceVariant">Total minimum payments</span>
            <span className="font-medium text-share-onBg">€{totalMinimums.toLocaleString('de-DE')}/mo</span>
          </div>
        </section>
      )}

      {/* Add debt form */}
      {addingDebt ? (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-3">
          <h3 className="text-sm font-semibold text-share-onBg">Add a debt</h3>

          {/* Type picker */}
          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1.5">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type }))}
                  className={[
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                    form.type === type
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant hover:text-share-onBg border border-transparent',
                  ].join(' ')}
                >
                  <MaterialIcon name={DEBT_TYPE_ICONS[type]} className="text-[0.85rem]" />
                  {DEBT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder={DEBT_TYPE_LABELS[form.type]}
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Balance (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.balance}
                  onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
                  placeholder="5000"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Interest rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.interestRate}
                  onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
                  placeholder="9.9"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-2 pr-6 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Min. payment (€/mo)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.minimumPayment}
                  onChange={(e) => setForm((p) => ({ ...p, minimumPayment: e.target.value }))}
                  placeholder="100"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddDebt}
              disabled={!form.balance || !form.interestRate || !form.minimumPayment}
              className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add debt
            </button>
            <button
              type="button"
              onClick={() => { setAddingDebt(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-share-outlineVariant/40 px-4 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAddingDebt(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-red-500/40 hover:text-red-400 transition-colors w-full"
        >
          <MaterialIcon name="add_circle" className="text-[1rem]" />
          Add a debt
        </button>
      )}

      {/* Payoff calculator - only shown when debts exist */}
      {debts.length > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-5">
          <h3 className="text-sm font-semibold text-share-onBg">Payoff Calculator</h3>

          {/* Strategy picker */}
          <div>
            <p className="text-xs text-share-onSurfaceVariant mb-2">Payoff strategy</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStrategy('avalanche')}
                className={[
                  'rounded-lg border p-3 text-left transition-colors',
                  strategy === 'avalanche'
                    ? 'border-share-primary bg-share-primary/10'
                    : 'border-share-outlineVariant bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh',
                ].join(' ')}
              >
                <p className={`text-xs font-semibold ${strategy === 'avalanche' ? 'text-share-primary' : 'text-share-onBg'}`}>
                  Avalanche
                </p>
                <p className="text-[10px] text-share-onSurfaceVariant mt-0.5">
                  Highest interest first. Mathematically optimal - saves the most money.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStrategy('snowball')}
                className={[
                  'rounded-lg border p-3 text-left transition-colors',
                  strategy === 'snowball'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-share-outlineVariant bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh',
                ].join(' ')}
              >
                <p className={`text-xs font-semibold ${strategy === 'snowball' ? 'text-violet-400' : 'text-share-onBg'}`}>
                  Snowball
                </p>
                <p className="text-[10px] text-share-onSurfaceVariant mt-0.5">
                  Smallest balance first. Psychological wins keep you motivated.
                </p>
              </button>
            </div>
          </div>

          {/* Extra payment */}
          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1">
              Extra payment above minimums (€/month)
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant">€</span>
              <input
                type="number"
                min="0"
                step="50"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-7 pr-3 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-share-onSurfaceVariant/60 mt-1">
              Each €100 extra/month saves thousands in interest. Try different amounts.
            </p>
          </div>

          {/* Results summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide mb-1">
                Debt-free in
              </p>
              <p className="text-lg font-bold text-emerald-400">{monthsToText(payoff.totalMonths)}</p>
              <p className="text-[10px] text-share-onSurfaceVariant/60 mt-1">
                vs. {monthsToText(payoff.minOnlyMonths)} paying minimums only
              </p>
              {monthsSaved > 0 && (
                <p className="text-[10px] text-emerald-400 font-medium mt-1">
                  {monthsToText(monthsSaved)} faster
                </p>
              )}
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide mb-1">
                Total interest
              </p>
              <p className="text-lg font-bold text-red-400">
                €{payoff.totalInterest.toLocaleString('de-DE')}
              </p>
              <p className="text-[10px] text-share-onSurfaceVariant/60 mt-1">
                vs. €{payoff.minOnlyInterest.toLocaleString('de-DE')} minimums only
              </p>
              {interestSaved > 0 && (
                <p className="text-[10px] text-emerald-400 font-medium mt-1">
                  €{interestSaved.toLocaleString('de-DE')} saved
                </p>
              )}
            </div>
          </div>

          {/* Per-debt payoff order */}
          <div>
            <p className="text-xs font-medium text-share-onBg mb-2">Payoff order</p>
            <div className="space-y-2">
              {payoff.results.map((result) => {
                const maxMonths = Math.max(...payoff.results.map((r) => r.monthsToPayoff), 1)
                const widthPct = (result.monthsToPayoff / maxMonths) * 100
                return (
                  <div key={result.debt.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-[10px] ${DEBT_TYPE_COLORS[result.debt.type]}`}>
                          #{result.payoffOrder}
                        </span>
                        <span className="text-share-onBg truncate">{result.debt.label}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-share-onSurfaceVariant">{monthsToText(result.monthsToPayoff)}</span>
                        <span className="text-share-onSurfaceVariant/40 ml-2 text-[10px]">
                          +€{result.totalInterestPaid.toLocaleString('de-DE')} interest
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/60 transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Avalanche vs snowball comparison note */}
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-3">
            <p className="text-[10px] text-share-onSurfaceVariant leading-relaxed">
              Avalanche saves the most money mathematically. Snowball keeps more people on track psychologically. Both beat paying minimums only - pick the one you will actually stick to.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
