/**
 * pages/FinancialPlannerPage.tsx
 *
 * Financial Planner - full Conscious Spending Plan system
 * adapted from Ramit Sethi's framework for Germany.
 */

import { useState } from 'react'
import { AppChrome } from '../components/layout/AppChrome'
import { FinanceLayout, ComingSoonTab } from '../components/finance/FinanceLayout'
import { FinanceDashboard } from '../components/finance/FinanceDashboard'
import { RichLifeVision } from '../components/finance/RichLifeVision'
import { ConsciousSpendingPlan } from '../components/finance/ConsciousSpendingPlan'
import { NetWorthTracker } from '../components/finance/NetWorthTracker'
import { AccountTracker } from '../components/finance/AccountTracker'
import { AutomationChecklist } from '../components/finance/AutomationChecklist'
import { DebtManager } from '../components/finance/DebtManager'
import { InvestmentsTab } from '../components/finance/InvestmentsTab'
import { FIRECalculator } from '../components/finance/FIRECalculator'
import { SavingsGoals } from '../components/finance/SavingsGoals'
import { FinanceJournal } from '../components/finance/FinanceJournal'
import { ReceiptScanner } from '../components/finance/ReceiptScanner'
import { ExpenseTracker } from '../components/finance/ExpenseTracker'
import { FinancialAdvisor } from '../components/finance/FinancialAdvisor'
import { FinanceLearn } from '../components/finance/FinanceLearn'
import { useFinancialState } from '../storage/financialStorage'
import { MaterialIcon } from '../components/ui/MaterialIcon'
import type { FinanceTab } from '../components/finance/FinanceLayout'

type AccountsSubTab = 'accounts' | 'automation'
type SpendingSubTab = 'plan' | 'receipt'

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard')
  const [accountsSubTab, setAccountsSubTab] = useState<AccountsSubTab>('accounts')
  const [spendingSubTab, setSpendingSubTab] = useState<SpendingSubTab>('plan')
  const [state, update] = useFinancialState()

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <FinanceDashboard state={state} onNavigate={setActiveTab} />

      case 'richLife':
        return <RichLifeVision state={state} onUpdate={update} />

      case 'spendingPlan':
        return (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-1">
              {([
                { id: 'plan', label: 'Spending Plan', icon: 'donut_small' },
                { id: 'receipt', label: 'Scan Receipt', icon: 'receipt_long' },
              ] as { id: SpendingSubTab; label: string; icon: string }[]).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSpendingSubTab(sub.id)}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
                    spendingSubTab === sub.id
                      ? 'bg-share-surfaceContainerHigh text-share-onBg'
                      : 'text-share-onSurfaceVariant hover:text-share-onBg',
                  ].join(' ')}
                >
                  <MaterialIcon name={sub.icon} className="text-[0.95rem]" />
                  {sub.label}
                </button>
              ))}
            </div>
            {spendingSubTab === 'plan'
              ? <ConsciousSpendingPlan state={state} onUpdate={update} />
              : <ReceiptScanner state={state} onUpdate={update} />}
          </div>
        )

      case 'netWorth':
        return <NetWorthTracker state={state} onUpdate={update} />

      case 'accounts':
        return (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-1">
              {([
                { id: 'accounts', label: 'Accounts', icon: 'account_balance' },
                { id: 'automation', label: 'Automations', icon: 'auto_mode' },
              ] as { id: AccountsSubTab; label: string; icon: string }[]).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setAccountsSubTab(sub.id)}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
                    accountsSubTab === sub.id
                      ? 'bg-share-surfaceContainerHigh text-share-onBg'
                      : 'text-share-onSurfaceVariant hover:text-share-onBg',
                  ].join(' ')}
                >
                  <MaterialIcon name={sub.icon} className="text-[0.95rem]" />
                  {sub.label}
                </button>
              ))}
            </div>
            {accountsSubTab === 'accounts'
              ? <AccountTracker state={state} onUpdate={update} />
              : <AutomationChecklist state={state} onUpdate={update} />}
          </div>
        )

      case 'debts':
        return <DebtManager state={state} onUpdate={update} />

      case 'investments':
        return <InvestmentsTab state={state} onUpdate={update} />

      case 'expenses':
        return <ExpenseTracker state={state} onUpdate={update} />

      case 'fire':
        return <FIRECalculator state={state} onUpdate={update} />

      case 'goals':
        return <SavingsGoals state={state} onUpdate={update} />

      case 'journal':
        return <FinanceJournal state={state} onUpdate={update} />

      case 'advisor':
        return (
          <FinancialAdvisor
            state={state}
            onSaveHistory={(history) => update((prev) => ({ ...prev, advisorHistory: history }))}
          />
        )

      case 'learn':
        return <FinanceLearn />

      default:
        return <ComingSoonTab label={activeTab} />
    }
  }

  return (
    <AppChrome
      headerPositionClass="top-0"
      mobileActive="finance"
      maxWidthClass="max-w-[1200px]"
    >
      <FinanceLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTab()}
      </FinanceLayout>
    </AppChrome>
  )
}
