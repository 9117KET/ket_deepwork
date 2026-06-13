/**
 * components/finance/WaterfallDashboard.tsx
 *
 * The "Today" landing for the Financial Planner. Renders the monthly cash-flow
 * waterfall (the user's Excel mental model) ending in a big "left to spend" number,
 * plus inline editors for income sources and critical (one-off) expenses, quick
 * capture shortcuts, and a collapsible setup / Big Wins block.
 */

import { useMemo, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import { FinanceDashboard } from './FinanceDashboard'
import { computeWaterfall, monthKeyOf } from '../../domain/financeWaterfall'
import type {
  FinancialState,
  IncomeSource,
  CriticalExpense,
} from '../../domain/financialTypes'
import type { FinanceTab } from './FinanceLayout'

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-DE', {
    month: 'long',
    year: 'numeric',
  })
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString('de-DE')}`
}

/** A planned trip surfaced for the critical-expense picker. */
export interface UpcomingTripOption {
  id: string
  name: string
  monthKey: string
  amount: number
  startDate?: string
}

interface WaterfallDashboardProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
  monthKey: string
  onMonthChange: (monthKey: string) => void
  /** Upcoming trips with a budget, for the critical-expense picker. */
  trips?: UpcomingTripOption[]
  /** Navigate to a Today sub-view for quick capture. */
  onCapture?: (target: 'scan' | 'voice') => void
  /** Navigate to another finance group (used by the setup checklist). */
  onNavigateGroup?: (tab: FinanceTab) => void
}

export function WaterfallDashboard({
  state,
  onUpdate,
  monthKey,
  onMonthChange,
  trips = [],
  onCapture,
  onNavigateGroup,
}: WaterfallDashboardProps) {
  const [showSetup, setShowSetup] = useState(false)
  const w = useMemo(() => computeWaterfall(state, monthKey), [state, monthKey])

  const availableMonths = useMemo(() => {
    const keys = new Set<string>([monthKeyOf()])
    keys.add(monthKey)
    Object.keys(state.incomeSources ?? {}).forEach((k) => keys.add(k))
    Object.keys(state.criticalExpenses ?? {}).forEach((k) => keys.add(k))
    Object.keys(state.transactions ?? {}).forEach((k) => keys.add(k))
    return [...keys].sort().reverse()
  }, [state.incomeSources, state.criticalExpenses, state.transactions, monthKey])

  const negative = w.leftToSpend < 0

  return (
    <div className="space-y-5">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-share-onBg">Monthly cash flow</h2>
        <select
          value={monthKey}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonthKey(m)}</option>
          ))}
        </select>
      </div>

      {/* Hero: left to spend */}
      <section
        className={[
          'rounded-2xl border p-5 text-center',
          negative
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5',
        ].join(' ')}
      >
        <p className="text-xs uppercase tracking-wide text-share-onSurfaceVariant">
          {negative ? 'Over budget this month' : 'Left to spend this month'}
        </p>
        <p className={`mt-1 text-3xl font-bold ${negative ? 'text-red-400' : 'text-emerald-400'}`}>
          {negative ? `−${eur(Math.abs(w.leftToSpend))}` : eur(w.leftToSpend)}
        </p>
        <p className="mt-1 text-xs text-share-onSurfaceVariant">
          {w.daysLeftInMonth > 0 && (
            <>
              {w.daysLeftInMonth} day{w.daysLeftInMonth !== 1 ? 's' : ''} left
              {!negative && w.daysLeftInMonth > 0 && (
                <> · ≈ {eur(w.leftToSpend / w.daysLeftInMonth)}/day</>
              )}
            </>
          )}
        </p>
      </section>

      {/* Waterfall rows */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4">
        <WaterfallRow label="Income + savings" amount={w.totalIncome} tone="income" />
        {w.incomeUsedFallback && (
          <p className="text-[10px] text-share-onSurfaceVariant/60 pl-1 -mt-1 mb-1">
            Using your Spending Plan net income. Add lines below to itemize.
          </p>
        )}
        <WaterfallRow label="− Savings this month" amount={-w.savings} tone="minus" />
        <WaterfallDivider label="Income after savings" amount={w.afterSavings} />
        <WaterfallRow label="− Monthly bills" amount={-w.bills} tone="minus" />
        <WaterfallRow label="− Critical expenses" amount={-w.critical} tone="minus" />
        <WaterfallDivider label="Remaining to spend" amount={w.remaining} />
        <WaterfallRow label="− Daily spend so far" amount={-w.dailySpent} tone="minus" />
        <WaterfallDivider label="Left to spend" amount={w.leftToSpend} bold />
      </section>

      {/* Quick capture */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCapture?.('scan')}
          className="flex items-center justify-center gap-2 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-4 py-3 text-xs font-medium text-share-onBg hover:border-share-primary/50 hover:text-share-primary transition-colors"
        >
          <MaterialIcon name="photo_camera" className="text-[1.1rem]" />
          Scan receipt
        </button>
        <button
          type="button"
          onClick={() => onCapture?.('voice')}
          className="flex items-center justify-center gap-2 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-4 py-3 text-xs font-medium text-share-onBg hover:border-share-primary/50 hover:text-share-primary transition-colors"
        >
          <MaterialIcon name="mic" className="text-[1.1rem]" />
          Voice add
        </button>
      </div>

      {/* Income sources editor */}
      <IncomeSourcesEditor state={state} onUpdate={onUpdate} monthKey={monthKey} />

      {/* Critical expenses editor */}
      <CriticalExpensesEditor
        state={state}
        onUpdate={onUpdate}
        monthKey={monthKey}
        trips={trips}
      />

      {/* Collapsible setup / Big Wins */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow">
        <button
          type="button"
          onClick={() => setShowSetup((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-share-onBg"
        >
          <span className="flex items-center gap-2">
            <MaterialIcon name="flag" className="text-[1.1rem] text-share-primary" />
            Setup &amp; Big Wins
          </span>
          <MaterialIcon name={showSetup ? 'expand_less' : 'expand_more'} className="text-share-onSurfaceVariant" />
        </button>
        {showSetup && (
          <div className="border-t border-share-outlineVariant/40 p-4">
            <FinanceDashboard state={state} onNavigate={(tab) => onNavigateGroup?.(tab)} />
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Waterfall row primitives ──────────────────────────────────────────────────

function WaterfallRow({
  label,
  amount,
  tone,
}: {
  label: string
  amount: number
  tone: 'income' | 'minus'
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-share-onSurfaceVariant">{label}</span>
      <span className={tone === 'income' ? 'text-share-onBg font-medium' : 'text-share-onSurfaceVariant'}>
        {amount < 0 ? `−${eur(Math.abs(amount))}` : eur(amount)}
      </span>
    </div>
  )
}

function WaterfallDivider({
  label,
  amount,
  bold,
}: {
  label: string
  amount: number
  bold?: boolean
}) {
  const negative = amount < 0
  return (
    <div className="flex items-center justify-between border-t border-share-outlineVariant/40 py-2 mt-0.5">
      <span className={`text-sm ${bold ? 'font-semibold text-share-onBg' : 'font-medium text-share-onBg'}`}>
        {label}
      </span>
      <span
        className={[
          bold ? 'text-base font-bold' : 'text-sm font-semibold',
          negative ? 'text-red-400' : bold ? 'text-emerald-400' : 'text-share-onBg',
        ].join(' ')}
      >
        {negative ? `−${eur(Math.abs(amount))}` : eur(amount)}
      </span>
    </div>
  )
}

// ─── Income sources editor ─────────────────────────────────────────────────────

function IncomeSourcesEditor({
  state,
  onUpdate,
  monthKey,
}: {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
  monthKey: string
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const lines = state.incomeSources?.[monthKey] ?? []
  const total = lines.reduce((s, l) => s + l.amount, 0)

  const add = () => {
    const a = parseFloat(amount)
    if (!label.trim() || isNaN(a) || a === 0) return
    const line: IncomeSource = { id: createId('inc'), label: label.trim(), amount: a }
    onUpdate((prev) => ({
      ...prev,
      incomeSources: {
        ...(prev.incomeSources ?? {}),
        [monthKey]: [...(prev.incomeSources?.[monthKey] ?? []), line],
      },
    }))
    setLabel('')
    setAmount('')
    setAdding(false)
  }

  const remove = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      incomeSources: {
        ...(prev.incomeSources ?? {}),
        [monthKey]: (prev.incomeSources?.[monthKey] ?? []).filter((l) => l.id !== id),
      },
    }))
  }

  return (
    <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-share-onBg flex items-center gap-1.5">
          <MaterialIcon name="payments" className="text-[1rem] text-emerald-400" />
          Income this month
        </h3>
        {lines.length > 0 && (
          <span className="text-xs text-share-onBg font-medium">{eur(total)}</span>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
              <span className="flex-1 min-w-0 truncate text-xs text-share-onBg">{l.label}</span>
              <span className="text-xs font-medium text-emerald-400">{eur(l.amount)}</span>
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
                aria-label="Remove income line"
              >
                <MaterialIcon name="close" className="text-[0.9rem]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Source (e.g. Salary, Gift)"
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
          />
          <AudioInput onTranscript={(t) => setLabel(t)} lang="de-DE" />
          <div className="relative w-24 flex-shrink-0">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="0"
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!label.trim() || !amount}
            className="rounded-lg border border-share-primary bg-share-primary/10 px-3 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-share-onSurfaceVariant hover:text-share-primary transition-colors"
        >
          <MaterialIcon name="add_circle" className="text-[1rem]" />
          Add income line
        </button>
      )}
    </section>
  )
}

// ─── Critical expenses editor ──────────────────────────────────────────────────

function CriticalExpensesEditor({
  state,
  onUpdate,
  monthKey,
  trips,
}: {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
  monthKey: string
  trips: UpcomingTripOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const lines = state.criticalExpenses?.[monthKey] ?? []
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const usedTripIds = new Set(lines.map((l) => l.tripId).filter(Boolean))
  const tripOptions = trips.filter((t) => t.monthKey === monthKey && !usedTripIds.has(t.id))

  const addLine = (line: CriticalExpense) => {
    onUpdate((prev) => ({
      ...prev,
      criticalExpenses: {
        ...(prev.criticalExpenses ?? {}),
        [monthKey]: [...(prev.criticalExpenses?.[monthKey] ?? []), line],
      },
    }))
  }

  const addManual = () => {
    const a = parseFloat(amount)
    if (!label.trim() || isNaN(a) || a <= 0) return
    addLine({ id: createId('crit'), label: label.trim(), amount: a })
    setLabel('')
    setAmount('')
    setAdding(false)
  }

  const addTrip = (trip: UpcomingTripOption) => {
    addLine({
      id: createId('crit'),
      label: `Travel: ${trip.name}`,
      amount: trip.amount,
      date: trip.startDate,
      tripId: trip.id,
    })
  }

  const remove = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      criticalExpenses: {
        ...(prev.criticalExpenses ?? {}),
        [monthKey]: (prev.criticalExpenses?.[monthKey] ?? []).filter((l) => l.id !== id),
      },
    }))
  }

  return (
    <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-share-onBg flex items-center gap-1.5">
          <MaterialIcon name="priority_high" className="text-[1rem] text-amber-400" />
          Critical expenses this month
        </h3>
        {lines.length > 0 && (
          <span className="text-xs text-share-onBg font-medium">{eur(total)}</span>
        )}
      </div>
      <p className="text-[10px] text-share-onSurfaceVariant/60 -mt-1">
        One-off big costs that aren't recurring bills — e.g. a trip, a flight, a deposit.
      </p>

      {lines.length > 0 && (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
              {l.tripId && <MaterialIcon name="flight" className="text-[0.9rem] text-share-primary flex-shrink-0" />}
              <span className="flex-1 min-w-0 truncate text-xs text-share-onBg">{l.label}</span>
              <span className="text-xs font-medium text-amber-400">{eur(l.amount)}</span>
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
                aria-label="Remove critical expense"
              >
                <MaterialIcon name="close" className="text-[0.9rem]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Trip picker */}
      {tripOptions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-share-onSurfaceVariant/70 uppercase tracking-wide">Add a planned trip</p>
          {tripOptions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => addTrip(t)}
              className="w-full flex items-center gap-2 rounded-lg border border-dashed border-share-outlineVariant px-3 py-2 text-left hover:border-share-primary/50 transition-colors"
            >
              <MaterialIcon name="flight" className="text-[1rem] text-share-primary flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-xs text-share-onBg">{t.name}</span>
              <span className="text-xs font-medium text-share-onSurfaceVariant">{eur(t.amount)}</span>
              <MaterialIcon name="add" className="text-[0.9rem] text-share-primary" />
            </button>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManual()}
            placeholder="e.g. Flight to Frankfurt"
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
          />
          <AudioInput onTranscript={(t) => setLabel(t)} lang="de-DE" />
          <div className="relative w-24 flex-shrink-0">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
              placeholder="0"
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addManual}
            disabled={!label.trim() || !amount}
            className="rounded-lg border border-share-primary bg-share-primary/10 px-3 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-share-onSurfaceVariant hover:text-share-primary transition-colors"
        >
          <MaterialIcon name="add_circle" className="text-[1rem]" />
          Add critical expense
        </button>
      )}
    </section>
  )
}
