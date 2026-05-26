/**
 * components/finance/NetWorthTracker.tsx
 *
 * Net worth calculator: assets minus liabilities.
 * Monthly snapshot history with SVG line chart.
 * Pulls from accounts (assets) and debts (liabilities) + allows ad-hoc entries.
 */

import { useState, useMemo } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import type { FinancialState, NetWorthSnapshot } from '../../domain/financialTypes'

function todayIso(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-DE', { month: 'short', year: '2-digit' })
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

interface ChartProps {
  snapshots: NetWorthSnapshot[]
}

function NetWorthChart({ snapshots }: ChartProps) {
  if (snapshots.length < 2) return null

  const W = 600
  const H = 160
  const PAD = { top: 16, right: 16, bottom: 28, left: 56 }

  const values = snapshots.map((s) => s.total)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const range = rawMax - rawMin || 1
  const yMin = rawMin - range * 0.1
  const yMax = rawMax + range * 0.1
  const yRange = yMax - yMin

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const toX = (i: number) => PAD.left + (i / (snapshots.length - 1)) * innerW
  const toY = (v: number) => PAD.top + innerH - ((v - yMin) / yRange) * innerH

  const points = snapshots.map((s, i) => `${toX(i)},${toY(s.total)}`)
  const polyline = points.join(' ')

  // Area fill path
  const areaPath = [
    `M ${toX(0)} ${toY(snapshots[0].total)}`,
    ...snapshots.slice(1).map((s, i) => `L ${toX(i + 1)} ${toY(s.total)}`),
    `L ${toX(snapshots.length - 1)} ${PAD.top + innerH}`,
    `L ${toX(0)} ${PAD.top + innerH}`,
    'Z',
  ].join(' ')

  // Y-axis labels (3 labels)
  const yLabels = [yMin, yMin + yRange / 2, yMax].map((v) => ({
    v,
    label: v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`,
    y: toY(v),
  }))

  // X-axis labels: show first, last, and middle-ish
  const xIndices = [0, Math.floor(snapshots.length / 2), snapshots.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  )

  const isPositive = (snapshots[snapshots.length - 1]?.total ?? 0) >= (snapshots[0]?.total ?? 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="nw-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map(({ y }, i) => (
        <line
          key={i}
          x1={PAD.left}
          y1={y}
          x2={W - PAD.right}
          y2={y}
          stroke="#3d494d"
          strokeWidth="0.5"
          strokeDasharray="3 3"
        />
      ))}

      {/* Y-axis labels */}
      {yLabels.map(({ label, y }, i) => (
        <text
          key={i}
          x={PAD.left - 6}
          y={y}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-share-onSurfaceVariant"
          style={{ fontSize: 9, fill: '#bcc9ce' }}
        >
          {label}
        </text>
      ))}

      {/* X-axis labels */}
      {xIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={H - 4}
          textAnchor="middle"
          style={{ fontSize: 9, fill: '#bcc9ce' }}
        >
          {formatMonth(snapshots[idx].date)}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#nw-area-grad)" />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={isPositive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {snapshots.map((s, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(s.total)}
          r="3"
          fill={isPositive ? '#10b981' : '#ef4444'}
          stroke="#111316"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NetWorthTrackerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface AdHocEntry {
  label: string
  amount: string
}

const EMPTY_ENTRY: AdHocEntry = { label: '', amount: '' }

export function NetWorthTracker({ state, onUpdate }: NetWorthTrackerProps) {
  const [addingAsset, setAddingAsset] = useState(false)
  const [addingLiability, setAddingLiability] = useState(false)
  const [assetForm, setAssetForm] = useState<AdHocEntry>(EMPTY_ENTRY)
  const [liabilityForm, setLiabilityForm] = useState<AdHocEntry>(EMPTY_ENTRY)
  // Local balance overrides for snapshot calculation
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, string>>({})
  const [debtOverrides, setDebtOverrides] = useState<Record<string, string>>({})
  // Ad-hoc entries (not tracked as accounts)
  const [adHocAssets, setAdHocAssets] = useState<Array<{ label: string; amount: number }>>([])
  const [adHocLiabilities, setAdHocLiabilities] = useState<Array<{ label: string; amount: number }>>([])

  const accounts = state.accounts ?? []
  const debts = state.debts ?? []
  const history = useMemo(
    () => [...(state.netWorthHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [state.netWorthHistory],
  )

  // Compute current net worth from account balances + ad-hoc entries
  const assetEntries = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    value: parseFloat(balanceOverrides[a.id] ?? '') || a.balance || 0,
  }))
  const adHocAssetTotal = adHocAssets.reduce((s, e) => s + e.amount, 0)
  const totalAssets = assetEntries.reduce((s, e) => s + e.value, 0) + adHocAssetTotal

  const debtEntries = debts.map((d) => ({
    id: d.id,
    label: d.label,
    value: parseFloat(debtOverrides[d.id] ?? '') || d.balance || 0,
  }))
  const adHocLiabilityTotal = adHocLiabilities.reduce((s, e) => s + e.amount, 0)
  const totalLiabilities = debtEntries.reduce((s, e) => s + e.value, 0) + adHocLiabilityTotal

  const netWorth = totalAssets - totalLiabilities
  const isPositive = netWorth >= 0

  // Last snapshot for comparison
  const lastSnapshot = history.length > 0 ? history[history.length - 1] : null
  const change = lastSnapshot ? netWorth - lastSnapshot.total : null

  const handleSaveSnapshot = () => {
    const assets: Record<string, number> = {}
    for (const e of assetEntries) assets[e.id] = e.value
    for (let i = 0; i < adHocAssets.length; i++) assets[`adhoc-${i}`] = adHocAssets[i].amount

    const liabilities: Record<string, number> = {}
    for (const e of debtEntries) liabilities[e.id] = e.value
    for (let i = 0; i < adHocLiabilities.length; i++) liabilities[`adhoc-${i}`] = adHocLiabilities[i].amount

    const snapshot: NetWorthSnapshot = {
      date: todayIso(),
      assets,
      liabilities,
      total: netWorth,
    }

    onUpdate((prev) => {
      const existing = prev.netWorthHistory ?? []
      // Replace same-month snapshot if exists
      const filtered = existing.filter((s) => s.date !== snapshot.date)
      return { ...prev, netWorthHistory: [...filtered, snapshot] }
    })
  }

  const handleDeleteSnapshot = (date: string) => {
    onUpdate((prev) => ({
      ...prev,
      netWorthHistory: (prev.netWorthHistory ?? []).filter((s) => s.date !== date),
    }))
  }

  const handleAddAdHocAsset = () => {
    const label = assetForm.label.trim()
    const amount = parseFloat(assetForm.amount)
    if (!label || isNaN(amount)) return
    setAdHocAssets((prev) => [...prev, { label, amount }])
    setAssetForm(EMPTY_ENTRY)
    setAddingAsset(false)
  }

  const handleAddAdHocLiability = () => {
    const label = liabilityForm.label.trim()
    const amount = parseFloat(liabilityForm.amount)
    if (!label || isNaN(amount)) return
    setAdHocLiabilities((prev) => [...prev, { label, amount }])
    setLiabilityForm(EMPTY_ENTRY)
    setAddingLiability(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="account_balance_wallet" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Net Worth Tracker</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Assets minus liabilities. This is the single most important financial number. Most people who are shocked by their net worth at 40 simply never measured it at 25. Measure it monthly.
            </p>
          </div>
        </div>
      </section>

      {/* Current net worth display */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <p className="text-xs text-share-onSurfaceVariant mb-2">Current net worth</p>
        <div className="flex items-end gap-3">
          <p className={`text-4xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '' : '-'}€{Math.abs(netWorth).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          {change !== null && (
            <div className="mb-1">
              <span className={`text-xs font-medium flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <MaterialIcon name={change >= 0 ? 'arrow_upward' : 'arrow_downward'} className="text-[0.8rem]" />
                €{Math.abs(change).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                <span className="text-share-onSurfaceVariant/50 font-normal ml-1">vs. last snapshot</span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Total assets</p>
            <p className="text-sm font-semibold text-emerald-400 mt-0.5">
              €{totalAssets.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Total liabilities</p>
            <p className="text-sm font-semibold text-red-400 mt-0.5">
              €{totalLiabilities.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSnapshot}
          className="mt-4 w-full rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2.5 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon name="add_chart" className="text-[1rem]" />
          Save this month's snapshot
        </button>
        <p className="text-[10px] text-share-onSurfaceVariant/50 text-center mt-1">
          Take a snapshot monthly. Update balances below first.
        </p>
      </section>

      {/* Assets section */}
      <section className="rounded-xl border border-emerald-500/20 bg-share-surfaceContainerLow p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-emerald-400">Assets</h3>
          <span className="text-xs font-medium text-emerald-400">
            €{totalAssets.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Account balances */}
        {accounts.length > 0 ? (
          <ul className="space-y-1.5">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
                <span className="flex-1 text-xs text-share-onBg truncate">{account.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-share-onSurfaceVariant">€</span>
                  <input
                    type="number"
                    min="0"
                    value={balanceOverrides[account.id] ?? account.balance?.toString() ?? ''}
                    onChange={(e) => setBalanceOverrides((p) => ({ ...p, [account.id]: e.target.value }))}
                    placeholder={account.balance?.toString() ?? '0'}
                    className="w-24 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-0.5 text-xs text-right text-share-onBg focus:border-share-primary focus:outline-none"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-share-onSurfaceVariant/50 italic">
            Add accounts in the Accounts tab to track them here.
          </p>
        )}

        {/* Ad-hoc assets */}
        {adHocAssets.map((e, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
            <span className="flex-1 text-xs text-share-onBg">{e.label}</span>
            <span className="text-xs font-medium text-emerald-400">€{e.amount.toLocaleString('de-DE')}</span>
            <button
              type="button"
              onClick={() => setAdHocAssets((prev) => prev.filter((_, j) => j !== i))}
              className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
            >
              <MaterialIcon name="close" className="text-[0.9rem]" />
            </button>
          </div>
        ))}

        {addingAsset ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={assetForm.label}
              onChange={(e) => setAssetForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="e.g. Property, Car"
              autoFocus
              className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
            <span className="text-xs text-share-onSurfaceVariant">€</span>
            <input
              type="number"
              min="0"
              value={assetForm.amount}
              onChange={(e) => setAssetForm((p) => ({ ...p, amount: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAdHocAsset()}
              placeholder="0"
              className="w-24 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
            />
            <button type="button" onClick={handleAddAdHocAsset} className="text-xs text-share-primary hover:underline">Add</button>
            <button type="button" onClick={() => setAddingAsset(false)} className="text-xs text-share-onSurfaceVariant/50">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingAsset(true)}
            className="text-xs text-emerald-400/60 hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <MaterialIcon name="add" className="text-[0.9rem]" />
            Add other asset (property, car, cash…)
          </button>
        )}
      </section>

      {/* Liabilities section */}
      <section className="rounded-xl border border-red-500/20 bg-share-surfaceContainerLow p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-red-400">Liabilities</h3>
          <span className="text-xs font-medium text-red-400">
            €{totalLiabilities.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        {debts.length > 0 ? (
          <ul className="space-y-1.5">
            {debts.map((debt) => (
              <li key={debt.id} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
                <span className="flex-1 text-xs text-share-onBg truncate">{debt.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-share-onSurfaceVariant">€</span>
                  <input
                    type="number"
                    min="0"
                    value={debtOverrides[debt.id] ?? debt.balance?.toString() ?? ''}
                    onChange={(e) => setDebtOverrides((p) => ({ ...p, [debt.id]: e.target.value }))}
                    placeholder={debt.balance?.toString() ?? '0'}
                    className="w-24 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-0.5 text-xs text-right text-share-onBg focus:border-share-primary focus:outline-none"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-share-onSurfaceVariant/50 italic">
            Add debts in the Debts tab to track them here.
          </p>
        )}

        {adHocLiabilities.map((e, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
            <span className="flex-1 text-xs text-share-onBg">{e.label}</span>
            <span className="text-xs font-medium text-red-400">€{e.amount.toLocaleString('de-DE')}</span>
            <button
              type="button"
              onClick={() => setAdHocLiabilities((prev) => prev.filter((_, j) => j !== i))}
              className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
            >
              <MaterialIcon name="close" className="text-[0.9rem]" />
            </button>
          </div>
        ))}

        {addingLiability ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={liabilityForm.label}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="e.g. Personal loan"
              autoFocus
              className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
            <span className="text-xs text-share-onSurfaceVariant">€</span>
            <input
              type="number"
              min="0"
              value={liabilityForm.amount}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, amount: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAdHocLiability()}
              placeholder="0"
              className="w-24 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
            />
            <button type="button" onClick={handleAddAdHocLiability} className="text-xs text-share-primary hover:underline">Add</button>
            <button type="button" onClick={() => setAddingLiability(false)} className="text-xs text-share-onSurfaceVariant/50">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingLiability(true)}
            className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <MaterialIcon name="add" className="text-[0.9rem]" />
            Add other liability…
          </button>
        )}
      </section>

      {/* History chart */}
      {history.length > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-share-onBg">Net worth history</h3>
            <span className="text-xs text-share-onSurfaceVariant">{history.length} snapshot{history.length !== 1 ? 's' : ''}</span>
          </div>

          {history.length >= 2 && (
            <div className="mb-4">
              <NetWorthChart snapshots={history} />
            </div>
          )}

          <ul className="space-y-1.5">
            {[...history].reverse().map((snapshot) => {
              const isPos = snapshot.total >= 0
              return (
                <li key={snapshot.date} className="flex items-center gap-3 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
                  <p className="text-xs text-share-onSurfaceVariant w-14 flex-shrink-0">{formatMonth(snapshot.date)}</p>
                  <p className={`flex-1 text-xs font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPos ? '' : '-'}€{Math.abs(snapshot.total).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDeleteSnapshot(snapshot.date)}
                    className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
                    aria-label="Delete snapshot"
                  >
                    <MaterialIcon name="close" className="text-[0.9rem]" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {history.length === 0 && (
        <div className="rounded-xl border border-dashed border-share-outlineVariant p-8 text-center">
          <MaterialIcon name="timeline" className="text-share-onSurfaceVariant/30 text-[2rem] mb-2" />
          <p className="text-xs text-share-onSurfaceVariant/50">
            No snapshots yet. Enter your balances above and click "Save this month's snapshot" to start tracking.
          </p>
        </div>
      )}
    </div>
  )
}
