/**
 * components/finance/FinanceLayout.tsx
 *
 * Tab-based shell for the Financial Planner, consolidated into five groups:
 * Today · Plan · Goals · Grow · Setup. Each group holds related sub-views,
 * so the top bar stays short (no horizontal scroll) and the daily-use views
 * (waterfall, expenses, shopping) live together under "Today".
 */

import type { ReactNode } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'

/** Top-level group ids. */
export type FinanceTab = 'today' | 'plan' | 'goals' | 'grow' | 'setup'

interface TabConfig {
  id: FinanceTab
  label: string
  icon: string
}

const TABS: TabConfig[] = [
  { id: 'today', label: 'Today', icon: 'today'         },
  { id: 'plan',  label: 'Plan',  icon: 'donut_small'   },
  { id: 'goals', label: 'Goals', icon: 'flag'          },
  { id: 'grow',  label: 'Grow',  icon: 'trending_up'   },
  { id: 'setup', label: 'Setup', icon: 'settings'      },
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
          Your personal money system - built on proven financial principles, adapted for Germany.
        </p>
      </div>

      {/* Tab bar — five groups, fits without horizontal scroll */}
      <nav className="grid grid-cols-5 gap-1 border-b border-share-outlineVariant">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={[
                'flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-share-primary text-share-primary'
                  : 'border-transparent text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-outlineVariant',
              ].join(' ')}
            >
              <MaterialIcon name={tab.icon} filled={isActive} className="text-[1.1rem]" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}

// ─── Sub-tab pill bar (used within a group) ────────────────────────────────────

export interface SubTabConfig<T extends string> {
  id: T
  label: string
  icon: string
}

export function SubTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTabConfig<T>[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-1">
      {tabs.map((sub) => (
        <button
          key={sub.id}
          type="button"
          onClick={() => onChange(sub.id)}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            active === sub.id
              ? 'bg-share-surfaceContainerHigh text-share-onBg'
              : 'text-share-onSurfaceVariant hover:text-share-onBg',
          ].join(' ')}
        >
          <MaterialIcon name={sub.icon} className="text-[0.95rem]" />
          {sub.label}
        </button>
      ))}
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
