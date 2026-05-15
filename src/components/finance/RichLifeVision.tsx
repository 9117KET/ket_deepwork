/**
 * components/finance/RichLifeVision.tsx
 *
 * The Rich Life Vision screen.
 * Users write (or speak) their Rich Life vision and add structured items
 * with estimated monthly costs. Implements Ramit Sethi's foundational step:
 * define what "rich" means to YOU before touching any numbers.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioTextarea } from '../ui/AudioInput'
import { AudioInput } from '../ui/AudioInput'
import { FinanceTerm } from './FinanceTermTooltip'
import type { FinancialState, RichLifeItem, RichLifeCategory } from '../../domain/financialTypes'

function createId(): string {
  return `rli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const CATEGORY_OPTIONS: { value: RichLifeCategory; label: string; icon: string }[] = [
  { value: 'travel',      label: 'Travel',      icon: 'flight'        },
  { value: 'home',        label: 'Home',         icon: 'home'          },
  { value: 'family',      label: 'Family',       icon: 'family_restroom' },
  { value: 'experiences', label: 'Experiences',  icon: 'celebration'   },
  { value: 'health',      label: 'Health',       icon: 'fitness_center' },
  { value: 'career',      label: 'Career',       icon: 'work'          },
  { value: 'freedom',     label: 'Freedom',      icon: 'self_improvement' },
  { value: 'other',       label: 'Other',        icon: 'star'          },
]

interface RichLifeVisionProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

interface NewItemForm {
  description: string
  estimatedMonthlyCost: string
  category: RichLifeCategory
}

const EMPTY_FORM: NewItemForm = {
  description: '',
  estimatedMonthlyCost: '',
  category: 'experiences',
}

export function RichLifeVision({ state, onUpdate }: RichLifeVisionProps) {
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState<NewItemForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  const vision = state.richLifeVision ?? ''
  const items = state.richLifeItems ?? []

  const totalMonthlyCost = items.reduce((sum, item) => sum + item.estimatedMonthlyCost, 0)
  const totalAnnualCost = totalMonthlyCost * 12

  const handleVisionChange = (text: string) => {
    onUpdate((prev) => ({ ...prev, richLifeVision: text }))
  }

  const handleAddItem = () => {
    const description = newItem.description.trim()
    const cost = parseFloat(newItem.estimatedMonthlyCost)
    if (!description || isNaN(cost) || cost < 0) return

    const item: RichLifeItem = {
      id: createId(),
      description,
      estimatedMonthlyCost: cost,
      category: newItem.category,
    }

    onUpdate((prev) => ({
      ...prev,
      richLifeItems: [...(prev.richLifeItems ?? []), item],
    }))
    setNewItem(EMPTY_FORM)
    setAddingItem(false)
  }

  const handleDeleteItem = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      richLifeItems: (prev.richLifeItems ?? []).filter((i) => i.id !== id),
    }))
    if (editingId === id) setEditingId(null)
  }

  const handleItemDescriptionVoice = (text: string) => {
    setNewItem((prev) => ({ ...prev, description: text }))
  }

  const categoryIcon = (cat: RichLifeCategory) =>
    CATEGORY_OPTIONS.find((o) => o.value === cat)?.icon ?? 'star'

  const categoryLabel = (cat: RichLifeCategory) =>
    CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat

  return (
    <div className="space-y-6">
      {/* Intro card */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="favorite" filled className="text-rose-400 text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">
              What is your <FinanceTerm termId="rich-life" label="Rich Life" />?
            </h2>
            <p className="text-xs text-share-onSurfaceVariant mt-2 leading-relaxed">
              Before any spreadsheets or savings rates, Ramit Sethi starts with one question: what does a rich life look like to YOU specifically? Not a generic answer — yours. The numbers follow the vision, not the other way around.
            </p>
            <p className="text-xs text-share-onSurfaceVariant mt-2 leading-relaxed">
              Write freely. What would you do if money wasn't a constraint? Where would you live? What experiences would you have? What would you stop worrying about? There are no wrong answers.
            </p>
          </div>
        </div>
      </section>

      {/* Vision textarea */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-share-onBg">My Rich Life vision</h2>
          <span className="text-xs text-share-onSurfaceVariant/50">
            Tap the mic to speak your vision
          </span>
        </div>

        <AudioTextarea
          value={vision}
          onChange={handleVisionChange}
          placeholder="Write freely... My rich life looks like waking up without an alarm, spending summers in southern Europe, having dinner with family every Sunday, working on projects I care about, never checking my bank balance before saying yes to something that matters..."
          rows={6}
          lang="en-US"
          append
        />

        {vision.trim() && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <MaterialIcon name="check_circle" filled className="text-[0.9rem]" />
            Vision saved automatically
          </p>
        )}
      </section>

      {/* Rich Life items */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Rich Life items</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-0.5">
              Break your vision into specific things with an estimated monthly cost.
            </p>
          </div>
          {items.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-share-onSurfaceVariant">Monthly total</p>
              <p className="text-sm font-semibold text-share-onBg">
                €{totalMonthlyCost.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>

        {/* Existing items */}
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-3"
              >
                <span className="text-share-primary flex-shrink-0">
                  <MaterialIcon name={categoryIcon(item.category)} className="text-[1.1rem]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-share-onBg truncate">{item.description}</p>
                  <p className="text-[10px] text-share-onSurfaceVariant/70">
                    {categoryLabel(item.category)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-share-onBg">
                    €{item.estimatedMonthlyCost.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-share-onSurfaceVariant/50">/month</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label="Delete item"
                >
                  <MaterialIcon name="close" className="text-[1rem]" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Annual cost summary */}
        {items.length > 0 && (
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-share-onSurfaceVariant">Annual cost of your Rich Life</span>
              <span className="font-semibold text-share-primary">
                €{totalAnnualCost.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year
              </span>
            </div>
            <p className="text-[10px] text-share-onSurfaceVariant/50 mt-1">
              This is your target — your Conscious Spending Plan funds it.
            </p>
          </div>
        )}

        {/* Add item form */}
        {addingItem ? (
          <div className="rounded-lg border border-share-outlineVariant bg-share-surfaceContainer p-4 space-y-3">
            <p className="text-xs font-medium text-share-onBg">Add a Rich Life item</p>

            {/* Description with audio */}
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">What is it?</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  placeholder="e.g. Annual trip to Southern Europe"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
                />
                <AudioInput onTranscript={handleItemDescriptionVoice} lang="en-US" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewItem((p) => ({ ...p, category: opt.value }))}
                    className={[
                      'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                      newItem.category === opt.value
                        ? 'bg-share-primary text-share-onPrimary'
                        : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant hover:text-share-onBg',
                    ].join(' ')}
                  >
                    <MaterialIcon name={opt.icon} className="text-[0.9rem]" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly cost */}
            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Estimated monthly cost (EUR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-share-onSurfaceVariant">€</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={newItem.estimatedMonthlyCost}
                  onChange={(e) => setNewItem((p) => ({ ...p, estimatedMonthlyCost: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-7 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-share-primary focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-share-onSurfaceVariant/50 mt-1">
                For annual costs: divide by 12. A €1,200 yearly vacation = €100/month.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newItem.description.trim() || !newItem.estimatedMonthlyCost}
                className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add item
              </button>
              <button
                type="button"
                onClick={() => { setAddingItem(false); setNewItem(EMPTY_FORM) }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-share-outlineVariant px-4 py-3 text-xs text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors w-full"
          >
            <MaterialIcon name="add_circle" className="text-[1rem]" />
            Add a Rich Life item
          </button>
        )}
      </section>

      {/* Inspiration prompts */}
      {items.length === 0 && !addingItem && (
        <section className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-5">
          <h3 className="text-xs font-semibold text-share-onSurfaceVariant uppercase tracking-wide mb-3">
            Prompts to get you started
          </h3>
          <ul className="space-y-2 text-xs text-share-onSurfaceVariant">
            {[
              'Where do you want to travel at least once per year?',
              'What would you do if you never had to work again?',
              'What experience would you pay anything for?',
              'What do you want your home to feel like?',
              'What would you stop worrying about with financial freedom?',
              'What would you do for your family if money was not a constraint?',
            ].map((prompt) => (
              <li key={prompt} className="flex items-start gap-2">
                <span className="text-share-primary/50 flex-shrink-0 mt-0.5">→</span>
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
