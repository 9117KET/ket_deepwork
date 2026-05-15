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
import { FinanceLearn } from '../components/finance/FinanceLearn'
import { useFinancialState } from '../storage/financialStorage'
import type { FinanceTab } from '../components/finance/FinanceLayout'

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard')
  const [state, update] = useFinancialState()

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <FinanceDashboard state={state} onNavigate={setActiveTab} />
      case 'richLife':
        return <RichLifeVision state={state} onUpdate={update} />
      case 'spendingPlan':
        return <ConsciousSpendingPlan state={state} onUpdate={update} />
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
