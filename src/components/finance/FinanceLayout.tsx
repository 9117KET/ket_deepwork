/**
 * components/finance/FinanceLayout.tsx
 *
 * Tab-based shell for the Financial Planner.
 * Tabs: Dashboard | Rich Life | Spending Plan | Accounts | Debts | Investments | FIRE | Learn
 * Phase 1 implements: Dashboard, Rich Life, Spending Plan, Learn.
 * Others show a "coming soon" stub.
 */

import type { ReactNode } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'

export type FinanceTab =
  | 'dashboard'
  | 'richLife'
  | 'spendingPlan'
  | 'netWorth'
  | 'accounts'
  | 'debts'
  | 'investments'
  | 'fire'
  | 'learn'

interface TabConfig {
  id: FinanceTab
  label: string
  icon: string
  available: boolean
}

const TABS: TabConfig[] = [
  { id: 'dashboard',    label: 'Dashboard',     icon: 'home',                  available: true  },
  { id: 'richLife',     label: 'Rich Life',      icon: 'favorite',              available: true  },
  { id: 'spendingPlan', label: 'Spending Plan',  icon: 'donut_small',           available: true  },
  { id: 'netWorth',     label: 'Net Worth',      icon: 'account_balance_wallet', available: true  },
  { id: 'accounts',     label: 'Accounts',       icon: 'account_balance',       available: true  },
  { id: 'debts',        label: 'Debts',          icon: 'credit_card',           available: true  },
  { id: 'investments',  label: 'Investments',    icon: 'trending_up',           available: false },
  { id: 'fire',         label: 'FIRE',           icon: 'local_fire_department', available: false },
  { id: 'learn',        label: 'Learn',          icon: 'school',                available: true  },
]

interface FinanceLayoutProps {
  activeTab: FinanceTab
  onTabChange: (tab: FinanceTab) => void
  children: ReactNode
}

export function FinanceLayout({ activeTab, onTabChange, children }: FinanceLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-share-onBg font-shareHeadline">
          Financial Planner
        </h1>
        <p className="mt-1 text-sm text-share-onSurfaceVariant">
          Your personal money system — built on Ramit Sethi's Conscious Spending framework, adapted for Germany.
        </p>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto">
        <nav className="flex gap-1 border-b border-share-outlineVariant pb-0 min-w-max">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                disabled={!tab.available}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-share-primary text-share-primary'
                    : tab.available
                      ? 'border-transparent text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-outlineVariant'
                      : 'border-transparent text-share-onSurfaceVariant/30 cursor-not-allowed',
                ].join(' ')}
              >
                <MaterialIcon
                  name={tab.icon}
                  filled={isActive}
                  className="text-[1rem]"
                />
                <span className="hidden sm:inline">{tab.label}</span>
                {!tab.available && (
                  <span className="hidden sm:inline text-[9px] text-share-onSurfaceVariant/40 font-normal">soon</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}

/** Placeholder for tabs not yet implemented. */
export function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <MaterialIcon name="construction" className="text-[2.5rem] text-share-onSurfaceVariant/40" />
      <p className="text-sm font-medium text-share-onSurfaceVariant">{label}</p>
      <p className="text-xs text-share-onSurfaceVariant/50 max-w-xs">
        This section is coming in the next build phase.
      </p>
    </div>
  )
}
