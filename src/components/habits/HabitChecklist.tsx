/**
 * components/habits/HabitChecklist.tsx
 *
 * Daily habit checklist card (Atomic Habits integration).
 * Shows an identity statement, today's habit completions, per-habit streaks,
 * and never-miss-twice alerts for at-risk habits.
 */

import { useState } from 'react'
import type React from 'react'
import type { HabitDefinition } from '../../domain/types'

interface HabitChecklistProps {
  habits: HabitDefinition[]
  completions: Record<string, boolean>
  streaks: Record<string, number>
  atRiskHabitIds: Set<string>
  identityStatement: string
  onToggle: (habitId: string, value: boolean) => void
  onSetIdentity: (value: string) => void
  onEditHabits: () => void
}

export function HabitChecklist({
  habits,
  completions,
  streaks,
  atRiskHabitIds,
  identityStatement,
  onToggle,
  onSetIdentity,
  onEditHabits,
}: HabitChecklistProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityDraft, setIdentityDraft] = useState('')

  const doneCount = habits.filter((h) => completions[h.id] === true).length
  const totalCount = habits.length

  const handleIdentityClick = () => {
    setIdentityDraft(identityStatement)
    setEditingIdentity(true)
  }

  const handleIdentityBlur = () => {
    setEditingIdentity(false)
    onSetIdentity(identityDraft.trim())
  }

  const handleIdentityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-left text-sm font-semibold text-slate-100 hover:text-sky-300"
            aria-expanded={!collapsed}
          >
            Daily Habits
          </button>
          <span className="text-xs text-slate-500">
            {doneCount}/{totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onEditHabits}
          className="text-xs text-slate-500 hover:text-sky-400"
          title="Edit habit list"
        >
          Edit
        </button>
      </header>

      {!collapsed && (
        <>
          {/* Identity statement */}
          <div className="mb-3">
            {editingIdentity ? (
              <input
                autoFocus
                type="text"
                value={identityDraft}
                onChange={(e) => setIdentityDraft(e.target.value)}
                onBlur={handleIdentityBlur}
                onKeyDown={handleIdentityKeyDown}
                placeholder="I am someone who..."
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm italic text-slate-200 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={handleIdentityClick}
                className="w-full text-left text-sm italic text-slate-400 hover:text-slate-200"
                title="Click to set your identity statement"
              >
                {identityStatement || (
                  <span className="text-slate-600">Set your identity...</span>
                )}
              </button>
            )}
          </div>

          {/* Habit list */}
          <ul className="space-y-1.5">
            {habits.map((habit) => {
              const done = completions[habit.id] === true
              const streak = streaks[habit.id] ?? 0
              const atRisk = atRiskHabitIds.has(habit.id) && !done

              return (
                <li
                  key={habit.id}
                  className={`flex items-start gap-2 rounded px-1.5 py-1 ${
                    atRisk
                      ? 'border border-amber-500/40 bg-amber-500/10'
                      : 'border border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(habit.id, !done)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                      done
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-slate-600 bg-slate-800 text-transparent hover:border-sky-500'
                    }`}
                    aria-label={done ? `Uncheck ${habit.label}` : `Check ${habit.label}`}
                  >
                    {done && '✓'}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm leading-tight ${
                        done ? 'text-slate-500 line-through' : 'text-slate-200'
                      }`}
                    >
                      {habit.label}
                    </span>
                    {habit.stackAnchor && (
                      <p className="text-xs text-slate-600">After: {habit.stackAnchor}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {atRisk && (
                      <span
                        className="text-xs text-amber-400"
                        title="You missed yesterday — don't miss twice"
                      >
                        ⚠
                      </span>
                    )}
                    {streak > 0 && (
                      <span className="text-xs text-orange-400" title={`${streak}-day streak`}>
                        🔥{streak}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
