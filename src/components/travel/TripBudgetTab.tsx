import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"
import {
  BUDGET_CATEGORIES,
  buildDefaultAllocations,
  totalSpent,
  spentByCategory,
  remainingBudget,
  categoryBudgetStatus,
  createExpense,
} from "../../domain/travelBudget"
import type { TripBudget, Expense, BudgetCategory } from "../../domain/travelBudget"

interface Props {
  tripId: Id<"travelTrips">
  budget: TripBudget | null
  durationDays: number
  startDate?: string
  aiBreakdownHint?: string
  /** Called when user taps "Log to Finance" on an expense */
  onLogToFinance?: (expense: Expense) => void
  /** Ids of expenses already bridged to Finance (to show checkmark) */
  bridgedExpenseIds?: Set<string>
}

const CATEGORY_ICONS: Record<BudgetCategory, string> = {
  Accommodation: "hotel",
  Food: "restaurant",
  Transport: "directions_transit",
  Activities: "local_activity",
  Shopping: "shopping_bag",
  Misc: "more_horiz",
}

const STATUS_COLORS = {
  ok: { bar: "bg-emerald-500", text: "text-emerald-400" },
  warning: { bar: "bg-amber-500", text: "text-amber-400" },
  over: { bar: "bg-share-error", text: "text-share-error" },
}

export function TripBudgetTab({ tripId, budget, durationDays, startDate, aiBreakdownHint, onLogToFinance, bridgedExpenseIds }: Props) {
  const updateTrip = useMutation(api.travel.update)
  const [setupMode, setSetupMode] = useState(!budget)
  const [totalInput, setTotalInput] = useState(budget ? String(budget.totalBudget) : "")
  const [currencyInput, setCurrencyInput] = useState(budget?.currency ?? "EUR")
  const [allocations, setAllocations] = useState<Partial<Record<BudgetCategory, number>>>(
    budget?.allocations ?? {}
  )
  const [addingExpense, setAddingExpense] = useState(false)
  const [expForm, setExpForm] = useState<{
    date: string; category: BudgetCategory; amount: string; note: string
  }>({
    date: new Date().toISOString().slice(0, 10),
    category: "Food",
    amount: "",
    note: "",
  })

  async function handleSetupSave() {
    const total = parseFloat(totalInput)
    if (isNaN(total) || total <= 0) return
    const allocs = Object.fromEntries(
      BUDGET_CATEGORIES.map((cat) => [cat, allocations[cat] ?? Math.round(total * getDefaultPct(cat))])
    ) as Record<BudgetCategory, number>
    const newBudget: TripBudget = {
      totalBudget: total,
      currency: currencyInput.toUpperCase().trim() || "EUR",
      allocations: allocs,
      expenses: budget?.expenses ?? [],
    }
    await updateTrip({ id: tripId, budget: newBudget })
    setSetupMode(false)
  }

  function handleAutoAllocate() {
    const total = parseFloat(totalInput)
    if (isNaN(total) || total <= 0) return
    setAllocations(buildDefaultAllocations(total))
  }

  async function handleAddExpense() {
    const amount = parseFloat(expForm.amount)
    if (isNaN(amount) || amount <= 0 || !budget) return
    const expense = createExpense({
      date: expForm.date,
      category: expForm.category,
      amount,
      currency: budget.currency,
      amountBase: amount,
      note: expForm.note,
    })
    const updated: TripBudget = { ...budget, expenses: [...budget.expenses, expense] }
    await updateTrip({ id: tripId, budget: updated })
    setAddingExpense(false)
    setExpForm({ date: new Date().toISOString().slice(0, 10), category: "Food", amount: "", note: "" })
  }

  async function handleDeleteExpense(id: string) {
    if (!budget) return
    const updated: TripBudget = { ...budget, expenses: budget.expenses.filter((e) => e.id !== id) }
    await updateTrip({ id: tripId, budget: updated })
  }

  if (setupMode || !budget) {
    return (
      <BudgetSetup
        totalInput={totalInput}
        setTotalInput={setTotalInput}
        currencyInput={currencyInput}
        setCurrencyInput={setCurrencyInput}
        allocations={allocations}
        setAllocations={setAllocations}
        onAutoAllocate={handleAutoAllocate}
        onSave={handleSetupSave}
        aiBreakdownHint={aiBreakdownHint}
      />
    )
  }

  const spent = totalSpent(budget.expenses)
  const remaining = remainingBudget(budget)
  const spentByCat = spentByCategory(budget.expenses)
  const spentPct = budget.totalBudget > 0 ? Math.min(100, (spent / budget.totalBudget) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-share-onSurfaceVariant uppercase tracking-wide font-bold">Total Budget</p>
            <p className="text-2xl font-bold text-share-onBg mt-0.5">
              {budget.currency} {budget.totalBudget.toFixed(0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-share-onSurfaceVariant">Remaining</p>
            <p className={`text-lg font-bold mt-0.5 ${remaining < 0 ? "text-share-error" : "text-emerald-400"}`}>
              {budget.currency} {remaining.toFixed(0)}
            </p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-share-surfaceContainerHigh overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${spentPct >= 100 ? "bg-share-error" : spentPct >= 80 ? "bg-amber-500" : "bg-share-primary"}`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-share-onSurfaceVariant">
            Spent: {budget.currency} {spent.toFixed(0)}
          </p>
          <p className="text-xs text-share-onSurfaceVariant">{spentPct.toFixed(0)}% used</p>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 space-y-3">
        <h3 className="text-xs font-bold text-share-onBg uppercase tracking-wide">By Category</h3>
        {BUDGET_CATEGORIES.map((cat) => {
          const allocated = budget.allocations[cat] ?? 0
          const catSpent = spentByCat[cat] ?? 0
          const status = categoryBudgetStatus(cat, catSpent, allocated)
          const pct = allocated > 0 ? Math.min(100, (catSpent / allocated) * 100) : 0
          const colors = STATUS_COLORS[status]
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-share-onBg">
                  <MaterialIcon name={CATEGORY_ICONS[cat]} className="text-[0.9rem] text-share-onSurfaceVariant" />
                  {cat}
                </span>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {budget.currency} {catSpent.toFixed(0)} / {allocated.toFixed(0)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-share-surfaceContainerHigh overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Add expense */}
      {addingExpense ? (
        <div className="rounded-2xl border border-share-primary/30 bg-share-surfaceContainer p-5 space-y-3">
          <h3 className="text-sm font-bold text-share-onBg">Add Expense</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Date</label>
              <input
                type="date"
                value={expForm.date}
                onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Amount ({budget.currency})</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={expForm.amount}
                onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Category</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value as BudgetCategory }))}
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              >
                {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Note</label>
              <input
                type="text"
                value={expForm.note}
                onChange={(e) => setExpForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Dinner at Shinjuku"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAddExpense()}
              className="rounded-xl bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:opacity-90 transition-opacity"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAddingExpense(false)}
              className="rounded-xl border border-share-outlineVariant px-4 py-2 text-sm text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddingExpense(true)}
            className="flex items-center gap-1.5 rounded-xl border border-share-outlineVariant px-4 py-2 text-sm font-medium text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-primary/40 transition-colors"
          >
            <MaterialIcon name="add" className="text-[0.95rem]" />
            Log Expense
          </button>
          <button
            type="button"
            onClick={() => setSetupMode(true)}
            className="flex items-center gap-1 rounded-xl border border-share-outlineVariant px-3 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
          >
            <MaterialIcon name="settings" className="text-[0.85rem]" />
            Edit Budget
          </button>
        </div>
      )}

      {/* Expense log */}
      {budget.expenses.length > 0 && (
        <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer overflow-hidden">
          <div className="px-5 py-3 border-b border-share-outlineVariant bg-share-surfaceContainerLow">
            <span className="text-xs font-bold text-share-onSurfaceVariant uppercase tracking-wide">Expense Log</span>
          </div>
          <ul className="divide-y divide-share-outlineVariant/30">
            {[...budget.expenses].reverse().map((exp) => (
              <li key={exp.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-share-surfaceContainerLow/50 transition-colors">
                <MaterialIcon name={CATEGORY_ICONS[exp.category]} className="text-[1rem] text-share-onSurfaceVariant shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-share-onBg">{exp.note || exp.category}</p>
                  <p className="text-xs text-share-onSurfaceVariant">{exp.date} · {exp.category}</p>
                </div>
                <span className="text-sm font-semibold text-share-onBg shrink-0">
                  {exp.currency} {exp.amount.toFixed(2)}
                </span>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  {onLogToFinance && (
                    bridgedExpenseIds?.has(exp.id) ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                        <MaterialIcon name="check_circle" className="text-[0.85rem]" />
                        Logged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onLogToFinance(exp)}
                        className="flex items-center gap-0.5 rounded-lg border border-share-outlineVariant px-2 py-1 text-[10px] font-medium text-share-onSurfaceVariant hover:text-share-primary hover:border-share-primary/40 transition-colors"
                        title="Also log this expense to Finance"
                      >
                        <MaterialIcon name="account_balance_wallet" className="text-[0.8rem]" />
                        Finance
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteExpense(exp.id)}
                    className="text-share-onSurfaceVariant hover:text-share-error transition-colors"
                  >
                    <MaterialIcon name="delete_outline" className="text-[0.9rem]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Budget setup form ────────────────────────────────────────────────────────

function BudgetSetup({
  totalInput, setTotalInput,
  currencyInput, setCurrencyInput,
  allocations, setAllocations,
  onAutoAllocate, onSave,
  aiBreakdownHint,
}: {
  totalInput: string
  setTotalInput: (v: string) => void
  currencyInput: string
  setCurrencyInput: (v: string) => void
  allocations: Partial<Record<BudgetCategory, number>>
  setAllocations: (a: Partial<Record<BudgetCategory, number>>) => void
  onAutoAllocate: () => void
  onSave: () => void
  aiBreakdownHint?: string
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 space-y-4">
        <h3 className="text-sm font-bold text-share-onBg">Set Up Budget</h3>

        {aiBreakdownHint && (
          <div className="rounded-xl border border-share-primary/20 bg-share-primary/5 p-3">
            <p className="text-xs font-bold text-share-primary mb-1 flex items-center gap-1">
              <MaterialIcon name="auto_awesome" className="text-[0.85rem]" />
              AI Estimate
            </p>
            <p className="text-xs text-share-onBg/80 leading-relaxed">{aiBreakdownHint}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1">Total budget</label>
            <input
              type="number"
              min={0}
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1">Currency</label>
            <input
              type="text"
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
              placeholder="EUR"
              maxLength={5}
              className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-share-onSurfaceVariant">Category allocations</label>
            <button
              type="button"
              onClick={onAutoAllocate}
              className="text-xs text-share-primary hover:underline"
            >
              Auto-split
            </button>
          </div>
          {BUDGET_CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-28 text-xs text-share-onBg flex items-center gap-1.5">
                <MaterialIcon name={CATEGORY_ICONS[cat]} className="text-[0.85rem] text-share-onSurfaceVariant" />
                {cat}
              </span>
              <input
                type="number"
                min={0}
                value={allocations[cat] ?? ""}
                onChange={(e) => setAllocations({ ...allocations, [cat]: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="flex-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-1.5 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-xl bg-share-primary py-2.5 text-sm font-bold text-share-onPrimary hover:opacity-90 transition-opacity"
        >
          Save Budget
        </button>
      </div>
    </div>
  )
}

function getDefaultPct(cat: BudgetCategory): number {
  const defaults: Record<BudgetCategory, number> = {
    Accommodation: 0.35, Food: 0.25, Transport: 0.15,
    Activities: 0.15, Shopping: 0.05, Misc: 0.05,
  }
  return defaults[cat]
}
