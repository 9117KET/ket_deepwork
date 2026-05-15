/**
 * components/finance/FinanceJournal.tsx
 *
 * Personal finance journal: write or speak money reflections, intentions,
 * and lessons. Entries are tagged and searchable.
 */

import { useState } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioTextarea } from '../ui/AudioInput'
import type { FinancialState, FinanceJournalEntry } from '../../domain/financialTypes'

function createId(): string {
  return `jnl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const PROMPTS = [
  'What money decision am I proud of this month?',
  'What would I do differently with last month\'s income?',
  'What does financial freedom feel like to me today?',
  'What invisible script about money am I still carrying?',
  'What is one thing I can automate or simplify this week?',
  'How does my spending this month reflect my values?',
  'What financial goal feels closest right now — and why?',
  'What would I do if I had €1,000 extra today?',
]

const ENTRY_TAGS = [
  'reflection', 'goal', 'lesson', 'win', 'spending', 'investing', 'mindset', 'plan',
]

interface FinanceJournalProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
}

export function FinanceJournal({ state, onUpdate }: FinanceJournalProps) {
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [isWriting, setIsWriting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [randomPrompt, setRandomPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])

  const entries = state.journalEntries ?? []

  const filtered = entries.filter((e) => {
    const matchesSearch = !searchQuery
      || e.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTag = !activeTag
      || (e.tags ?? []).includes(activeTag)
    return matchesSearch && matchesTag
  }).sort((a, b) => b.date.localeCompare(a.date))

  const allTags = [...new Set(entries.flatMap((e) => e.tags ?? []))]

  const handleSave = (inputMethod: 'voice' | 'text') => {
    const content = newContent.trim()
    if (!content) return

    const entry: FinanceJournalEntry = {
      id: createId(),
      date: todayIso(),
      content,
      inputMethod,
      tags: newTags.length > 0 ? newTags : undefined,
    }

    onUpdate((prev) => ({
      ...prev,
      journalEntries: [entry, ...(prev.journalEntries ?? [])],
    }))

    setNewContent('')
    setNewTags([])
    setIsWriting(false)
    setRandomPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)])
  }

  const handleDelete = (id: string) => {
    onUpdate((prev) => ({
      ...prev,
      journalEntries: (prev.journalEntries ?? []).filter((e) => e.id !== id),
    }))
  }

  const toggleTag = (tag: string) => {
    setNewTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="menu_book" filled className="text-share-tertiary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-share-onBg">Finance Journal</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              Write or speak your money reflections, intentions, and lessons. Research shows that journaling about finances improves decision-making and reduces money anxiety.
            </p>
          </div>
        </div>
      </section>

      {/* New entry */}
      {isWriting ? (
        <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-share-onBg">New entry — {formatDate(todayIso())}</p>
            <button type="button" onClick={() => setIsWriting(false)} className="text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant">
              <MaterialIcon name="close" className="text-[1rem]" />
            </button>
          </div>

          {/* Prompt */}
          <div className="rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-3 py-2 flex items-start gap-2">
            <MaterialIcon name="lightbulb" className="text-share-tertiary/70 flex-shrink-0 text-[1rem] mt-0.5" />
            <p className="text-xs text-share-onSurfaceVariant/70 italic">{randomPrompt}</p>
          </div>

          <AudioTextarea
            value={newContent}
            onChange={setNewContent}
            placeholder="Write freely... or hit the mic button to speak."
            rows={5}
            lang="en-US"
            append
          />

          {/* Tag picker */}
          <div>
            <p className="text-[10px] text-share-onSurfaceVariant mb-1.5">Tags (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {ENTRY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={[
                    'rounded-full px-2.5 py-1 text-[10px] transition-colors border',
                    newTags.includes(tag)
                      ? 'border-share-primary bg-share-primary/10 text-share-primary'
                      : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg',
                  ].join(' ')}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave('text')}
              disabled={!newContent.trim()}
              className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save entry
            </button>
            <button
              type="button"
              onClick={() => { setNewContent(''); setNewTags([]) }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsWriting(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-share-outlineVariant px-5 py-4 text-left hover:border-share-tertiary/50 hover:bg-share-surfaceContainerLow transition-colors"
        >
          <MaterialIcon name="edit" className="text-share-onSurfaceVariant/50 text-[1.3rem]" />
          <div className="flex-1">
            <p className="text-xs font-medium text-share-onBg">Write a new entry</p>
            <p className="text-[10px] text-share-onSurfaceVariant/60 mt-0.5 italic">{randomPrompt}</p>
          </div>
          <MaterialIcon name="mic" className="text-share-onSurfaceVariant/40 text-[1.1rem]" />
        </button>
      )}

      {/* Filter bar */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-share-onSurfaceVariant/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-share-primary focus:outline-none"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`rounded-full px-2.5 py-1 text-[10px] border transition-colors ${!activeTag ? 'border-share-primary text-share-primary' : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg'}`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`rounded-full px-2.5 py-1 text-[10px] border transition-colors ${activeTag === tag ? 'border-share-primary text-share-primary' : 'border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entries list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-share-outlineVariant p-10 text-center">
          <MaterialIcon name="menu_book" className="text-share-onSurfaceVariant/20 text-[2.5rem] mb-2" />
          <p className="text-xs text-share-onSurfaceVariant/50">No entries yet. Write your first reflection above.</p>
        </div>
      ) : (
        <div className="text-center py-8 text-share-onSurfaceVariant/50 text-xs">
          No entries match your filter.
        </div>
      )}
    </div>
  )
}

// ─── Journal entry card ────────────────────────────────────────────────────────

function JournalEntryCard({ entry, onDelete }: { entry: FinanceJournalEntry; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = entry.content.length > 200

  return (
    <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-share-onSurfaceVariant">{formatDate(entry.date)}</span>
          {entry.inputMethod === 'voice' && (
            <span className="text-[9px] rounded-full border border-share-outlineVariant text-share-onSurfaceVariant/50 px-1.5 py-0.5 flex items-center gap-1">
              <MaterialIcon name="mic" className="text-[0.7rem]" />
              Voice
            </span>
          )}
          {(entry.tags ?? []).map((tag) => (
            <span key={tag} className="text-[9px] rounded-full border border-share-outlineVariant text-share-onSurfaceVariant/50 px-1.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-share-onSurfaceVariant/30 hover:text-red-400 transition-colors flex-shrink-0"
          aria-label="Delete entry"
        >
          <MaterialIcon name="close" className="text-[0.9rem]" />
        </button>
      </div>

      <p className={`text-xs text-share-onBg leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
        {entry.content}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
