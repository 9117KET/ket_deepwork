/**
 * components/finance/AccountTracker.tsx
 *
 * German 4-account setup wizard + account list.
 * Tracks which accounts are opened and automated.
 * Integrates with the Automation checklist.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { FinanceTerm, FinanceTermTooltip } from './FinanceTermTooltip'
import type { FinancialState, FinancialAccount, AccountType } from '../../domain/financialTypes'

function createId(): string {
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── German 4-account wizard config ──────────────────────────────────────────

const WIZARD_STEPS = [
  {
    step: 1,
    type: 'girokonto' as AccountType,
    title: 'Girokonto (Hub account)',
    termId: 'girokonto',
    description: 'Your salary lands here. All Lastschriften and Dauerauftrag flow from here. Keep 2-4 weeks of expenses as a buffer.',
    recommended: ['DKB', 'ING'],
    features: ['No monthly fees', 'Free ATM worldwide (DKB)', '97% of German ATMs free (ING)', 'Good mobile app'],
    icon: 'account_balance',
    color: 'blue',
  },
  {
    step: 2,
    type: 'tagesgeld' as AccountType,
    title: 'Tagesgeldkonto (Emergency + Goals)',
    termId: 'tagesgeld',
    description: 'Your Notgroschen (3-6 months net) and named savings goals. Earns 2-3% interest. Accessible within 1-2 business days.',
    recommended: ['Scalable Capital (2.5% p.a.)', 'Weltsparen / Raisin (up to 3.45%)'],
    features: ['Higher interest than Girokonto', 'Instant access', 'No fees', '€100k deposit insurance'],
    icon: 'savings',
    color: 'emerald',
  },
  {
    step: 3,
    type: 'depot' as AccountType,
    title: 'ETF-Depot (Long-term wealth)',
    termId: 'depot',
    description: 'Monthly ETF-Sparplan into a global index ETF. Set once, runs automatically. This is where your wealth compounds.',
    recommended: ['Trade Republic', 'Scalable Capital (PRIME+)'],
    features: ['Free Sparpläne from €1', '2.0-2.5% on uninvested cash', 'Banking licence (2025)', 'Freistellungsauftrag €1,000'],
    icon: 'trending_up',
    color: 'violet',
  },
  {
    step: 4,
    type: 'festgeld' as AccountType,
    title: 'Festgeldkonto (Medium-term goals)',
    termId: 'festgeld',
    description: 'For goals 1-3 years away (down payment, car, major trip). Higher rate than Tagesgeld but money is locked.',
    recommended: ['Raisin / Weltsparen', 'Finanztip comparison'],
    features: ['2.5-3.2% p.a. (1-year term)', 'EU deposit insurance', 'Access via Raisin aggregator'],
    icon: 'lock',
    color: 'amber',
  },
]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  girokonto: 'Girokonto',
  tagesgeld: 'Tagesgeldkonto',
  festgeld: 'Festgeld',
  depot: 'ETF-Depot',
  bav: 'bAV',
  rurup: 'Rürup-Rente',
  other: 'Other',
}

const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  girokonto: 'account_balance',
  tagesgeld: 'savings',
  festgeld: 'lock',
  depot: 'trending_up',
  bav: 'business_center',
  rurup: 'self_improvement',
  other: 'wallet',
}

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  girokonto: 'text-blue-400',
  tagesgeld: 'text-emerald-400',
  festgeld: 'text-amber-400',
  depot: 'text-violet-400',
  bav: 'text-share-primary',
  rurup: 'text-rose-400',
  other: 'text-share-onSurfaceVariant',
}

// ─── New account form ─────────────────────────────────────────────────────────

interface NewAccountForm {
  label: string
  type: AccountType
  institution: string
  balance: string
  interestRate: string
}

const EMPTY_FORM: NewAccountForm = {
  label: '',
  type: 'girokonto',
  institution: '',
  balance: '',
  interestRate: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AccountTrackerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function AccountTracker({ state, onUpdate }: AccountTrackerProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [form, setForm] = useState<NewAccountForm>(EMPTY_FORM)

  const accounts = state.accounts ?? []
  const setupCount = WIZARD_STEPS.filter((s) =>
    accounts.some((a) => a.type === s.type && a.isSetUp),
  ).length

  const handleAddAccount = () => {
    const label = form.label.trim() || ACCOUNT_TYPE_LABELS[form.type]
    const balance = form.balance ? parseFloat(form.balance) : undefined
    const interestRate = form.interestRate ? parseFloat(form.interestRate) : undefined

    const account: FinancialAccount = {
      id: createId(),
      label,
      type: form.type,
      institution: form.institution.trim() || undefined,
      balance,
      interestRate,
      isSetUp: true,
      isAutomated: false,
    }

    onUpdate((prev) => ({ ...prev, accounts: [...(prev.accounts ?? []), account] }))
    setForm(EMPTY_FORM)
    setAddingAccount(false)
  }

  const handleToggleSetUp = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      accounts: (prev.accounts ?? []).map((a) =>
        a.id === id ? { ...a, isSetUp: !a.isSetUp } : a,
      ),
    }))
  }

  const handleToggleAutomated = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      accounts: (prev.accounts ?? []).map((a) =>
        a.id === id ? { ...a, isAutomated: !a.isAutomated } : a,
      ),
    }))
  }

  const handleUpdateBalance = (id: string, balance: string) => {
    const val = parseFloat(balance)
    onUpdate((prev) => ({
      ...prev,
      accounts: (prev.accounts ?? []).map((a) =>
        a.id === id
          ? { ...a, balance: isNaN(val) ? undefined : val, lastUpdated: new Date().toISOString().slice(0, 10) }
          : a,
      ),
    }))
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      accounts: (prev.accounts ?? []).filter((a) => a.id !== id),
    }))
  }

  // Total assets from accounts with balances
  const totalAssets = accounts
    .filter((a) => a.balance !== undefined)
    .reduce((sum, a) => sum + (a.balance ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="account_balance" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-share-onBg">Account Tracker</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              The German 4-account system: <FinanceTerm termId="girokonto" /> hub, <FinanceTerm termId="tagesgeld" label="Tagesgeld" /> for savings, <FinanceTerm termId="depot" label="ETF-Depot" /> for investing, and <FinanceTerm termId="festgeld" label="Festgeld" /> for medium-term goals.
            </p>
          </div>
        </div>
      </section>

      {/* Setup wizard toggle */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-share-onBg">German 4-Account Setup</h3>
            <p className="text-xs text-share-onSurfaceVariant mt-0.5">{setupCount}/4 account types set up</p>
          </div>
          <button
            type="button"
            onClick={() => setShowWizard((v) => !v)}
            className="text-xs text-share-primary hover:underline"
          >
            {showWizard ? 'Hide guide' : 'Show guide'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-3">
          {WIZARD_STEPS.map((step) => {
            const hasAccount = accounts.some((a) => a.type === step.type && a.isSetUp)
            return (
              <div
                key={step.step}
                className={`flex-1 h-1.5 rounded-full transition-colors ${hasAccount ? 'bg-emerald-500' : 'bg-share-surfaceContainerHighest'}`}
              />
            )
          })}
        </div>

        {showWizard && (
          <div className="mt-4 space-y-3">
            {WIZARD_STEPS.map((step) => {
              const hasAccount = accounts.some((a) => a.type === step.type && a.isSetUp)
              return (
                <div
                  key={step.step}
                  className={`rounded-lg border p-4 ${hasAccount ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-share-outlineVariant bg-share-surfaceContainer'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${hasAccount ? 'bg-emerald-500/20 text-emerald-400' : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant/60'}`}>
                      {hasAccount
                        ? <MaterialIcon name="check" className="text-[1rem]" />
                        : <span className="text-xs font-bold">{step.step}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold ${hasAccount ? 'text-emerald-400' : 'text-share-onBg'}`}>
                          {step.title}
                        </p>
                        <FinanceTermTooltip termId={step.termId} iconOnly />
                      </div>
                      <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
                        {step.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {step.recommended.map((r) => (
                          <span key={r} className="rounded-full border border-share-outlineVariant bg-share-surfaceContainerHigh px-2 py-0.5 text-[10px] text-share-onSurfaceVariant">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Account list */}
      {accounts.length > 0 && (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-share-onBg">My accounts</h3>
            {totalAssets > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-share-onSurfaceVariant">Total known assets</p>
                <p className="text-sm font-semibold text-share-onBg">
                  €{totalAssets.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </div>

          <ul className="space-y-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onToggleSetUp={() => handleToggleSetUp(account.id)}
                onToggleAutomated={() => handleToggleAutomated(account.id)}
                onUpdateBalance={(v) => handleUpdateBalance(account.id, v)}
                onDelete={() => handleDelete(account.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Add account form */}
      {addingAccount ? (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-3">
          <h3 className="text-sm font-semibold text-share-onBg">Add account</h3>

          {/* Type picker */}
          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1.5">Account type</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type }))}
                  className={[
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                    form.type === type
                      ? 'bg-share-primary text-share-onPrimary'
                      : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant hover:text-share-onBg',
                  ].join(' ')}
                >
                  <MaterialIcon name={ACCOUNT_TYPE_ICONS[type]} className="text-[0.85rem]" />
                  {ACCOUNT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Label (optional)</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder={ACCOUNT_TYPE_LABELS[form.type]}
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Institution</label>
              <input
                type="text"
                value={form.institution}
                onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
                placeholder="e.g. DKB, Trade Republic"
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Current balance (€)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.balance}
                  onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-7 pr-3 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Interest rate (% p.a.)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.interestRate}
                  onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
                  placeholder="2.5"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-3 pr-7 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant">%</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddAccount}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 transition-colors"
            >
              Add account
            </button>
            <button
              type="button"
              onClick={() => { setAddingAccount(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-share-outlineVariant/40 px-4 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAddingAccount(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors w-full"
        >
          <MaterialIcon name="add_circle" className="text-[1rem]" />
          Add an account
        </button>
      )}
    </div>
  )
}

// ─── Account row ──────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: FinancialAccount
  onToggleSetUp: () => void
  onToggleAutomated: () => void
  onUpdateBalance: (val: string) => void
  onDelete: () => void
}

function AccountRow({ account, onToggleSetUp, onToggleAutomated, onUpdateBalance, onDelete }: AccountRowProps) {
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceInput, setBalanceInput] = useState(account.balance?.toString() ?? '')

  const handleSaveBalance = () => {
    onUpdateBalance(balanceInput)
    setEditingBalance(false)
  }

  return (
    <li className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3">
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 mt-0.5 ${ACCOUNT_TYPE_COLORS[account.type]}`}>
          <MaterialIcon name={ACCOUNT_TYPE_ICONS[account.type]} className="text-[1.2rem]" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-share-onBg">{account.label}</p>
            {account.institution && (
              <span className="text-[10px] text-share-onSurfaceVariant/60 border border-share-outlineVariant/50 rounded-full px-1.5 py-0.5">
                {account.institution}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {/* Balance */}
            {editingBalance ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                  autoFocus
                  className="w-24 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-0.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
                />
                <button type="button" onClick={handleSaveBalance} className="text-[10px] text-share-primary hover:underline">Save</button>
                <button type="button" onClick={() => setEditingBalance(false)} className="text-[10px] text-share-onSurfaceVariant/50">✕</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setBalanceInput(account.balance?.toString() ?? ''); setEditingBalance(true) }}
                className="text-xs text-share-onSurfaceVariant hover:text-share-primary transition-colors"
              >
                {account.balance !== undefined
                  ? `€${account.balance.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : 'Add balance'}
              </button>
            )}

            {account.interestRate !== undefined && (
              <span className="text-[10px] text-emerald-400">{account.interestRate}% p.a.</span>
            )}

            {/* Status badges */}
            <button
              type="button"
              onClick={onToggleSetUp}
              className={`text-[10px] rounded-full px-1.5 py-0.5 border transition-colors ${account.isSetUp ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-share-outlineVariant text-share-onSurfaceVariant/50 hover:border-share-primary/40'}`}
            >
              {account.isSetUp ? 'Opened' : 'Not yet opened'}
            </button>

            <button
              type="button"
              onClick={onToggleAutomated}
              className={`text-[10px] rounded-full px-1.5 py-0.5 border transition-colors ${account.isAutomated ? 'border-share-primary/40 text-share-primary bg-share-primary/10' : 'border-share-outlineVariant text-share-onSurfaceVariant/50 hover:border-share-primary/40'}`}
            >
              {account.isAutomated ? 'Automated' : 'Manual'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
          aria-label="Delete account"
        >
          <MaterialIcon name="close" className="text-[0.9rem]" />
        </button>
      </div>
    </li>
  )
}
