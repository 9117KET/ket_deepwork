/**
 * components/finance/FinanceDashboard.tsx
 *
 * Overview dashboard: setup checklist, CSP snapshot, Big Wins progress.
 * Phase 1: focus on onboarding guidance and quick-start steps.
 */

import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState } from '../../domain/financialTypes'
import { CSP_TARGETS } from '../../domain/financialTypes'
import type { FinanceTab } from './FinanceLayout'

interface FinanceDashboardProps {
  state: FinancialState
  onNavigate: (tab: FinanceTab) => void
}

interface SetupStep {
  label: string
  description: string
  done: boolean
  tab: FinanceTab
  icon: string
}

export function FinanceDashboard({ state, onNavigate }: FinanceDashboardProps) {
  const hasVision = Boolean(state.richLifeVision?.trim() || (state.richLifeItems?.length ?? 0) > 0)
  const hasIncome = Boolean(state.csp?.monthlyNetIncome)
  const hasExpenses = (state.csp?.expenses?.length ?? 0) > 0
  const completedWins = (state.bigWins ?? []).filter((w) => w.isCompleted).length
  const totalWins = (state.bigWins ?? []).length

  const setupSteps: SetupStep[] = [
    {
      label: 'Define your Rich Life',
      description: 'What does financial freedom look like to you specifically?',
      done: hasVision,
      tab: 'plan',
      icon: 'favorite',
    },
    {
      label: 'Set your monthly income',
      description: 'Enter your net monthly income to calculate your spending buckets.',
      done: hasIncome,
      tab: 'plan',
      icon: 'payments',
    },
    {
      label: 'Build your Spending Plan',
      description: 'Categorize your expenses into the 4 CSP buckets.',
      done: hasExpenses,
      tab: 'plan',
      icon: 'donut_small',
    },
  ]

  const doneCount = setupSteps.filter((s) => s.done).length
  const allDone = doneCount === setupSteps.length

  // CSP snapshot
  const csp = state.csp
  const income = csp?.monthlyNetIncome ?? 0
  const bucketTotals = { fixed: 0, investment: 0, savings: 0, guiltFree: 0 }
  for (const e of csp?.expenses ?? []) {
    bucketTotals[e.bucket] = (bucketTotals[e.bucket] ?? 0) + e.monthlyAmount
  }
  const totalAllocated = Object.values(bucketTotals).reduce((a, b) => a + b, 0)
  const unallocated = income > 0 ? income - totalAllocated : 0

  return (
    <div className="space-y-6">
      {/* Setup progress */}
      {!allDone && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-share-onBg">Get started</h2>
              <p className="text-xs text-share-onSurfaceVariant mt-0.5">
                {doneCount} of {setupSteps.length} steps complete
              </p>
            </div>
            <div className="text-xs text-share-primary font-medium">
              {Math.round((doneCount / setupSteps.length) * 100)}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-share-surfaceContainerHighest mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-share-primary transition-all duration-500"
              style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
            />
          </div>

          <ul className="space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.tab)}
                  className={[
                    'w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors',
                    step.done
                      ? 'bg-emerald-500/5 border border-emerald-500/20'
                      : 'bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh border border-share-outlineVariant',
                  ].join(' ')}
                >
                  <span className={step.done ? 'text-emerald-400' : 'text-share-onSurfaceVariant/50'}>
                    <MaterialIcon
                      name={step.done ? 'check_circle' : step.icon}
                      filled={step.done}
                      className="text-[1.2rem] mt-0.5"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-medium ${step.done ? 'text-emerald-400' : 'text-share-onBg'}`}>
                      {step.label}
                    </span>
                    <span className="block text-xs text-share-onSurfaceVariant/70 mt-0.5">
                      {step.description}
                    </span>
                  </span>
                  {!step.done && (
                    <MaterialIcon name="chevron_right" className="text-share-onSurfaceVariant/40 mt-0.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CSP snapshot - only if income is set */}
      {income > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-share-onBg">
              <FinanceTerm termId="csp" label="Spending Plan" /> snapshot
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('plan')}
              className="text-xs text-share-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <p className="text-xs text-share-onSurfaceVariant mb-4">
            Monthly net income: <span className="text-share-onBg font-medium">€{income.toLocaleString('de-DE')}</span>
          </p>

          <div className="space-y-3">
            {(Object.entries(CSP_TARGETS) as [keyof typeof CSP_TARGETS, typeof CSP_TARGETS[keyof typeof CSP_TARGETS]][]).map(([bucket, cfg]) => {
              const amount = bucketTotals[bucket] ?? 0
              const pct = income > 0 ? Math.round((amount / income) * 100) : 0
              const inRange = pct >= cfg.min && pct <= cfg.max
              const overTarget = pct > cfg.max

              const barColor = overTarget
                ? 'bg-red-500'
                : inRange
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'

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

          {unallocated > 0 && (
            <p className="mt-3 text-xs text-amber-400">
              €{unallocated.toLocaleString('de-DE')} unallocated this month - add it to a bucket.
            </p>
          )}
          {unallocated < 0 && (
            <p className="mt-3 text-xs text-red-400">
              Over budget by €{Math.abs(unallocated).toLocaleString('de-DE')} - review your fixed costs.
            </p>
          )}
        </section>
      )}

      {/* Big Wins progress */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-share-onBg">Big Wins</h2>
          <span className="text-xs text-share-onSurfaceVariant">
            {completedWins}/{totalWins} done
          </span>
        </div>
        <p className="text-xs text-share-onSurfaceVariant mb-4">
          5-10 high-leverage actions that have more financial impact than years of small cuts.
        </p>

        <ul className="space-y-2">
          {(state.bigWins ?? []).slice(0, 5).map((win) => (
            <li
              key={win.id}
              className={`flex items-start gap-2.5 rounded-lg p-2.5 ${
                win.isCompleted ? 'bg-emerald-500/5' : 'bg-share-surfaceContainer'
              }`}
            >
              <MaterialIcon
                name={win.isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                filled={win.isCompleted}
                className={`text-[1.1rem] mt-0.5 flex-shrink-0 ${win.isCompleted ? 'text-emerald-400' : 'text-share-onSurfaceVariant/40'}`}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${win.isCompleted ? 'text-share-onSurfaceVariant line-through' : 'text-share-onBg'}`}>
                  {win.title}
                </p>
                {win.estimatedAnnualImpact && !win.isCompleted && (
                  <p className="text-[10px] text-emerald-400/70 mt-0.5">
                    ≈ €{win.estimatedAnnualImpact.toLocaleString('de-DE')}/year impact
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {totalWins > 5 && (
          <p className="mt-2 text-xs text-share-onSurfaceVariant/50 text-center">
            + {totalWins - 5} more big wins - coming in the next section
          </p>
        )}
      </section>

      {/* Core philosophy */}
      <section className="rounded-xl border border-share-outlineVariant/50 bg-share-surfaceContainerLow p-5">
        <h2 className="text-xs font-semibold text-share-onSurfaceVariant uppercase tracking-wide mb-3">
          The principle
        </h2>
        <p className="text-sm text-share-onBg border-l-2 border-share-primary pl-3 leading-relaxed">
          Spend intentionally on the things you value. Cut ruthlessly on the things you don't. Automate everything in between.
        </p>
      </section>
    </div>
  )
}
