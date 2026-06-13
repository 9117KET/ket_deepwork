/**
 * components/finance/ShoppingList.tsx
 *
 * Voice-driven shopping/market checklist (finance-located).
 * Add items by voice (de-DE) or text, check them off at the market, and mark
 * frequent buys as "staples" (recurring) so they refill on each shopping run.
 *
 * "New shopping run" un-checks recurring staples and removes checked one-offs,
 * leaving a fresh list of staples + any still-unchecked one-offs.
 */

import { useMemo, useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import type { FinancialState, ShoppingItem } from '../../domain/financialTypes'

function createId(): string {
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

interface ShoppingListProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function ShoppingList({ state, onUpdate }: ShoppingListProps) {
  const [text, setText] = useState('')

  const items = state.shoppingList
  const { open, checked } = useMemo(() => {
    const list = items ?? []
    return {
      open: list.filter((i) => !i.checked),
      checked: list.filter((i) => i.checked),
    }
  }, [items])

  const addItem = (raw: string, via: 'voice' | 'text') => {
    const value = raw.trim()
    if (!value) return
    // Allow several comma- or "and"-separated items from one voice utterance.
    const parts = value
      .split(/,|\bund\b|\band\b/i)
      .map((p) => p.trim())
      .filter(Boolean)
    const newItems: ShoppingItem[] = parts.map((p) => ({
      id: createId(),
      text: p,
      checked: false,
      addedVia: via,
      createdAt: new Date().toISOString(),
    }))
    if (newItems.length === 0) return
    onUpdate((prev) => ({
      ...prev,
      shoppingList: [...(prev.shoppingList ?? []), ...newItems],
    }))
    setText('')
  }

  const patch = (id: string, fields: Partial<ShoppingItem>) => {
    onUpdate((prev) => ({
      ...prev,
      shoppingList: (prev.shoppingList ?? []).map((i) => (i.id === id ? { ...i, ...fields } : i)),
    }))
  }

  const remove = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      shoppingList: (prev.shoppingList ?? []).filter((i) => i.id !== id),
    }))
  }

  const newRun = () => {
    onUpdate((prev) => ({
      ...prev,
      shoppingList: (prev.shoppingList ?? [])
        // Drop checked one-offs; keep everything else.
        .filter((i) => i.recurring || !i.checked)
        // Un-check staples so they're ready for the next run.
        .map((i) => (i.recurring ? { ...i, checked: false } : i)),
    }))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="shopping_cart" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Shopping list</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Add what you need by voice or text, then check items off at the market.
              Mark frequent buys as staples (★) so they refill on your next run.
            </p>
          </div>
        </div>
      </section>

      {/* Add row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem(text, 'text')}
          placeholder="Add item(s) — e.g. Milch, Eier, Brot"
          className="flex-1 min-w-0 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none"
        />
        <AudioInput
          onTranscript={(t) => addItem(t, 'voice')}
          lang="de-DE"
          title="Speak your shopping items"
        />
        <button
          type="button"
          onClick={() => addItem(text, 'text')}
          disabled={!text.trim()}
          className="rounded-lg border border-share-primary bg-share-primary/10 px-3 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          Add
        </button>
      </div>

      {/* Open items */}
      {open.length > 0 ? (
        <ul className="space-y-1.5">
          {open.map((item) => (
            <ShoppingRow key={item.id} item={item} onPatch={patch} onRemove={remove} />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-share-outlineVariant p-6 text-center">
          <MaterialIcon name="shopping_cart" className="text-share-onSurfaceVariant/20 text-[1.8rem] mb-1" />
          <p className="text-xs text-share-onSurfaceVariant/50">Your list is empty. Tap the mic and say what you need.</p>
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-share-onSurfaceVariant/60">
              In the cart ({checked.length})
            </p>
            <button
              type="button"
              onClick={newRun}
              className="flex items-center gap-1 text-xs text-share-primary hover:underline"
            >
              <MaterialIcon name="restart_alt" className="text-[0.9rem]" />
              New shopping run
            </button>
          </div>
          <ul className="space-y-1.5">
            {checked.map((item) => (
              <ShoppingRow key={item.id} item={item} onPatch={patch} onRemove={remove} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ShoppingRow({
  item,
  onPatch,
  onRemove,
}: {
  item: ShoppingItem
  onPatch: (id: string, fields: Partial<ShoppingItem>) => void
  onRemove: (id: string) => void
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainer px-3 py-2">
      <button
        type="button"
        onClick={() => onPatch(item.id, { checked: !item.checked })}
        className={item.checked ? 'text-emerald-400' : 'text-share-onSurfaceVariant/40 hover:text-share-onBg'}
        aria-label={item.checked ? 'Uncheck item' : 'Check item'}
      >
        <MaterialIcon
          name={item.checked ? 'check_circle' : 'radio_button_unchecked'}
          filled={item.checked}
          className="text-[1.2rem]"
        />
      </button>
      <span className={`flex-1 min-w-0 truncate text-sm ${item.checked ? 'text-share-onSurfaceVariant/60 line-through' : 'text-share-onBg'}`}>
        {item.text}
      </span>
      <button
        type="button"
        onClick={() => onPatch(item.id, { recurring: !item.recurring })}
        className={item.recurring ? 'text-amber-400' : 'text-share-onSurfaceVariant/30 hover:text-amber-400'}
        title={item.recurring ? 'Staple — refills each run' : 'Mark as staple'}
        aria-label="Toggle staple"
      >
        <MaterialIcon name={item.recurring ? 'star' : 'star_border'} filled={item.recurring} className="text-[1rem]" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors"
        aria-label="Remove item"
      >
        <MaterialIcon name="close" className="text-[0.9rem]" />
      </button>
    </li>
  )
}
