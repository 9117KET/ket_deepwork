/**
 * components/finance/TaxDashboard.tsx
 *
 * German investment tax dashboard:
 * - Freistellungsauftrag tracker (€1,000 / €2,000 allowance)
 * - Vorabpauschale calculator (annual pre-tax on accumulating ETFs)
 * - Günstigerprüfung alert (when personal rate < 26.375%)
 */

import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, TaxSettings } from '../../domain/financialTypes'

interface TaxDashboardProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

const KIRCHENSTEUER_RATE = 0.09   // 9% of 25% base = 2.25% extra (Bayern/BW: 8%)
const ABGELTUNGSSTEUER = 0.26375  // 25% + 5.5% Soli
const ABGELTUNGSSTEUER_KST = ABGELTUNGSSTEUER + 0.25 * KIRCHENSTEUER_RATE
const TEILFREISTELLUNG = 0.30     // 30% of equity ETF income is tax-free
const GRUNDFREIBETRAG_2025 = 12096 // Annual income tax-free allowance

function updateTax(
  _state: FinancialState,
  patch: Partial<TaxSettings>,
  onUpdate: (u: (p: FinancialState) => FinancialState) => void,
) {
  onUpdate((prev) => ({
    ...prev,
    taxSettings: { ...(prev.taxSettings ?? defaultTax(prev.isMarried ?? false)), ...patch },
  }))
}

function defaultTax(married: boolean): TaxSettings {
  return {
    freistellungsauftragTotal: married ? 2000 : 1000,
    freistellungsauftragAllocated: 0,
    basiszins: 2.53,
    kirchensteuer: false,
  }
}

export function TaxDashboard({ state, onUpdate }: TaxDashboardProps) {
  const tax = state.taxSettings ?? defaultTax(state.isMarried ?? false)
  const taxRate = tax.kirchensteuer ? ABGELTUNGSSTEUER_KST : ABGELTUNGSSTEUER

  // ── Freistellungsauftrag ──────────────────────────────────────────────────

  const fsaTotal = tax.freistellungsauftragTotal
  const fsaAllocated = Math.min(tax.freistellungsauftragAllocated, fsaTotal)
  const fsaUnallocated = fsaTotal - fsaAllocated
  const savingsIfUsedFully = fsaTotal * taxRate

  // ── Vorabpauschale ────────────────────────────────────────────────────────

  // Compute from ETF portfolio (accumulating only)
  const accumulatingValue = (state.portfolio ?? [])
    .filter((h) => h.type === 'accumulating')
    .reduce((s, h) => s + (h.currentPriceEur != null ? h.shares * h.currentPriceEur : 0), 0)

  // Basisertrag = portfolio value × 70% × Basiszins
  const basisertrag = accumulatingValue * 0.70 * (tax.basiszins / 100)
  // Taxable portion (after 30% Teilfreistellung for equity ETFs)
  const taxablePortion = basisertrag * (1 - TEILFREISTELLUNG)
  const vorabpauschaleRaw = taxablePortion * taxRate
  // Offset with any remaining Freistellungsauftrag capacity
  const fsaRemaining = Math.max(0, fsaUnallocated)
  const vorabpauschaleTax = Math.max(0, vorabpauschaleRaw - (fsaRemaining > 0 ? fsaRemaining * taxRate : 0))

  // ── Günstigerprüfung alert ────────────────────────────────────────────────

  const estimatedAnnualIncome = (state.csp?.monthlyNetIncome ?? 0) * 12
  const lowIncomeAlert = estimatedAnnualIncome > 0 && estimatedAnnualIncome < GRUNDFREIBETRAG_2025

  return (
    <div className="space-y-5">
      {/* Freistellungsauftrag */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
        <div className="flex items-start gap-3">
          <MaterialIcon name="shield" filled className="text-emerald-400 text-[1.4rem] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-share-onBg">
              <FinanceTerm termId="freistellungsauftrag" label="Freistellungsauftrag" />
            </h3>
            <p className="text-xs text-share-onSurfaceVariant mt-0.5">
              Your annual tax-free allowance on investment income. Must be filed at each broker separately.
            </p>
          </div>
        </div>

        {/* Single / Married toggle */}
        <div className="flex gap-2">
          {[
            { label: 'Single — €1,000', married: false },
            { label: 'Married — €2,000', married: true },
          ].map((opt) => (
            <button
              key={String(opt.married)}
              type="button"
              onClick={() =>
                updateTax(state, { freistellungsauftragTotal: opt.married ? 2000 : 1000 }, onUpdate)
              }
              className={[
                'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                (state.isMarried ?? false) === opt.married
                  ? 'border-share-primary bg-share-primary/10 text-share-primary'
                  : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Visual bar: total → allocated */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-share-onSurfaceVariant">Allocated to depots</span>
            <span className="font-medium text-share-onBg">
              €{fsaAllocated.toLocaleString('de-DE')} / €{fsaTotal.toLocaleString('de-DE')}
            </span>
          </div>
          <div className="h-3 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(fsaAllocated / fsaTotal) * 100}%` }}
            />
          </div>
          {fsaUnallocated > 0 && (
            <p className="text-[10px] text-amber-400 mt-1.5">
              €{fsaUnallocated.toLocaleString('de-DE')} unallocated — file a Freistellungsauftrag at every depot you hold.
            </p>
          )}
        </div>

        {/* Allocated amount input */}
        <div>
          <label className="block text-xs text-share-onSurfaceVariant mb-1">
            Total allocated across all depots (€)
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant">€</span>
            <input
              type="number"
              min="0"
              max={fsaTotal}
              step="50"
              value={tax.freistellungsauftragAllocated || ''}
              onChange={(e) =>
                updateTax(state, { freistellungsauftragAllocated: parseFloat(e.target.value) || 0 }, onUpdate)
              }
              placeholder={String(fsaTotal)}
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-7 pr-3 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
            />
          </div>
          <p className="text-[10px] text-share-onSurfaceVariant/60 mt-1">
            Using the full €{fsaTotal.toLocaleString('de-DE')} saves you €{savingsIfUsedFully.toFixed(0)} in taxes per year.
          </p>
        </div>

        {/* Kirchensteuer toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => updateTax(state, { kirchensteuer: !tax.kirchensteuer }, onUpdate)}
            className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${tax.kirchensteuer ? 'bg-share-primary' : 'bg-share-surfaceContainerHighest'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${tax.kirchensteuer ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
          <span className="text-xs text-share-onSurfaceVariant">
            Kirchensteuer (church tax) — raises effective rate to ~{(ABGELTUNGSSTEUER_KST * 100).toFixed(2)}%
          </span>
        </div>
      </section>

      {/* Vorabpauschale calculator */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
        <div className="flex items-start gap-3">
          <MaterialIcon name="calculate" filled className="text-violet-400 text-[1.4rem] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-share-onBg">
              <FinanceTerm termId="vorabpauschale" label="Vorabpauschale" /> estimate ({new Date().getFullYear()})
            </h3>
            <p className="text-xs text-share-onSurfaceVariant mt-0.5">
              Annual pre-tax on accumulating ETFs. Your broker debits this in January.
            </p>
          </div>
        </div>

        {accumulatingValue > 0 ? (
          <>
            {/* Calculation breakdown */}
            <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-share-onSurfaceVariant">Accumulating ETF value</span>
                <span className="text-share-onBg font-medium">
                  €{accumulatingValue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-share-onSurfaceVariant">× 70% × Basiszins ({tax.basiszins}%) = Basisertrag</span>
                <span className="text-share-onBg">€{basisertrag.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-share-onSurfaceVariant">× 70% (after 30% Teilfreistellung)</span>
                <span className="text-share-onBg">€{taxablePortion.toFixed(2)}</span>
              </div>
              <div className="h-px bg-share-outlineVariant/50" />
              <div className="flex justify-between font-medium">
                <span className="text-share-onSurfaceVariant">Tax @ {(taxRate * 100).toFixed(3)}%</span>
                <span className={vorabpauschaleTax > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  €{vorabpauschaleTax.toFixed(2)}
                </span>
              </div>
              {vorabpauschaleTax === 0 && fsaUnallocated > 0 && (
                <p className="text-[10px] text-emerald-400">
                  Covered by your remaining Freistellungsauftrag capacity.
                </p>
              )}
            </div>

            {/* Basiszins input */}
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">
                Basiszins (set by Bundesfinanzministerium annually)
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tax.basiszins}
                  onChange={(e) => updateTax(state, { basiszins: parseFloat(e.target.value) || 0 }, onUpdate)}
                  className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
                />
                <span className="text-sm text-share-onSurfaceVariant">%</span>
              </div>
              <p className="text-[10px] text-share-onSurfaceVariant/60 mt-1">2.53% for 2025 · Updated annually by the Bundesfinanzministerium.</p>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-share-onSurfaceVariant/50">
            <MaterialIcon name="info" className="text-[1.5rem] mb-2" />
            <p className="text-xs">
              Add accumulating ETF holdings in the <span className="text-share-primary">Portfolio</span> tab with current prices to see your Vorabpauschale estimate.
            </p>
          </div>
        )}
      </section>

      {/* Günstigerprüfung alert */}
      {lowIncomeAlert && (
        <section className="rounded-xl border border-share-primary/30 bg-share-primary/5 p-5">
          <div className="flex items-start gap-3">
            <MaterialIcon name="lightbulb" filled className="text-share-primary text-[1.3rem] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-share-primary">Günstigerprüfung opportunity</h3>
              <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
                Your annual income appears to be below the <strong className="text-share-onBg">Grundfreibetrag (€{GRUNDFREIBETRAG_2025.toLocaleString('de-DE')}/year)</strong>. In this case, you can request <FinanceTerm termId="guestimerpruefung" label="Günstigerprüfung" /> on your tax return (Anlage KAP). The Finanzamt will assess your investment income at your lower personal income tax rate instead of the flat 26.375% Abgeltungssteuer — saving you potentially hundreds per year.
              </p>
              <p className="text-[10px] text-share-onSurfaceVariant/60 mt-2">
                Check with a Steuerberater or use ELSTER to file Anlage KAP and tick "Günstigerprüfung".
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Tax rate reference */}
      <section className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-4">
        <p className="text-xs font-semibold text-share-onBg mb-3">Tax rate reference</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Abgeltungssteuer base rate', value: '25.000%' },
            { label: 'Solidaritätszuschlag (5.5% of 25%)', value: '1.375%' },
            { label: 'Total without Kirchensteuer', value: '26.375%', highlight: true },
            { label: 'With Kirchensteuer (9%)', value: '~27.82%' },
            { label: 'Equity ETF Teilfreistellung', value: '30% exempt' },
            { label: 'Freistellungsauftrag (single)', value: '€1,000/year' },
            { label: 'Freistellungsauftrag (married)', value: '€2,000/year' },
            { label: 'Basiszins 2025', value: '2.53%' },
          ].map((row) => (
            <div key={row.label} className={`flex justify-between ${row.highlight ? 'font-medium text-share-onBg' : 'text-share-onSurfaceVariant'}`}>
              <span>{row.label}</span>
              <span className={row.highlight ? 'text-amber-400' : ''}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-share-onSurfaceVariant/50 mt-3">
          German brokers withhold Abgeltungssteuer automatically at source. You only need to file Anlage KAP if you want Günstigerprüfung, have foreign accounts, or have more than one depot without a Verlustverrechnungstopf.
        </p>
      </section>
    </div>
  )
}
