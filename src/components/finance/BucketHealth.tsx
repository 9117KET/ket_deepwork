/**
 * components/finance/BucketHealth.tsx
 *
 * Secondary "health check" view for the blended budget model: shows the four
 * Conscious Spending Plan buckets as percentages of income against their target
 * ranges. The primary daily view is the waterfall; this is for those who want to
 * sanity-check their allocation against the 50/20/10/20 guideline.
 */

import { MaterialIcon } from '../ui/MaterialIcon'
import { CSP_TARGETS } from '../../domain/financialTypes'
import type { FinancialState, CSPBucket } from '../../domain/financialTypes'

interface BucketHealthProps {
  state: FinancialState
}

export function BucketHealth({ state }: BucketHealthProps) {
  const csp = state.csp
  const income = csp?.monthlyNetIncome ?? 0

  const bucketTotals: Record<CSPBucket, number> = { fixed: 0, investment: 0, savings: 0, guiltFree: 0 }
  for (const e of csp?.expenses ?? []) {
    bucketTotals[e.bucket] = (bucketTotals[e.bucket] ?? 0) + e.monthlyAmount
  }

  if (income <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-share-outlineVariant p-8 text-center">
        <MaterialIcon name="donut_small" className="text-share-onSurfaceVariant/20 text-[2rem] mb-2" />
        <p className="text-xs text-share-onSurfaceVariant/60">
          Set your monthly income and budget lines in the Plan tab to see your bucket health.
        </p>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-share-onBg">Bucket health</h2>
        <p className="text-xs text-share-onSurfaceVariant mt-0.5">
          Your spending split vs. the Conscious Spending Plan guideline. Income:{' '}
          <span className="text-share-onBg font-medium">€{income.toLocaleString('de-DE')}</span>
        </p>
      </div>

      <div className="space-y-3">
        {(Object.entries(CSP_TARGETS) as [CSPBucket, typeof CSP_TARGETS[CSPBucket]][]).map(([bucket, cfg]) => {
          const amount = bucketTotals[bucket] ?? 0
          const pct = income > 0 ? Math.round((amount / income) * 100) : 0
          const inRange = pct >= cfg.min && pct <= cfg.max
          const overTarget = pct > cfg.max
          const barColor = overTarget ? 'bg-red-500' : inRange ? 'bg-emerald-500' : 'bg-amber-500'

          return (
            <div key={bucket}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-share-onSurfaceVariant">{cfg.label}</span>
                <span className={`font-medium ${overTarget ? 'text-red-400' : inRange ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {pct}% <span className="text-share-onSurfaceVariant/50 font-normal">(target {cfg.min}-{cfg.max}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
