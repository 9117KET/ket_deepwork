/**
 * components/finance/ExpenseTracker.tsx
 *
 * Monthly expense log with voice quick-add, budget tracking,
 * and category breakdown. Mirrors how users naturally track spending.
 *
 * Voice add: say "I bought coffee for 3 euros" or "Kaufland 38.50"
 * to create transactions without typing.
 */

import { useMemo, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import type {
  FinancialState,
  FinanceTransaction,
  CSPBucket,
  TransactionsByMonth,
} from '../../domain/financialTypes'
import { CSP_TARGETS } from '../../domain/financialTypes'

function createId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-DE', {
    month: 'long',
    year: 'numeric',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Parse a voice/text description into label + amount. */
function parseVoiceInput(text: string): { label: string; amount: number | null } {
  // Patterns: "spent 5.99", "5.99 euros", "coffee 3", "Kaufland 38.50"
  const amountPatterns = [
    /(\d+[.,]\d{1,2})\s*(?:euros?|eur|€)/i,
    /(?:euros?|eur|€)\s*(\d+[.,]\d{1,2})/i,
    /(\d+[.,]\d{1,2})\s*$/,
    /\s(\d+)\s*$/,
    /^(\d+[.,]?\d*)/,
  ]
  let amount: number | null = null
  let label = text.trim()

  for (const pattern of amountPatterns) {
    const match = text.match(pattern)
    if (match) {
      const raw = match[1].replace(',', '.')
      amount = parseFloat(raw)
      if (!isNaN(amount)) {
        // Remove the matched amount from label
        label = text.replace(match[0], '').trim()
        label = label.replace(/^(for|at|on|in|to|i bought|i spent|spent|bought|paid)\s*/i, '').trim()
        label = label.replace(/\s+(euros?|eur|€)\s*/i, '').trim()
        if (!label) label = 'Expense'
        break
      }
    }
  }

  return { label: label || 'Expense', amount }
}

const BUCKET_COLORS: Record<CSPBucket, string> = {
  fixed:      'text-blue-400',
  investment: 'text-emerald-400',
  savings:    'text-violet-400',
  guiltFree:  'text-amber-400',
}

const BUCKET_BG: Record<CSPBucket, string> = {
  fixed:      'bg-blue-400/10',
  investment: 'bg-emerald-400/10',
  savings:    'bg-violet-400/10',
  guiltFree:  'bg-amber-400/10',
}

interface ExpenseTrackerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface NewTxForm {
  label: string
  amount: string
  date: string
  bucket: CSPBucket
  category: string
}

const EMPTY_FORM: NewTxForm = {
  label: '',
  amount: '',
  date: todayIso(),
  bucket: 'guiltFree',
  category: '',
}

export function ExpenseTracker({ state, onUpdate }: ExpenseTrackerProps) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [addingTx, setAddingTx] = useState(false)
  const [form, setForm] = useState<NewTxForm>(EMPTY_FORM)
  const [voiceInput, setVoiceInput] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)

  const allTx: TransactionsByMonth = state.transactions ?? {}
  const monthTx = useMemo(
    () => [...(allTx[selectedMonth] ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [allTx, selectedMonth],
  )

  // Available months (current + past months with data)
  const availableMonths = useMemo(() => {
    const keys = new Set([currentMonthKey(), ...Object.keys(allTx)])
    return [...keys].sort().reverse()
  }, [allTx])

  // Budget from CSP
  const income = state.csp?.monthlyNetIncome ?? 0
  const bucketBudgets: Record<CSPBucket, number> = {
    fixed:      (state.csp?.expenses ?? []).filter(e => e.bucket === 'fixed').reduce((s, e) => s + e.monthlyAmount, 0),
    investment: (state.csp?.expenses ?? []).filter(e => e.bucket === 'investment').reduce((s, e) => s + e.monthlyAmount, 0),
    savings:    (state.csp?.expenses ?? []).filter(e => e.bucket === 'savings').reduce((s, e) => s + e.monthlyAmount, 0),
    guiltFree:  (state.csp?.expenses ?? []).filter(e => e.bucket === 'guiltFree').reduce((s, e) => s + e.monthlyAmount, 0),
  }

  // Actual spending per bucket this month
  const bucketActual: Record<CSPBucket, number> = {
    fixed: 0, investment: 0, savings: 0, guiltFree: 0,
  }
  for (const tx of monthTx) {
    bucketActual[tx.bucket] = (bucketActual[tx.bucket] ?? 0) + tx.amount
  }
  const totalSpent = monthTx.reduce((s, t) => s + t.amount, 0)

  // Warnings
  const warnings = (Object.keys(CSP_TARGETS) as CSPBucket[]).filter(
    (b) => bucketBudgets[b] > 0 && bucketActual[b] > bucketBudgets[b],
  )

  const handleAddTx = () => {
    const amount = parseFloat(form.amount)
    const label = form.label.trim()
    if (!label || isNaN(amount) || amount <= 0) return

    const tx: FinanceTransaction = {
      id: createId(),
      date: form.date,
      label,
      amount,
      bucket: form.bucket,
      category: form.category || undefined,
      method: 'manual',
    }
    saveTransaction(tx)
    setForm(EMPTY_FORM)
    setAddingTx(false)
  }

  const handleVoiceAdd = () => {
    const { label, amount } = parseVoiceInput(voiceInput)
    if (!amount || amount <= 0) return

    const tx: FinanceTransaction = {
      id: createId(),
      date: todayIso(),
      label,
      amount,
      bucket: 'guiltFree',
      method: 'voice',
    }
    saveTransaction(tx)
    setVoiceInput('')
    setVoiceMode(false)
  }

  const handleVoiceTranscript = (text: string) => {
    setVoiceInput(text)
    // Auto-parse and add immediately if we got a clear amount
    const { label, amount } = parseVoiceInput(text)
    if (amount && amount > 0) {
      const tx: FinanceTransaction = {
        id: createId(),
        date: todayIso(),
        label,
        amount,
        bucket: 'guiltFree',
        method: 'voice',
      }
      saveTransaction(tx)
      setVoiceInput('')
      setVoiceMode(false)
    }
  }

  const saveTransaction = (tx: FinanceTransaction) => {
    const month = tx.date.slice(0, 7)
    onUpdate((prev) => ({
      ...prev,
      transactions: {
        ...(prev.transactions ?? {}),
        [month]: [...(prev.transactions?.[month] ?? []), tx],
      },
    }))
  }

  const handleDeleteTx = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      transactions: {
        ...(prev.transactions ?? {}),
        [selectedMonth]: (prev.transactions?.[selectedMonth] ?? []).filter((t) => t.id !== id),
      },
    }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MaterialIcon name="receipt_long" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-share-onBg">Expense Tracker</h2>
              <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
                Log expenses by typing or speaking. The system tracks your spending per budget bucket and warns you when you're approaching your limits.
              </p>
            </div>
          </div>
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-share-primary focus:outline-none flex-shrink-0"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>{formatMonthKey(m)}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Budget overview */}
      {income > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-share-onBg">
              {formatMonthKey(selectedMonth)} overview
            </h3>
            {income > 0 && (
              <span className="text-xs text-share-onSurfaceVariant">
                Income: <span className="text-share-onBg font-medium">€{income.toLocaleString('de-DE')}</span>
              </span>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1">
              {warnings.map((b) => (
                <div key={b} className="flex items-center gap-2 text-xs text-red-400">
                  <MaterialIcon name="warning" className="text-[0.9rem] flex-shrink-0" />
                  <span>
                    {CSP_TARGETS[b].label} over budget: €{bucketActual[b].toFixed(0)} spent vs €{bucketBudgets[b].toFixed(0)} budgeted
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bucket bars */}
          <div className="space-y-3">
            {(Object.entries(CSP_TARGETS) as [CSPBucket, typeof CSP_TARGETS[CSPBucket]][]).map(([bucket, cfg]) => {
              const budget = bucketBudgets[bucket]
              const actual = bucketActual[bucket]
              const pct = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0
              const over = actual > budget && budget > 0
              if (budget === 0 && actual === 0) return null
              return (
                <div key={bucket}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-share-onSurfaceVariant">{cfg.label}</span>
                    <span className={over ? 'text-red-400 font-medium' : 'text-share-onBg'}>
                      €{actual.toFixed(0)}
                      {budget > 0 && <span className="text-share-onSurfaceVariant/50"> / €{budget.toFixed(0)}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : BUCKET_BG[bucket].replace('/10', '').replace('bg-', 'bg-').replace('text-', 'bg-')} ${bucket === 'fixed' ? 'bg-blue-400' : bucket === 'investment' ? 'bg-emerald-400' : bucket === 'savings' ? 'bg-violet-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between text-xs border-t border-share-outlineVariant/30 pt-2">
            <span className="text-share-onSurfaceVariant">Total spent this month</span>
            <span className="font-semibold text-share-onBg">€{totalSpent.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </div>
        </section>
      )}

      {/* Voice quick-add */}
      {voiceMode ? (
        <section className="rounded-xl border border-share-primary/30 bg-share-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="mic" filled className="text-share-primary text-[1.2rem]" />
            <p className="text-xs font-semibold text-share-onBg">Voice add</p>
            <button type="button" onClick={() => setVoiceMode(false)} className="ml-auto text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant">
              <MaterialIcon name="close" className="text-[1rem]" />
            </button>
          </div>
          <p className="text-[10px] text-share-onSurfaceVariant/70">
            Say something like: "Coffee 3 euros", "Kaufland 38.50", "I spent 22 on haircut"
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voiceInput}
              onChange={(e) => setVoiceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVoiceAdd()}
              placeholder="Type or tap mic..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
            />
            <AudioInput onTranscript={handleVoiceTranscript} lang="en-US" />
            <button
              type="button"
              onClick={handleVoiceAdd}
              disabled={!voiceInput.trim()}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-3 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
          {voiceInput && (() => {
            const { label, amount } = parseVoiceInput(voiceInput)
            return amount ? (
              <p className="text-[10px] text-emerald-400">
                Parsed: "{label}" for €{amount.toFixed(2)}
              </p>
            ) : (
              <p className="text-[10px] text-amber-400">Could not detect an amount. Include a number like "38.50".</p>
            )
          })()}
        </section>
      ) : null}

      {/* Add buttons */}
      {!addingTx && !voiceMode && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVoiceMode(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="mic" className="text-[1rem]" />
            Voice add
          </button>
          <button
            type="button"
            onClick={() => { setAddingTx(true); setForm(EMPTY_FORM) }}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="add_circle" className="text-[1rem]" />
            Manual entry
          </button>
        </div>
      )}

      {/* Manual add form */}
      {addingTx && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
          <p className="text-xs font-semibold text-share-onBg">Add expense</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Description</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTx()}
                placeholder="e.g. Kaufland, Coffee, Gym"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Amount (EUR)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTx()}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-6 pr-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-share-primary focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-share-onSurfaceVariant mb-1.5">Bucket</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(CSP_TARGETS) as [CSPBucket, typeof CSP_TARGETS[CSPBucket]][]).map(([bucket, cfg]) => (
                  <button
                    key={bucket}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, bucket }))}
                    className={[
                      'rounded-lg border py-2 text-xs font-medium transition-colors',
                      form.bucket === bucket
                        ? `${BUCKET_BG[bucket]} ${BUCKET_COLORS[bucket]} border-current`
                        : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg',
                    ].join(' ')}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddTx}
              disabled={!form.label.trim() || !form.amount}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setAddingTx(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Transaction list */}
      {monthTx.length > 0 ? (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-2">
          <p className="text-xs font-semibold text-share-onBg">
            {monthTx.length} transaction{monthTx.length !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-1.5">
            {monthTx.map((tx) => (
              <li key={tx.id} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  tx.bucket === 'fixed' ? 'bg-blue-400' :
                  tx.bucket === 'investment' ? 'bg-emerald-400' :
                  tx.bucket === 'savings' ? 'bg-violet-400' : 'bg-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-share-onBg truncate">{tx.label}</p>
                  <p className="text-[10px] text-share-onSurfaceVariant/60">
                    {new Date(tx.date).toLocaleDateString('en-DE', { day: 'numeric', month: 'short' })}
                    {tx.method !== 'manual' && (
                      <span className="ml-1.5">
                        <MaterialIcon name={tx.method === 'voice' ? 'mic' : 'document_scanner'} className="text-[0.7rem] inline" />
                      </span>
                    )}
                  </p>
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${BUCKET_COLORS[tx.bucket]}`}>
                  €{tx.amount.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteTx(tx.id)}
                  className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label="Delete transaction"
                >
                  <MaterialIcon name="close" className="text-[0.9rem]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-share-outlineVariant p-8 text-center">
          <MaterialIcon name="receipt_long" className="text-share-onSurfaceVariant/20 text-[2rem] mb-2" />
          <p className="text-xs text-share-onSurfaceVariant/50">
            No expenses logged for {formatMonthKey(selectedMonth)} yet.
          </p>
          <p className="text-[10px] text-share-onSurfaceVariant/40 mt-1">
            Use "Voice add" for fastest entry - just say what you bought and the amount.
          </p>
        </div>
      )}
    </div>
  )
}
