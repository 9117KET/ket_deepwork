/**
 * components/finance/FinanceLearn.tsx
 *
 * Educational glossary of German personal finance terms.
 * Full definitions with cross-references.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { GLOSSARY } from './financeGlossary'
import type { GlossaryTerm } from './financeGlossary'

export function FinanceLearn() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = GLOSSARY.filter(
    (t) =>
      t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.shortDef.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="school" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Financial Glossary</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              German personal finance terms explained clearly. No jargon, no fluff - just what you need to understand your money system. All amounts and rates are current as of 2025/2026.
            </p>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative">
        <MaterialIcon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-share-onSurfaceVariant/50"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search terms..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-share-primary focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant"
          >
            <MaterialIcon name="close" className="text-[1rem]" />
          </button>
        )}
      </div>

      {/* Terms list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-share-onSurfaceVariant/50 text-sm">
          No terms match "{searchQuery}"
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((term) => (
            <GlossaryCard
              key={term.id}
              term={term}
              isExpanded={expandedId === term.id}
              onToggle={() => setExpandedId((prev) => (prev === term.id ? null : term.id))}
            />
          ))}
        </ul>
      )}

      {/* Resources section */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <h2 className="text-sm font-semibold text-share-onBg mb-3">Go deeper</h2>
        <ul className="space-y-3">
          {RESOURCES.map((r) => (
            <li key={r.label} className="flex items-start gap-3">
              <MaterialIcon name={r.icon} className="text-share-primary/70 flex-shrink-0 mt-0.5 text-[1rem]" />
              <div>
                <p className="text-xs font-medium text-share-onBg">{r.label}</p>
                <p className="text-xs text-share-onSurfaceVariant/70 mt-0.5">{r.description}</p>
                <p className="text-[10px] text-share-onSurfaceVariant/40 mt-0.5">{r.url}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─── Glossary card ─────────────────────────────────────────────────────────────

function GlossaryCard({
  term,
  isExpanded,
  onToggle,
}: {
  term: GlossaryTerm
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <li className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-share-surfaceContainer transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-share-onBg">{term.term}</p>
          <p className="text-xs text-share-onSurfaceVariant mt-0.5 leading-relaxed">
            {term.shortDef}
          </p>
        </div>
        <MaterialIcon
          name={isExpanded ? 'expand_less' : 'expand_more'}
          className="text-share-onSurfaceVariant/50 flex-shrink-0 mt-0.5"
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-share-outlineVariant/40">
          <p className="text-xs text-share-onSurfaceVariant leading-relaxed mt-3 whitespace-pre-line">
            {term.fullDef}
          </p>
          {term.related && term.related.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-share-onSurfaceVariant/50 mr-1 mt-0.5">Related:</span>
              {term.related.map((relId) => {
                const relTerm = GLOSSARY.find((t) => t.id === relId)
                if (!relTerm) return null
                return (
                  <span
                    key={relId}
                    className="text-[10px] rounded-full border border-share-outlineVariant px-2 py-0.5 text-share-onSurfaceVariant/70"
                  >
                    {relTerm.term}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ─── External resources ────────────────────────────────────────────────────────

const RESOURCES = [
  {
    icon: 'library_books',
    label: 'Finanztip (finanztip.de)',
    description: 'Non-profit, independent German personal finance guides. Updated regularly. The most trusted source for German financial decisions.',
    url: 'finanztip.de',
  },
  {
    icon: 'play_circle',
    label: 'Finanzfluss (YouTube / Podcast)',
    description: 'Germany\'s leading personal finance channel. Clear explainers on ETFs, brokers, taxes, and investing. Highly recommended for beginners.',
    url: 'finanzfluss.de',
  },
  {
    icon: 'menu_book',
    label: 'I Will Teach You to Be Rich (Personal Finance Book)',
    description: 'The book this planner is built on. 6-week program. Second edition (2019) is the definitive version. Read chapters 1-5 and 8-10 first.',
    url: 'iwillteachyoutoberich.com',
  },
  {
    icon: 'search',
    label: 'JustETF (justetf.com)',
    description: 'ETF screener for German investors. Compare TERs, check ISIN codes, compare Sparplan availability across brokers.',
    url: 'justetf.com/en',
  },
  {
    icon: 'forum',
    label: 'Reddit r/Finanzen',
    description: 'Active German personal finance community. Wiki is excellent for beginners.',
    url: 'reddit.com/r/Finanzen',
  },
  {
    icon: 'calculate',
    label: 'Portfolio Performance (open source)',
    description: 'Free desktop app for tracking your entire depot - returns, Vorabpauschale, dividends, benchmarks. The standard tool for German ETF investors.',
    url: 'portfolio-performance.info',
  },
]
