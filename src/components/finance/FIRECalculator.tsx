/**
 * components/finance/FIRECalculator.tsx
 *
 * German-adjusted FIRE (Financial Independence, Retire Early) calculator.
 *
 * Key German adjustments vs. standard US FIRE:
 * - Default SWR 3.5% (not 4%) — longer retirement horizon + Abgeltungssteuer drag
 * - Abgeltungssteuer on withdrawals: ~15.8% effective rate on gains portion
 * - Rentenversicherung (statutory pension) offsets required withdrawal
 * - GKV minimum cost in early retirement (~€215/month) flagged
 * - All values in real (inflation-adjusted) terms using real return rate
 */

import { useMemo, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, FIRESettings } from '../../domain/financialTypes'

// ─── Constants ────────────────────────────────────────────────────────────────

const ABGELTUNGSSTEUER = 0.26375
const GAINS_PROPORTION = 0.6      // Rough: 60% of withdrawal is gains
const EFFECTIVE_TAX_ON_WITHDRAWAL = GAINS_PROPORTION * ABGELTUNGSSTEUER // ≈ 15.83%
const GKV_MIN_MONTHLY = 215       // Approximate minimum GKV in early retirement (2025)

// ─── Calculation ──────────────────────────────────────────────────────────────

interface FIREResult {
  fireNumber: number
  annualExpensesGross: number
  annualFromPortfolio: number
  yearsToFIRE: number | null
  ageAtFIRE: number | null
  portfolioAtFIRE: number | null
  dataPoints: { year: number; portfolio: number; age: number }[]
  realReturnPct: number
}

function calculateFIRE(settings: FIRESettings, monthlyInvestmentAmount: number): FIREResult {
  const currentAge = settings.currentAge ?? 30
  const currentPortfolio = settings.currentPortfolioValue ?? 0
  const monthlyExpenses = settings.monthlyExpensesInRetirement ?? 2000
  const nominalReturn = (settings.expectedAnnualReturnPct ?? 7) / 100
  const inflation = (settings.inflationPct ?? 2.5) / 100
  const swr = (settings.swrPct ?? 3.5) / 100
  const monthlyRente = settings.includeRente ? (settings.expectedRenteMonthly ?? 0) : 0

  // Real return (removes inflation, works in today's euros)
  const realReturn = (1 + nominalReturn) / (1 + inflation) - 1

  // Annual expenses in retirement (today's euros)
  const annualExpenses = monthlyExpenses * 12
  const annualRente = monthlyRente * 12
  // How much needs to come from the portfolio (after Rente offsets some)
  const annualFromPortfolio = Math.max(0, annualExpenses - annualRente)

  // Gross withdrawal needed (pre-Abgeltungssteuer)
  // We need to deliver annualFromPortfolio net; assume EFFECTIVE_TAX_ON_WITHDRAWAL
  const annualGrossWithdrawal = annualFromPortfolio / (1 - EFFECTIVE_TAX_ON_WITHDRAWAL)

  // FIRE number: portfolio size required to sustain annualGrossWithdrawal at SWR
  const fireNumber = annualGrossWithdrawal / swr

  // Year-by-year simulation (up to 60 years or FIRE + 10 years)
  const annualSavings = monthlyInvestmentAmount * 12
  const dataPoints: FIREResult['dataPoints'] = []
  let portfolio = currentPortfolio
  let yearsToFIRE: number | null = null
  let portfolioAtFIRE: number | null = null
  const MAX_YEARS = 60

  for (let year = 0; year <= MAX_YEARS; year++) {
    dataPoints.push({ year, portfolio, age: currentAge + year })
    if (yearsToFIRE === null && portfolio >= fireNumber) {
      yearsToFIRE = year
      portfolioAtFIRE = portfolio
    }
    // Stop simulating well past FIRE to keep the chart readable
    if (yearsToFIRE !== null && year > yearsToFIRE + 5) break
    portfolio = portfolio * (1 + realReturn) + annualSavings
  }

  return {
    fireNumber,
    annualExpensesGross: annualGrossWithdrawal,
    annualFromPortfolio,
    yearsToFIRE,
    ageAtFIRE: yearsToFIRE != null ? currentAge + yearsToFIRE : null,
    portfolioAtFIRE,
    dataPoints,
    realReturnPct: realReturn * 100,
  }
}

// ─── SVG Timeline Chart ───────────────────────────────────────────────────────

function FIREChart({ result, fireNumber }: { result: FIREResult; fireNumber: number }) {
  const { dataPoints } = result
  if (dataPoints.length < 2) return null

  const W = 600
  const H = 200
  const PAD = { top: 20, right: 16, bottom: 32, left: 64 }

  const values = dataPoints.map((d) => d.portfolio)
  const rawMax = Math.max(...values, fireNumber) * 1.05

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const toX = (i: number) => PAD.left + (i / (dataPoints.length - 1)) * innerW
  const toY = (v: number) => PAD.top + innerH - (v / rawMax) * innerH

  const polyline = dataPoints.map((d, i) => `${toX(i)},${toY(d.portfolio)}`).join(' ')

  const areaPath = [
    `M ${toX(0)} ${toY(dataPoints[0].portfolio)}`,
    ...dataPoints.slice(1).map((d, i) => `L ${toX(i + 1)} ${toY(d.portfolio)}`),
    `L ${toX(dataPoints.length - 1)} ${PAD.top + innerH}`,
    `L ${toX(0)} ${PAD.top + innerH}`,
    'Z',
  ].join(' ')

  // FIRE number Y position
  const fireY = toY(fireNumber)
  const fireLineInBounds = fireY >= PAD.top && fireY <= PAD.top + innerH

  // FIRE intersection X (interpolated)
  let fireX: number | null = null
  if (result.yearsToFIRE != null) {
    const idx = result.yearsToFIRE
    if (idx < dataPoints.length) {
      fireX = toX(idx)
    }
  }

  // Y-axis labels
  const ySteps = 4
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const v = (rawMax / ySteps) * i
    return {
      v,
      label: v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`,
      y: toY(v),
    }
  })

  // X-axis age labels
  const xLabelCount = Math.min(5, dataPoints.length)
  const xStep = Math.floor((dataPoints.length - 1) / (xLabelCount - 1))
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx = Math.min(i * xStep, dataPoints.length - 1)
    return { idx, age: dataPoints[idx].age, x: toX(idx) }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="fire-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00daf3" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00daf3" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="fire-area-grad-done" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map(({ y }, i) => (
        <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
          stroke="#3d494d" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}

      {/* Y-axis labels */}
      {yLabels.map(({ label, y }, i) => (
        <text key={i} x={PAD.left - 6} y={y} textAnchor="end" dominantBaseline="middle"
          style={{ fontSize: 9, fill: '#bcc9ce' }}>
          {label}
        </text>
      ))}

      {/* X-axis age labels */}
      {xLabels.map(({ age, x }, i) => (
        <text key={i} x={x} y={H - 4} textAnchor="middle"
          style={{ fontSize: 9, fill: '#bcc9ce' }}>
          Age {age}
        </text>
      ))}

      {/* FIRE number dashed line */}
      {fireLineInBounds && (
        <>
          <line x1={PAD.left} y1={fireY} x2={W - PAD.right} y2={fireY}
            stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />
          <text x={W - PAD.right + 2} y={fireY} dominantBaseline="middle"
            style={{ fontSize: 8, fill: '#10b981', fontWeight: 600 }}>
            FIRE
          </text>
        </>
      )}

      {/* Area fill */}
      <path d={areaPath} fill={result.yearsToFIRE != null ? 'url(#fire-area-grad-done)' : 'url(#fire-area-grad)'} />

      {/* Portfolio growth line */}
      <polyline points={polyline} fill="none"
        stroke={result.yearsToFIRE != null ? '#10b981' : '#00daf3'}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* FIRE intersection point */}
      {fireX != null && fireLineInBounds && (
        <>
          <circle cx={fireX} cy={fireY} r="5"
            fill="#10b981" stroke="#111316" strokeWidth="2" />
          <text x={fireX} y={fireY - 10} textAnchor="middle"
            style={{ fontSize: 9, fill: '#10b981', fontWeight: 700 }}>
            FIRE
          </text>
        </>
      )}
    </svg>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────

function InputRow({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  min,
  step,
  helpText,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  min?: number
  step?: number
  helpText?: string
}) {
  return (
    <div>
      <label className="block text-xs text-share-onSurfaceVariant mb-1">{label}</label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min ?? 0}
          step={step ?? 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={[
            'w-full rounded-lg border border-slate-700 bg-slate-950 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none',
            prefix ? 'pl-7 pr-3' : 'pl-3',
            suffix ? 'pr-8' : 'pr-3',
          ].join(' ')}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="text-[10px] text-share-onSurfaceVariant/50 mt-0.5">{helpText}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FIRECalculatorProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function FIRECalculator({ state, onUpdate }: FIRECalculatorProps) {
  const fire = state.fireSettings ?? {}

  // Monthly investment from CSP
  const cspInvestmentMonthly = (state.csp?.expenses ?? [])
    .filter((e) => e.bucket === 'investment')
    .reduce((s, e) => s + e.monthlyAmount, 0)

  // Local form state (strings for controlled inputs)
  const [inputs, setInputs] = useState({
    currentAge: String(fire.currentAge ?? ''),
    targetAge: String(fire.targetRetirementAge ?? ''),
    currentPortfolio: String(fire.currentPortfolioValue ?? ''),
    monthlyExpenses: String(fire.monthlyExpensesInRetirement ?? ''),
    monthlySavings: String(cspInvestmentMonthly || ''),
    expectedReturn: String(fire.expectedAnnualReturnPct ?? 7),
    inflation: String(fire.inflationPct ?? 2.5),
    swr: String(fire.swrPct ?? 3.5),
    expectedRente: String(fire.expectedRenteMonthly ?? ''),
    includeRente: fire.includeRente ?? true,
  })

  const updateInput = (key: InputKey, val: string | boolean) => {
    setInputs((p) => ({ ...p, [key]: val }))
  }

  // Persist settings back to state (debounced via normal React flow)
  const handleSave = () => {
    const parsed: FIRESettings = {
      currentAge: inputs.currentAge ? Number(inputs.currentAge) : undefined,
      targetRetirementAge: inputs.targetAge ? Number(inputs.targetAge) : undefined,
      currentPortfolioValue: inputs.currentPortfolio ? Number(inputs.currentPortfolio) : undefined,
      monthlyExpensesInRetirement: inputs.monthlyExpenses ? Number(inputs.monthlyExpenses) : undefined,
      expectedAnnualReturnPct: Number(inputs.expectedReturn) || 7,
      inflationPct: Number(inputs.inflation) || 2.5,
      swrPct: Number(inputs.swr) || 3.5,
      expectedRenteMonthly: inputs.expectedRente ? Number(inputs.expectedRente) : undefined,
      includeRente: inputs.includeRente as boolean,
    }
    onUpdate((prev) => ({ ...prev, fireSettings: parsed }))
  }

  // Compute result live from inputs
  const result = useMemo(() => {
    const settings: FIRESettings = {
      currentAge: Number(inputs.currentAge) || 30,
      currentPortfolioValue: Number(inputs.currentPortfolio) || 0,
      monthlyExpensesInRetirement: Number(inputs.monthlyExpenses) || 2000,
      expectedAnnualReturnPct: Number(inputs.expectedReturn) || 7,
      inflationPct: Number(inputs.inflation) || 2.5,
      swrPct: Number(inputs.swr) || 3.5,
      expectedRenteMonthly: inputs.includeRente ? Number(inputs.expectedRente) || 0 : 0,
      includeRente: inputs.includeRente as boolean,
    }
    const monthlySavings = Number(inputs.monthlySavings) || 0
    return calculateFIRE(settings, monthlySavings)
  }, [inputs])

  const progressPct = result.fireNumber > 0
    ? Math.min(100, Math.round(((Number(inputs.currentPortfolio) || 0) / result.fireNumber) * 100))
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="local_fire_department" filled className="text-orange-400 text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">
              <FinanceTerm termId="fire" label="FIRE Calculator" /> - German Edition
            </h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Uses real returns (inflation-adjusted), a conservative <FinanceTerm termId="swr" label="SWR of 3.5%" /> for Germany, and accounts for <FinanceTerm termId="abgeltungssteuer" label="Abgeltungssteuer" /> on portfolio withdrawals. All values in today's euros.
            </p>
          </div>
        </div>
      </section>

      {/* FIRE number + progress */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-share-onSurfaceVariant">Your FIRE number</p>
            <p className="text-3xl font-bold text-share-onBg mt-0.5">
              €{result.fireNumber > 0
                ? result.fireNumber.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                : '—'}
            </p>
            <p className="text-[10px] text-share-onSurfaceVariant/60 mt-0.5">
              Gross portfolio needed at {inputs.swr}% SWR, after Abgeltungssteuer adjustment
            </p>
          </div>
          {result.yearsToFIRE != null ? (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-share-onSurfaceVariant">FIRE in</p>
              <p className="text-2xl font-bold text-emerald-400">{result.yearsToFIRE}yr</p>
              <p className="text-[10px] text-share-onSurfaceVariant/60">Age {result.ageAtFIRE}</p>
            </div>
          ) : (
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-amber-400 max-w-[120px]">Increase savings rate or return assumption to reach FIRE within 60 years</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-share-onSurfaceVariant">Progress to FIRE</span>
            <span className={`font-medium ${progressPct >= 100 ? 'text-emerald-400' : 'text-share-primary'}`}>
              {progressPct}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-share-primary'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Key numbers grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-2.5">
            <p className="text-share-onSurfaceVariant text-[10px]">Annual withdrawal (gross)</p>
            <p className="font-semibold text-share-onBg mt-0.5">
              €{result.annualExpensesGross.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/yr
            </p>
          </div>
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-2.5">
            <p className="text-share-onSurfaceVariant text-[10px]">After Rente, from portfolio</p>
            <p className="font-semibold text-share-onBg mt-0.5">
              €{result.annualFromPortfolio.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/yr
            </p>
          </div>
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-2.5">
            <p className="text-share-onSurfaceVariant text-[10px]">Real return rate</p>
            <p className="font-semibold text-share-onBg mt-0.5">{result.realReturnPct.toFixed(2)}%/yr</p>
          </div>
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-2.5">
            <p className="text-share-onSurfaceVariant text-[10px]">Tax drag on withdrawals</p>
            <p className="font-semibold text-amber-400 mt-0.5">~{(EFFECTIVE_TAX_ON_WITHDRAWAL * 100).toFixed(1)}%</p>
          </div>
        </div>
      </section>

      {/* Timeline chart */}
      {result.dataPoints.length >= 2 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <p className="text-xs font-semibold text-share-onBg mb-3">Portfolio growth timeline (real terms)</p>
          <FIREChart result={result} fireNumber={result.fireNumber} />
          <p className="text-[10px] text-share-onSurfaceVariant/50 mt-2 text-center">
            Values in today's euros · Real return {result.realReturnPct.toFixed(2)}% · FIRE line = required portfolio
          </p>
        </section>
      )}

      {/* Inputs */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
        <p className="text-xs font-semibold text-share-onBg">Calculator inputs</p>

        <div className="grid grid-cols-2 gap-3">
          <InputRow label="Current age" value={inputs.currentAge} onChange={(v) => updateInput('currentAge', v)}
            placeholder="30" min={18} />
          <InputRow label="Target retirement age" value={inputs.targetAge} onChange={(v) => updateInput('targetAge', v)}
            placeholder="45" min={18} helpText="For reference only - FIRE happens when portfolio hits the number." />
          <InputRow label="Current portfolio value" value={inputs.currentPortfolio}
            onChange={(v) => updateInput('currentPortfolio', v)} prefix="€" placeholder="50000"
            helpText="ETF depot + other investments" />
          <InputRow label="Monthly savings / investment" value={inputs.monthlySavings}
            onChange={(v) => updateInput('monthlySavings', v)} prefix="€" placeholder={String(cspInvestmentMonthly || 500)}
            helpText={cspInvestmentMonthly > 0 ? `Auto-filled from your CSP: €${cspInvestmentMonthly}` : ''} />
          <InputRow label="Monthly expenses in retirement" value={inputs.monthlyExpenses}
            onChange={(v) => updateInput('monthlyExpenses', v)} prefix="€" placeholder="2500"
            helpText="In today's euros - includes GKV minimum ~€215/month" />
        </div>

        {/* Advanced settings (collapsible) */}
        <AdvancedSettings inputs={inputs} updateInput={updateInput} />

        {/* Rente toggle */}
        <div className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-share-onBg">Include <FinanceTerm termId="rentenversicherung" label="Rentenversicherung" /></p>
              <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5">
                Statutory pension offsets required portfolio withdrawals
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateInput('includeRente', !inputs.includeRente)}
              className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${inputs.includeRente ? 'bg-share-primary' : 'bg-share-surfaceContainerHighest'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${inputs.includeRente ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          {inputs.includeRente && (
            <InputRow label="Expected monthly Rente (today's euros)" value={inputs.expectedRente}
              onChange={(v) => updateInput('expectedRente', v)} prefix="€" placeholder="1400"
              helpText="From your Renteninformation (annual letter from Deutsche Rentenversicherung)" />
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2.5 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors"
        >
          Save settings
        </button>
      </section>

      {/* German FIRE caveats */}
      <section className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-5 space-y-3">
        <p className="text-xs font-semibold text-share-onBg">German FIRE - key considerations</p>
        <ul className="space-y-2">
          {[
            {
              icon: 'health_and_safety',
              title: 'GKV minimum cost',
              text: `In early retirement with low income, expect ~€${GKV_MIN_MONTHLY}/month minimum GKV contribution (freiwillige Versicherung). Budget this into your monthly expenses.`,
            },
            {
              icon: 'receipt_long',
              title: 'Abgeltungssteuer on withdrawals',
              text: `~${(EFFECTIVE_TAX_ON_WITHDRAWAL * 100).toFixed(1)}% effective tax on gains portion of each withdrawal (assumes ${Math.round(GAINS_PROPORTION * 100)}% of withdrawal is gains). Use Günstigerprüfung if total income stays below the Grundfreibetrag.`,
            },
            {
              icon: 'savings',
              title: 'Günstigerprüfung opportunity',
              text: 'If your total income in retirement is low, you may pay 0-15% on capital gains instead of 26.375%. This can save thousands per year.',
            },
            {
              icon: 'event',
              title: '3.5% SWR vs 4%',
              text: 'The standard 4% rule is calibrated for 30-year retirements. For German FIRE with 40-50 year horizons, 3.5% is more conservative and appropriate.',
            },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-2.5">
              <MaterialIcon name={item.icon} className="text-share-onSurfaceVariant/50 flex-shrink-0 mt-0.5 text-[1rem]" />
              <div>
                <p className="text-xs font-medium text-share-onBg">{item.title}</p>
                <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5 leading-relaxed">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─── Advanced settings (collapsible) ─────────────────────────────────────────

type InputKey = 'currentAge' | 'targetAge' | 'currentPortfolio' | 'monthlyExpenses' | 'monthlySavings' | 'expectedReturn' | 'inflation' | 'swr' | 'expectedRente' | 'includeRente'

function AdvancedSettings({
  inputs,
  updateInput,
}: {
  inputs: { expectedReturn: string; inflation: string; swr: string }
  updateInput: (key: InputKey, val: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5"
      >
        <span className="text-xs font-medium text-share-onSurfaceVariant">Advanced assumptions</span>
        <MaterialIcon name={open ? 'expand_less' : 'expand_more'} className="text-share-onSurfaceVariant/50" />
      </button>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-share-outlineVariant pt-2">
          <InputRow
            label="Expected return (%/yr)"
            value={inputs.expectedReturn}
            onChange={(v) => updateInput('expectedReturn', v)}
            suffix="%" min={0} step={0.5}
            helpText="MSCI World historical: ~7% nominal"
          />
          <InputRow
            label="Inflation (%/yr)"
            value={inputs.inflation}
            onChange={(v) => updateInput('inflation', v)}
            suffix="%" min={0} step={0.1}
            helpText="ECB target: 2%"
          />
          <InputRow
            label="Safe Withdrawal Rate (%)"
            value={inputs.swr}
            onChange={(v) => updateInput('swr', v)}
            suffix="%" min={1} step={0.1}
            helpText="3.5% recommended for Germany"
          />
        </div>
      )}
    </div>
  )
}
