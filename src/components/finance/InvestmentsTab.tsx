/**
 * components/finance/InvestmentsTab.tsx
 *
 * Wrapper for the Investments tab with three sub-tabs:
 * Portfolio | Sparpläne | Tax
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { ETFPortfolio } from './ETFPortfolio'
import { SparplanManager } from './SparplanManager'
import { TaxDashboard } from './TaxDashboard'
import type { FinancialState } from '../../domain/financialTypes'

type InvestmentsSubTab = 'portfolio' | 'sparplaene' | 'tax'

interface InvestmentsTabProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

const SUB_TABS: { id: InvestmentsSubTab; label: string; icon: string }[] = [
  { id: 'portfolio',  label: 'Portfolio',    icon: 'pie_chart'  },
  { id: 'sparplaene', label: 'Sparpläne',    icon: 'repeat'     },
  { id: 'tax',        label: 'Tax',          icon: 'receipt_long' },
]

export function InvestmentsTab({ state, onUpdate }: InvestmentsTabProps) {
  const [subTab, setSubTab] = useState<InvestmentsSubTab>('portfolio')

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
              subTab === tab.id
                ? 'bg-share-surfaceContainerHigh text-share-onBg'
                : 'text-share-onSurfaceVariant hover:text-share-onBg',
            ].join(' ')}
          >
            <MaterialIcon name={tab.icon} className="text-[0.95rem]" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {subTab === 'portfolio'  && <ETFPortfolio state={state} onUpdate={onUpdate} />}
      {subTab === 'sparplaene' && <SparplanManager state={state} onUpdate={onUpdate} />}
      {subTab === 'tax'        && <TaxDashboard state={state} onUpdate={onUpdate} />}
    </div>
  )
}
