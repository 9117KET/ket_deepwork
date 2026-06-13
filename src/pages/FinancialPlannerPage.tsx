/**
 * pages/FinancialPlannerPage.tsx
 *
 * Financial Planner - blended budget system:
 *  - primary daily view is the monthly cash-flow waterfall (the user's Excel model)
 *  - the Conscious Spending Plan buckets remain as a secondary "health check"
 *
 * Navigation is consolidated into five groups (Today · Plan · Goals · Grow · Setup),
 * each holding related sub-views.
 */

import { useMemo, useState } from 'react'
import { useQuery, useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AppChrome } from '../components/layout/AppChrome'
import { FinanceLayout, SubTabBar } from '../components/finance/FinanceLayout'
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
import { TaxDashboard } from '../components/finance/TaxDashboard'
import { BucketHealth } from '../components/finance/BucketHealth'
import { ShoppingList } from '../components/finance/ShoppingList'
import { WaterfallDashboard, type UpcomingTripOption } from '../components/finance/WaterfallDashboard'
import { useFinancialState } from '../storage/financialStorage'
import { monthKeyOf } from '../domain/financeWaterfall'
import type { FinanceTab, SubTabConfig } from '../components/finance/FinanceLayout'

type TodaySub = 'overview' | 'expenses' | 'shopping' | 'scan'
type PlanSub = 'budget' | 'richLife'
type GrowSub = 'invest' | 'fire' | 'netWorth' | 'debts'
type SetupSub = 'accounts' | 'automation' | 'tax' | 'buckets' | 'journal' | 'advisor' | 'learn'

const TODAY_TABS: SubTabConfig<TodaySub>[] = [
  { id: 'overview', label: 'Overview', icon: 'account_balance_wallet' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt_long' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping_cart' },
  { id: 'scan',     label: 'Scan',     icon: 'photo_camera' },
]
const PLAN_TABS: SubTabConfig<PlanSub>[] = [
  { id: 'budget',   label: 'Budget',    icon: 'donut_small' },
  { id: 'richLife', label: 'Rich Life', icon: 'favorite' },
]
const GROW_TABS: SubTabConfig<GrowSub>[] = [
  { id: 'invest',   label: 'Investments', icon: 'trending_up' },
  { id: 'fire',     label: 'FIRE',        icon: 'local_fire_department' },
  { id: 'netWorth', label: 'Net Worth',   icon: 'account_balance_wallet' },
  { id: 'debts',    label: 'Debts',       icon: 'credit_card' },
]
const SETUP_TABS: SubTabConfig<SetupSub>[] = [
  { id: 'accounts',   label: 'Accounts',    icon: 'account_balance' },
  { id: 'automation', label: 'Automations', icon: 'auto_mode' },
  { id: 'tax',        label: 'Tax',         icon: 'receipt' },
  { id: 'buckets',    label: 'Buckets',     icon: 'donut_small' },
  { id: 'journal',    label: 'Journal',     icon: 'menu_book' },
  { id: 'advisor',    label: 'Advisor',     icon: 'psychology' },
  { id: 'learn',      label: 'Learn',       icon: 'school' },
]

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('today')
  const [todaySub, setTodaySub] = useState<TodaySub>('overview')
  const [planSub, setPlanSub] = useState<PlanSub>('budget')
  const [growSub, setGrowSub] = useState<GrowSub>('invest')
  const [setupSub, setSetupSub] = useState<SetupSub>('accounts')
  const [monthKey, setMonthKey] = useState<string>(() => monthKeyOf())
  const [state, update] = useFinancialState()

  // Upcoming trips (for the critical-expense picker). Authenticated users only;
  // guests gracefully see no trip suggestions.
  const { isAuthenticated } = useConvexAuth()
  const tripsRaw = useQuery(api.travel.list, isAuthenticated ? {} : 'skip')
  const trips: UpcomingTripOption[] = useMemo(() => {
    if (!Array.isArray(tripsRaw)) return []
    return tripsRaw
      .map((t): UpcomingTripOption | null => {
        const budget = (t as { budget?: { totalBudget?: number } }).budget
        const amount = budget?.totalBudget
        if (!t.startDate || !amount || amount <= 0) return null
        return {
          id: String(t._id),
          name: t.name,
          monthKey: t.startDate.slice(0, 7),
          amount,
          startDate: t.startDate,
        }
      })
      .filter((t): t is UpcomingTripOption => t !== null)
  }, [tripsRaw])

  const renderToday = () => {
    return (
      <div className="space-y-4">
        <SubTabBar tabs={TODAY_TABS} active={todaySub} onChange={setTodaySub} />
        {todaySub === 'overview' && (
          <WaterfallDashboard
            state={state}
            onUpdate={update}
            monthKey={monthKey}
            onMonthChange={setMonthKey}
            trips={trips}
            onCapture={(target) => setTodaySub(target === 'scan' ? 'scan' : 'expenses')}
            onNavigateGroup={setActiveTab}
          />
        )}
        {todaySub === 'expenses' && <ExpenseTracker state={state} onUpdate={update} />}
        {todaySub === 'shopping' && <ShoppingList state={state} onUpdate={update} />}
        {todaySub === 'scan' && <ReceiptScanner state={state} onUpdate={update} mode="transaction" />}
      </div>
    )
  }

  const renderPlan = () => (
    <div className="space-y-4">
      <SubTabBar tabs={PLAN_TABS} active={planSub} onChange={setPlanSub} />
      {planSub === 'budget' && <ConsciousSpendingPlan state={state} onUpdate={update} />}
      {planSub === 'richLife' && <RichLifeVision state={state} onUpdate={update} />}
    </div>
  )

  const renderGrow = () => (
    <div className="space-y-4">
      <SubTabBar tabs={GROW_TABS} active={growSub} onChange={setGrowSub} />
      {growSub === 'invest' && <InvestmentsTab state={state} onUpdate={update} />}
      {growSub === 'fire' && <FIRECalculator state={state} onUpdate={update} />}
      {growSub === 'netWorth' && <NetWorthTracker state={state} onUpdate={update} />}
      {growSub === 'debts' && <DebtManager state={state} onUpdate={update} />}
    </div>
  )

  const renderSetup = () => (
    <div className="space-y-4">
      <SubTabBar tabs={SETUP_TABS} active={setupSub} onChange={setSetupSub} />
      {setupSub === 'accounts' && <AccountTracker state={state} onUpdate={update} />}
      {setupSub === 'automation' && <AutomationChecklist state={state} onUpdate={update} />}
      {setupSub === 'tax' && <TaxDashboard state={state} onUpdate={update} />}
      {setupSub === 'buckets' && <BucketHealth state={state} />}
      {setupSub === 'journal' && <FinanceJournal state={state} onUpdate={update} />}
      {setupSub === 'advisor' && (
        <FinancialAdvisor
          state={state}
          onSaveHistory={(history) => update((prev) => ({ ...prev, advisorHistory: history }))}
        />
      )}
      {setupSub === 'learn' && <FinanceLearn />}
    </div>
  )

  const renderTab = () => {
    switch (activeTab) {
      case 'today': return renderToday()
      case 'plan':  return renderPlan()
      case 'goals': return <SavingsGoals state={state} onUpdate={update} />
      case 'grow':  return renderGrow()
      case 'setup': return renderSetup()
    }
  }

  return (
    <AppChrome mobileActive="finance">
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 pb-28 md:pb-10">
        <FinanceLayout activeTab={activeTab} onTabChange={setActiveTab}>
          {renderTab()}
        </FinanceLayout>
      </div>
    </AppChrome>
  )
}
