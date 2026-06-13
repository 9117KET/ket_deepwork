/**
 * components/finance/SavingsGoals.tsx
 *
 * Named savings goals with progress tracking.
 * Each goal has a target, current amount, target date, and monthly contribution.
 * Calculates months to goal and on-track/behind status.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import type { FinancialState, SavingsGoal } from '../../domain/financialTypes'

function createId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function monthsToGoal(goal: SavingsGoal): number | null {
  const remaining = goal.targetAmount - goal.currentAmount
  if (remaining <= 0) return 0
  if (goal.monthlyContribution <= 0) return null
  return Math.ceil(remaining / goal.monthlyContribution)
}

function monthsUntilDate(targetDate: string): number | null {
  if (!targetDate) return null
  const target = new Date(targetDate)
  const now = new Date()
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(0, diff)
}

function formatMonths(months: number): string {
  if (months === 0) return 'Reached!'
  if (months < 12) return `${months}mo`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m > 0 ? `${y}yr ${m}mo` : `${y}yr`
}

const GOAL_ICONS = [
  'flag', 'flight', 'home', 'directions_car', 'diamond',
  'health_and_safety', 'menu_book', 'school', 'beach_access', 'laptop',
  'piano', 'landscape', 'pets', 'child_care',
  'diversity_3', 'volunteer_activism', 'favorite', 'savings',
]

/**
 * Life-ambition goals come first — set these at the start of a career so every
 * month's saving has a clear purpose. Followed by common German savings goals.
 */
const PRESET_GOALS = [
  { label: 'Support my family', icon: 'diversity_3', targetAmount: 12000, monthlyContribution: 200 },
  { label: 'Marriage / Wedding', icon: 'favorite', targetAmount: 20000, monthlyContribution: 400 },
  { label: 'Car (Auto)', icon: 'directions_car', targetAmount: 15000, monthlyContribution: 300 },
  { label: 'House / Down payment', icon: 'home', targetAmount: 50000, monthlyContribution: 500 },
  { label: 'Notgroschen (Emergency Fund)', icon: 'shield', targetAmount: 9000, monthlyContribution: 200 },
  { label: 'Urlaub (Vacation)', icon: 'flight', targetAmount: 2000, monthlyContribution: 150 },
  { label: 'Laptop / Tech', icon: 'laptop', targetAmount: 1500, monthlyContribution: 100 },
]

interface SavingsGoalsProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface NewGoalForm {
  label: string
  icon: string
  targetAmount: string
  currentAmount: string
  monthlyContribution: string
  targetDate: string
}

const EMPTY_FORM: NewGoalForm = {
  label: '',
  icon: '🎯',
  targetAmount: '',
  currentAmount: '0',
  monthlyContribution: '',
  targetDate: '',
}

export function SavingsGoals({ state, onUpdate }: SavingsGoalsProps) {
  const [addingGoal, setAddingGoal] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [form, setForm] = useState<NewGoalForm>(EMPTY_FORM)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const goals = state.savingsGoals ?? []
  const totalTargeted = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0)
  const totalMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0)
  const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount).length

  const handleAdd = () => {
    const label = form.label.trim()
    const target = parseFloat(form.targetAmount)
    const current = parseFloat(form.currentAmount) || 0
    const monthly = parseFloat(form.monthlyContribution) || 0
    if (!label || isNaN(target) || target <= 0) return

    const goal: SavingsGoal = {
      id: createId(),
      label,
      icon: form.icon,
      targetAmount: target,
      currentAmount: current,
      monthlyContribution: monthly,
      targetDate: form.targetDate || undefined,
    }

    onUpdate((prev) => ({ ...prev, savingsGoals: [...(prev.savingsGoals ?? []), goal] }))
    setForm(EMPTY_FORM)
    setAddingGoal(false)
    setShowPresets(false)
  }

  const handlePreset = (preset: typeof PRESET_GOALS[number]) => {
    setForm({
      label: preset.label,
      icon: preset.icon,
      targetAmount: String(preset.targetAmount),
      currentAmount: '0',
      monthlyContribution: String(preset.monthlyContribution),
      targetDate: '',
    })
    setShowPresets(false)
    setAddingGoal(true)
  }

  const handleUpdateCurrent = (id: string, val: string) => {
    const amount = parseFloat(val)
    onUpdate((prev) => ({
      ...prev,
      savingsGoals: (prev.savingsGoals ?? []).map((g) =>
        g.id === id ? { ...g, currentAmount: isNaN(amount) ? 0 : amount } : g,
      ),
    }))
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      savingsGoals: (prev.savingsGoals ?? []).filter((g) => g.id !== id),
    }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="savings" filled className="text-violet-400 text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Life-ambition goals</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Define what you're saving toward at the start of your career — supporting your
              family, marriage, a car, a house — so every month's saving has a purpose. Named
              goals make abstract saving concrete and harder to raid.
            </p>
          </div>
        </div>
      </section>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-3 text-center">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Saved</p>
            <p className="text-sm font-bold text-violet-400 mt-0.5">
              €{totalSaved.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-3 text-center">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Target</p>
            <p className="text-sm font-bold text-share-onBg mt-0.5">
              €{totalTargeted.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-3 text-center">
            <p className="text-[10px] text-share-onSurfaceVariant uppercase tracking-wide">Monthly</p>
            <p className="text-sm font-bold text-share-onBg mt-0.5">
              €{totalMonthly.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length > 0 && (
        <div className="space-y-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onUpdateCurrent={(v) => handleUpdateCurrent(goal.id, v)}
              onDelete={() => handleDelete(goal.id)}
            />
          ))}
          {completedGoals > 0 && (
            <p className="text-xs text-emerald-400 text-center">
              {completedGoals} goal{completedGoals > 1 ? 's' : ''} completed!
            </p>
          )}
        </div>
      )}

      {/* Preset picker */}
      {showPresets && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-share-onBg">Pick a goal to start</p>
            <button type="button" onClick={() => setShowPresets(false)} className="text-share-onSurfaceVariant/50 text-xs">✕</button>
          </div>
          {PRESET_GOALS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePreset(p)}
              className="w-full text-left flex items-center gap-3 rounded-lg border border-share-outlineVariant bg-share-surfaceContainer hover:bg-share-surfaceContainerHigh p-3 transition-colors"
            >
              <span className="text-share-primary flex-shrink-0">
                <MaterialIcon name={p.icon} className="text-[1.3rem]" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-medium text-share-onBg">{p.label}</p>
                <p className="text-[10px] text-share-onSurfaceVariant/60">
                  Target €{p.targetAmount.toLocaleString('de-DE')} · €{p.monthlyContribution}/mo
                </p>
              </div>
            </button>
          ))}
          <button type="button" onClick={() => { setShowPresets(false); setAddingGoal(true) }} className="text-xs text-share-primary hover:underline">
            + Custom goal instead
          </button>
        </div>
      )}

      {/* Add form */}
      {addingGoal && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
          <p className="text-xs font-semibold text-share-onBg">Add savings goal</p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIconPicker((v) => !v)}
              className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer px-3 py-2 hover:bg-share-surfaceContainerHigh transition-colors text-share-primary"
            >
              <MaterialIcon name={form.icon || 'flag'} className="text-[1.4rem]" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Goal name (e.g. Urlaub Thailand)"
                autoFocus
                className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
              />
              <AudioInput onTranscript={(t) => setForm((p) => ({ ...p, label: t }))} lang="en-US" />
            </div>
          </div>

          {showIconPicker && (
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-share-outlineVariant bg-share-surfaceContainerHighest">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => { setForm((p) => ({ ...p, icon })); setShowIconPicker(false) }}
                  className={`rounded p-1.5 hover:bg-share-surfaceContainerHigh transition-colors ${form.icon === icon ? 'bg-share-primary/20 text-share-primary' : 'text-share-onSurfaceVariant'}`}
                >
                  <MaterialIcon name={icon} className="text-[1.2rem]" />
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Target (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.targetAmount}
                  onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))}
                  placeholder="5000"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Saved so far (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.currentAmount}
                  onChange={(e) => setForm((p) => ({ ...p, currentAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Monthly (€)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyContribution}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyContribution: e.target.value }))}
                  placeholder="100"
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-share-onSurfaceVariant mb-1">Target date (optional)</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((p) => ({ ...p, targetDate: e.target.value }))}
              className="rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!form.label.trim() || !form.targetAmount}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save goal
            </button>
            <button
              type="button"
              onClick={() => { setAddingGoal(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-share-outlineVariant/40 px-4 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add buttons */}
      {!addingGoal && !showPresets && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPresets(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="bolt" className="text-[1rem]" />
            Quick add
          </button>
          <button
            type="button"
            onClick={() => setAddingGoal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="add_circle" className="text-[1rem]" />
            Custom goal
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onUpdateCurrent,
  onDelete,
}: {
  goal: SavingsGoal
  onUpdateCurrent: (v: string) => void
  onDelete: () => void
}) {
  const [editingCurrent, setEditingCurrent] = useState(false)
  const [currentInput, setCurrentInput] = useState(goal.currentAmount.toString())

  const pct = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const months = monthsToGoal(goal)
  const dateMonths = goal.targetDate ? monthsUntilDate(goal.targetDate) : null
  const isCompleted = pct >= 100

  const isOnTrack = months !== null && dateMonths !== null
    ? months <= dateMonths
    : true
  const isBehind = months !== null && dateMonths !== null && months > dateMonths

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-share-outlineVariant bg-share-surfaceContainerLow'}`}>
      <div className="flex items-start gap-3">
        <span className="text-share-primary flex-shrink-0 mt-0.5">
          <MaterialIcon name={goal.icon ?? 'flag'} className="text-[1.4rem]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-share-onBg">{goal.label}</p>
            <button
              type="button"
              onClick={onDelete}
              className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
              aria-label="Delete goal"
            >
              <MaterialIcon name="close" className="text-[0.9rem]" />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isCompleted && (
              <span className="text-[10px] rounded-full border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5">
                Completed!
              </span>
            )}
            {isBehind && !isCompleted && (
              <span className="text-[10px] rounded-full border border-amber-500/40 text-amber-400 px-1.5 py-0.5">
                Behind schedule
              </span>
            )}
            {isOnTrack && !isCompleted && months !== null && dateMonths !== null && (
              <span className="text-[10px] rounded-full border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5">
                On track
              </span>
            )}
            {months !== null && !isCompleted && (
              <span className="text-[10px] text-share-onSurfaceVariant/60">
                {formatMonths(months)} to go at €{goal.monthlyContribution}/mo
              </span>
            )}
            {goal.targetDate && !isCompleted && (
              <span className="text-[10px] text-share-onSurfaceVariant/60">
                by {new Date(goal.targetDate).toLocaleDateString('en-DE', { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-share-onSurfaceVariant">
            {editingCurrent ? (
              <div className="flex items-center gap-1.5">
                <span>€</span>
                <input
                  type="number"
                  min="0"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onUpdateCurrent(currentInput); setEditingCurrent(false) }
                  }}
                  autoFocus
                  className="w-20 rounded border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-0.5 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
                />
                <button type="button" onClick={() => { onUpdateCurrent(currentInput); setEditingCurrent(false) }} className="text-[10px] text-share-primary hover:underline">
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCurrentInput(goal.currentAmount.toString()); setEditingCurrent(true) }}
                className="hover:text-share-primary transition-colors"
              >
                €{goal.currentAmount.toLocaleString('de-DE')} saved
              </button>
            )}
          </span>
          <span className="font-medium text-share-onBg">
            €{goal.targetAmount.toLocaleString('de-DE')} target · {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-share-surfaceContainerHighest overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : isBehind ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!isCompleted && remaining > 0 && (
          <p className="text-[10px] text-share-onSurfaceVariant/50 mt-0.5">
            €{remaining.toLocaleString('de-DE')} remaining
          </p>
        )}
      </div>
    </div>
  )
}
