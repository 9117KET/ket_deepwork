/**
 * components/habits/MobileHabitsPanel.tsx
 *
 * The phone's Habits tab: who you are trying to be, what you have ticked
 * today, and the last seven days of each.
 *
 * The sidebar's `HabitChecklist` is a card among cards — it collapses, it sits
 * under a heading, it is one of nine things in a column. On a phone Habits is
 * the whole screen, so it gets a screen's worth of shape: the identity
 * statement as a real header rather than a line of small print, and seven dots
 * under every row instead of a bare streak number.
 *
 * The dots are the addition that matters. A streak count tells you the length
 * of a run but not whether you are in one — "0" reads the same for a habit you
 * dropped this morning and one you have never started. `computeHabitWeek` in
 * `domain/habitWeek.ts` separates those, and this row shows the difference:
 * amber for a chain just broken, grey for one that was never there.
 *
 * See `docs/design/mobile/Habits.dc.html`. The full month grid stays in Review.
 */

import { useState } from 'react'
import type React from 'react'
import { computeHabitWeek } from '../../domain/habitWeek'
import type { DayState, HabitDefinition } from '../../domain/types'

interface MobileHabitsPanelProps {
  habits: HabitDefinition[]
  /** Every day, so each row can look back a week. */
  days: Record<string, DayState | undefined>
  /** The day being shown — the last dot in each row. */
  selectedDay: string
  completions: Record<string, boolean>
  streaks: Record<string, number>
  atRiskHabitIds: Set<string>
  identityStatement: string
  onToggle: (habitId: string, value: boolean) => void
  onSetIdentity: (value: string) => void
  onEditHabits: () => void
  /** On an active trip, never-miss-twice alerts are suppressed. */
  travelingToday?: boolean
}

const DOT_CLASS: Record<string, string> = {
  done: 'bg-share-primary',
  broke: 'bg-share-tertiary',
  missed: 'bg-share-outlineVariant/40',
}

export function MobileHabitsPanel({
  habits,
  days,
  selectedDay,
  completions,
  streaks,
  atRiskHabitIds,
  identityStatement,
  onToggle,
  onSetIdentity,
  onEditHabits,
  travelingToday = false,
}: MobileHabitsPanelProps) {
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityDraft, setIdentityDraft] = useState('')

  const doneCount = habits.filter((h) => completions[h.id] === true).length

  const commitIdentity = () => {
    setEditingIdentity(false)
    onSetIdentity(identityDraft.trim())
  }

  const onIdentityKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
  }

  return (
    <div className="mt-3 lg:hidden" data-testid="mobile-habits">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-shareHeadline text-xl font-extrabold text-share-onBg">Habits</h2>
          <p className="mt-1 text-xs text-share-onSurfaceVariant">
            {doneCount} of {habits.length} today
          </p>
        </div>
        <button
          type="button"
          onClick={onEditHabits}
          className="touch-target rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 text-xs text-share-onSurfaceVariant"
        >
          Edit
        </button>
      </div>

      {/* Identity first, because in Atomic Habits the checks are evidence for
          it rather than the other way round. */}
      <div className="mt-4 rounded-2xl border-l-2 border-share-primary bg-share-surfaceContainerLow p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
          I am
        </p>
        {editingIdentity ? (
          <input
            autoFocus
            value={identityDraft}
            onChange={(e) => setIdentityDraft(e.target.value)}
            onBlur={commitIdentity}
            onKeyDown={onIdentityKey}
            placeholder="someone who does the hard thing first"
            aria-label="Identity statement"
            className="mt-1.5 w-full rounded bg-transparent font-shareHeadline text-[15px] font-bold text-share-onBg outline-none placeholder:font-normal placeholder:text-share-onSurfaceVariant/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setIdentityDraft(identityStatement)
              setEditingIdentity(true)
            }}
            className="mt-1.5 w-full text-left font-shareHeadline text-[15px] font-bold leading-snug text-share-onBg"
          >
            {identityStatement || (
              <span className="font-normal text-share-onSurfaceVariant/50">
                someone who… (tap to set)
              </span>
            )}
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {habits.map((habit) => {
          const isDone = completions[habit.id] === true
          const atRisk = !travelingToday && atRiskHabitIds.has(habit.id)
          const week = computeHabitWeek(days, habit.id, selectedDay)
          return (
            <div
              key={habit.id}
              className={`flex items-center gap-3 rounded-xl bg-share-surfaceContainerLow p-3 ${
                atRisk ? 'border border-share-tertiary' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(habit.id, !isDone)}
                aria-label={`${isDone ? 'Uncheck' : 'Check'} ${habit.label}`}
                aria-pressed={isDone}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                  isDone
                    ? 'bg-share-primary text-share-onPrimary'
                    : 'border-[1.5px] border-share-outlineVariant'
                }`}
              >
                {isDone && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-share-onBg">{habit.label}</span>
                  {atRisk && (
                    <span className="text-[10px] font-bold text-share-tertiary">
                      missed yesterday
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex gap-1" aria-hidden="true">
                  {week.map((d) => (
                    <span
                      key={d.iso}
                      className={`h-1.5 flex-1 rounded-full ${DOT_CLASS[d.state]}`}
                    />
                  ))}
                </div>
              </div>

              <span className="shrink-0 text-xs font-bold tabular-nums text-share-onSurfaceVariant">
                {streaks[habit.id] ?? 0}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-[11px] text-share-onSurfaceVariant/70">
        Last 7 days. The full month grid lives in Review.
      </p>
    </div>
  )
}
