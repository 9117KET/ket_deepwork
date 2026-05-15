/**
 * components/finance/AutomationChecklist.tsx
 *
 * Tracks which financial automations are set up.
 * Ramit's core principle: money that moves automatically requires zero willpower.
 */

import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, AutomationItem, AutomationType } from '../../domain/financialTypes'

const TYPE_LABELS: Record<AutomationType, string> = {
  dauerauftrag: 'Standing order',
  sparplan: 'ETF Sparplan',
  lastschrift: 'Direct debit',
  direktzahlung: 'Direct payment',
  other: 'Other',
}

interface AutomationChecklistProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function AutomationChecklist({ state, onUpdate }: AutomationChecklistProps) {
  const automations = state.automations ?? []
  const doneCount = automations.filter((a) => a.isSetUp).length
  const totalCount = automations.length

  const handleToggle = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      automations: (prev.automations ?? []).map((a) =>
        a.id === id ? { ...a, isSetUp: !a.isSetUp } : a,
      ),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="auto_mode" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Automation Checklist</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Money that moves automatically is money you never spend by accident. Every item below should be on autopilot — set up once, runs forever.
            </p>
          </div>
        </div>
      </section>

      {/* Progress */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-share-onBg">
            {doneCount}/{totalCount} automations set up
          </h3>
          {doneCount === totalCount && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <MaterialIcon name="check_circle" filled className="text-[0.9rem]" />
              Fully automated
            </span>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-share-surfaceContainerHighest overflow-hidden mb-5">
          <div
            className="h-full rounded-full bg-share-primary transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        <ul className="space-y-2">
          {automations.map((item) => (
            <AutomationRow key={item.id} item={item} onToggle={() => handleToggle(item.id)} />
          ))}
        </ul>
      </section>

      {/* Automation flow diagram */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <h3 className="text-sm font-semibold text-share-onBg mb-3">How the money flows</h3>
        <p className="text-xs text-share-onSurfaceVariant mb-4">
          On payday, money automatically routes itself before you can spend it. The sequence below is Ramit Sethi's automation ladder adapted for Germany.
        </p>

        <div className="space-y-2">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-start gap-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step.highlight ? 'bg-share-primary text-share-onPrimary' : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant'}`}>
                  {i + 1}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="h-4 w-px bg-share-outlineVariant" />
                )}
              </div>
              <div className="pb-2">
                <p className={`text-xs font-medium ${step.highlight ? 'text-share-primary' : 'text-share-onBg'}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key principle */}
      <section className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-4">
        <p className="text-xs text-share-onSurfaceVariant leading-relaxed">
          <span className="font-medium text-share-onBg">The key insight: </span>
          People overestimate their willpower and underestimate systems. A <FinanceTerm termId="dauerauftrag" label="Dauerauftrag" /> that fires on the 2nd of every month is worth more than 12 months of good intentions. Set up each automation once — it compounds forever.
        </p>
      </section>
    </div>
  )
}

// ─── Automation row ────────────────────────────────────────────────────────────

function AutomationRow({ item, onToggle }: { item: AutomationItem; onToggle: () => void }) {
  return (
    <li
      className={[
        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
        item.isSetUp
          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
          : 'border-share-outlineVariant bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh',
      ].join(' ')}
      onClick={onToggle}
    >
      <span className={`flex-shrink-0 mt-0.5 ${item.isSetUp ? 'text-emerald-400' : 'text-share-onSurfaceVariant/30'}`}>
        <MaterialIcon
          name={item.isSetUp ? 'check_circle' : 'radio_button_unchecked'}
          filled={item.isSetUp}
          className="text-[1.2rem]"
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-xs font-medium ${item.isSetUp ? 'text-share-onBg' : 'text-share-onBg'}`}>
            {item.label}
          </p>
          <span className={`text-[9px] rounded-full px-1.5 py-0.5 border ${item.isSetUp ? 'border-emerald-500/30 text-emerald-400' : 'border-share-outlineVariant text-share-onSurfaceVariant/40'}`}>
            {TYPE_LABELS[item.type]}
          </span>
        </div>
        <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5 leading-relaxed">
          {item.description}
        </p>
      </div>
    </li>
  )
}

// ─── Flow steps ────────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  {
    label: 'Payday (1st or 15th)',
    description: 'Net salary lands in your Girokonto via direct deposit.',
    highlight: false,
  },
  {
    label: 'bAV deducted from gross (before payday)',
    description: 'Your employer withholds bAV contribution before calculating net pay — you never see it arrive.',
    highlight: false,
  },
  {
    label: 'Dauerauftrag fires: Notgroschen / savings',
    description: 'Standing order moves your savings allocation to Tagesgeldkonto. Runs on the 2nd.',
    highlight: true,
  },
  {
    label: 'ETF-Sparplan executes',
    description: 'Broker automatically buys your monthly ETF allocation. Runs on the 1st-5th.',
    highlight: true,
  },
  {
    label: 'Lastschriften auto-debit',
    description: 'GKV, rent, phone, internet, insurance all pull from Girokonto automatically.',
    highlight: false,
  },
  {
    label: 'Remainder = guilt-free spending',
    description: 'Whatever is left after all the above is yours to spend however you like — no tracking needed.',
    highlight: true,
  },
]
