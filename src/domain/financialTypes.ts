/**
 * domain/financialTypes.ts
 *
 * Core types for the Financial Planner module.
 * Adapted from Ramit Sethi's Conscious Spending Plan framework
 * with German-specific account types, tax rules, and investment vehicles.
 */

// ─── Core buckets ─────────────────────────────────────────────────────────────

/** The four Conscious Spending Plan buckets. */
export type CSPBucket = 'fixed' | 'investment' | 'savings' | 'guiltFree'

/** Target percentage ranges (of monthly net income) for each bucket. */
export const CSP_TARGETS: Record<CSPBucket, { min: number; max: number; label: string; color: string }> = {
  fixed:      { min: 50, max: 60, label: 'Fixed Costs',        color: 'blue'    },
  investment: { min: 10, max: 20, label: 'Investments',         color: 'emerald' },
  savings:    { min: 5,  max: 10, label: 'Savings Goals',       color: 'violet'  },
  guiltFree:  { min: 20, max: 35, label: 'Guilt-Free Spending', color: 'amber'   },
}

// ─── Expense items ─────────────────────────────────────────────────────────────

export interface CSPExpense {
  id: string
  label: string
  monthlyAmount: number
  bucket: CSPBucket
  /** Broad category for grouping (e.g. 'housing', 'food', 'transport'). */
  category?: string
}

// ─── Conscious Spending Plan ───────────────────────────────────────────────────

export interface ConsciousSpendingPlan {
  monthlyNetIncome: number
  expenses: CSPExpense[]
}

// ─── Rich Life ─────────────────────────────────────────────────────────────────

export type RichLifeCategory =
  | 'travel'
  | 'home'
  | 'family'
  | 'experiences'
  | 'health'
  | 'career'
  | 'freedom'
  | 'other'

export interface RichLifeItem {
  id: string
  description: string
  estimatedMonthlyCost: number
  category: RichLifeCategory
}

// ─── Financial accounts ────────────────────────────────────────────────────────

export type AccountType =
  | 'girokonto'     // German checking account
  | 'tagesgeld'     // High-yield savings (instant access)
  | 'festgeld'      // Fixed-term deposit
  | 'depot'         // Brokerage/ETF depot
  | 'bav'           // Betriebliche Altersvorsorge (company pension)
  | 'rurup'         // Rürup-Rente (self-employed retirement)
  | 'other'

export interface FinancialAccount {
  id: string
  label: string
  type: AccountType
  institution?: string
  balance?: number
  interestRate?: number
  isSetUp: boolean
  isAutomated: boolean
  lastUpdated?: string
}

// ─── Debts ─────────────────────────────────────────────────────────────────────

export type DebtType =
  | 'dispo'       // German overdraft (Dispokredit) - typically 9-12% APR
  | 'creditCard'
  | 'studentLoan'
  | 'carLoan'
  | 'mortgage'
  | 'other'

export type DebtPayoffStrategy = 'avalanche' | 'snowball'

export interface Debt {
  id: string
  label: string
  type: DebtType
  balance: number
  interestRate: number
  minimumPayment: number
  extraPayment?: number
}

// ─── Savings goals ─────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string
  label: string
  icon?: string
  targetAmount: number
  currentAmount: number
  targetDate?: string   // ISO date YYYY-MM-DD
  monthlyContribution: number
}

// ─── Net worth ─────────────────────────────────────────────────────────────────

export interface NetWorthSnapshot {
  date: string   // ISO date YYYY-MM-DD (monthly)
  /** Account id -> balance at snapshot time. */
  assets: Record<string, number>
  /** Debt id -> balance at snapshot time. */
  liabilities: Record<string, number>
  total: number
}

// ─── Investments ───────────────────────────────────────────────────────────────

export type ETFReplicationMethod = 'physical' | 'synthetic'
export type ETFDistributionType = 'accumulating' | 'distributing'

export interface ETFHolding {
  id: string
  name: string
  isin: string
  type: ETFDistributionType
  shares: number
  currentPriceEur?: number
  purchasePriceEur?: number
  depot: string
}

export interface ETFSparplan {
  id: string
  etfName: string
  isin: string
  monthlyAmount: number
  executionDay: number   // 1-28
  broker: string
  isActive: boolean
}

// ─── Tax settings (Germany) ───────────────────────────────────────────────────

export interface TaxSettings {
  /** Total Freistellungsauftrag in EUR (€1,000 single, €2,000 married). */
  freistellungsauftragTotal: number
  /** How much of the Freistellungsauftrag has been allocated to depots. */
  freistellungsauftragAllocated: number
  /** 2.53% for 2025 - set by Bundesfinanzministerium annually. */
  basiszins: number
  kirchensteuer: boolean
}

// ─── FIRE settings ────────────────────────────────────────────────────────────

export interface FIRESettings {
  currentAge?: number
  targetRetirementAge?: number
  currentPortfolioValue?: number
  /** Monthly expenses you want in retirement (EUR). */
  monthlyExpensesInRetirement?: number
  /** Expected annual return % (default 7). */
  expectedAnnualReturnPct?: number
  /** Annual inflation % (default 2.5). */
  inflationPct?: number
  /** Safe Withdrawal Rate % (default 3.5 for Germany - conservative for long horizon + Abgeltungssteuer). */
  swrPct?: number
  /** Expected monthly Rente from statutory pension. */
  expectedRenteMonthly?: number
  includeRente?: boolean
}

// ─── Big Wins ─────────────────────────────────────────────────────────────────

export interface BigWin {
  id: string
  title: string
  description: string
  /** Estimated annual financial impact in EUR. */
  estimatedAnnualImpact?: number
  isCompleted: boolean
  completedAt?: string  // ISO date
}

// ─── Automation checklist ─────────────────────────────────────────────────────

export type AutomationType = 'dauerauftrag' | 'sparplan' | 'lastschrift' | 'direktzahlung' | 'other'

export interface AutomationItem {
  id: string
  label: string
  description: string
  type: AutomationType
  isSetUp: boolean
}

// ─── Finance journal entries ───────────────────────────────────────────────────

export interface FinanceJournalEntry {
  id: string
  date: string       // ISO date
  content: string
  /** 'voice' if transcribed from audio, 'text' if typed. */
  inputMethod: 'voice' | 'text'
  tags?: string[]
}

// ─── Root financial state ─────────────────────────────────────────────────────

export interface FinancialState {
  // Profile
  monthlyNetIncome?: number
  monthlyGrossIncome?: number
  isMarried?: boolean

  // Rich Life
  richLifeVision?: string
  richLifeItems?: RichLifeItem[]

  // Core spending plan
  csp?: ConsciousSpendingPlan

  // Accounts, debts, goals
  accounts?: FinancialAccount[]
  debts?: Debt[]
  debtPayoffStrategy?: DebtPayoffStrategy
  savingsGoals?: SavingsGoal[]
  netWorthHistory?: NetWorthSnapshot[]

  // Investments
  portfolio?: ETFHolding[]
  sparplaene?: ETFSparplan[]
  taxSettings?: TaxSettings

  // Gamification / progress
  bigWins?: BigWin[]
  automations?: AutomationItem[]

  // FIRE
  fireSettings?: FIRESettings

  // Journal
  journalEntries?: FinanceJournalEntry[]

  // Onboarding
  /** 0 = not started, 1 = rich life done, 2 = CSP done, etc. */
  onboardingStep?: number
  lastMoneyDateAt?: string  // ISO date of last "Money Date" review
}

// ─── Default Big Wins (German-adapted) ────────────────────────────────────────

export const DEFAULT_BIG_WINS: BigWin[] = [
  {
    id: 'bw-girokonto',
    title: 'Open a free Girokonto',
    description: 'Switch to DKB or ING - zero fees, worldwide ATM withdrawals, good app. One 30-minute task with permanent benefit.',
    estimatedAnnualImpact: 120,
    isCompleted: false,
  },
  {
    id: 'bw-freistellungsauftrag',
    title: 'Set up your Freistellungsauftrag',
    description: 'File your €1,000 tax-free allowance at every depot you hold. This is free money - €263.75 in avoided taxes annually.',
    estimatedAnnualImpact: 264,
    isCompleted: false,
  },
  {
    id: 'bw-notgroschen',
    title: 'Build your Notgroschen (Emergency Fund)',
    description: 'Fund 3-6 months of net expenses in a Tagesgeldkonto. Never touch the Dispo again.',
    isCompleted: false,
  },
  {
    id: 'bw-sparplan',
    title: 'Start an ETF-Sparplan',
    description: 'Open a depot at Trade Republic or Scalable Capital. Set up a monthly Sparplan into a global index ETF (FTSE All-World or MSCI World). Even €25/month matters.',
    isCompleted: false,
  },
  {
    id: 'bw-bav',
    title: 'Capture your bAV employer match',
    description: 'Your employer must contribute at least 15% on top of your bAV contributions. That is an instant 15% return - always capture the full match.',
    estimatedAnnualImpact: 500,
    isCompleted: false,
  },
  {
    id: 'bw-salary',
    title: 'Negotiate your salary',
    description: 'A €3,000 raise invested for 30 years at 7% is worth over €228,000. Document your contributions, cite market data, make the ask.',
    estimatedAnnualImpact: 3000,
    isCompleted: false,
  },
  {
    id: 'bw-insurance-audit',
    title: 'Audit your Versicherungen',
    description: 'Cancel unnecessary policies (Gepäck, Handy, Reiseschutz). Keep only Haftpflicht, Berufsunfähigkeit, and health. Save €20-60/month.',
    estimatedAnnualImpact: 480,
    isCompleted: false,
  },
  {
    id: 'bw-steuererklarung',
    title: 'File your Steuererklärung',
    description: '75% of Germans who file get money back. Average refund is over €1,000. Use ELSTER (free) or tax software.',
    estimatedAnnualImpact: 1000,
    isCompleted: false,
  },
  {
    id: 'bw-cancel-riester',
    title: 'Review your Riester contract',
    description: 'Most insurance-based Riester contracts have 3-4% annual fees that eat the subsidy. Calculate if yours is net-positive after fees. Riester is being replaced by Altersvorsorgedepot in 2027.',
    isCompleted: false,
  },
  {
    id: 'bw-automate',
    title: 'Automate all Dauerauftrag transfers',
    description: 'Set up standing orders: emergency fund top-up, ETF Sparplan, savings goals. Money that leaves automatically feels like it never arrived.',
    isCompleted: false,
  },
]

// ─── Default Automation Checklist ────────────────────────────────────────────

export const DEFAULT_AUTOMATIONS: AutomationItem[] = [
  {
    id: 'auto-salary-direct',
    label: 'Salary direct deposit to Girokonto',
    description: 'Your employer deposits salary directly into your Girokonto hub account.',
    type: 'direktzahlung',
    isSetUp: false,
  },
  {
    id: 'auto-notgroschen',
    label: 'Dauerauftrag to Tagesgeldkonto',
    description: 'Automatic transfer from Girokonto to emergency fund / savings account on payday.',
    type: 'dauerauftrag',
    isSetUp: false,
  },
  {
    id: 'auto-sparplan',
    label: 'ETF-Sparplan configured',
    description: 'Monthly ETF purchase plan set up at your broker. Executes automatically on the same date every month.',
    type: 'sparplan',
    isSetUp: false,
  },
  {
    id: 'auto-bav',
    label: 'bAV Entgeltumwandlung set up',
    description: 'Salary sacrifice for company pension deducted automatically from gross pay.',
    type: 'lastschrift',
    isSetUp: false,
  },
  {
    id: 'auto-rent',
    label: 'Rent Dauerauftrag',
    description: 'Standing order for rent pays automatically on the 1st/3rd of the month.',
    type: 'dauerauftrag',
    isSetUp: false,
  },
  {
    id: 'auto-gkv',
    label: 'GKV contribution auto-deducted',
    description: 'Health insurance contribution deducted from gross salary by employer.',
    type: 'lastschrift',
    isSetUp: false,
  },
]
