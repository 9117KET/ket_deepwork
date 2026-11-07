/**
 * components/planner/AddTaskInput.tsx
 *
 * The add field under a list: 48px tall, so it is a thumb-sized target, and
 * 16px text on phones, so focusing it never zooms iOS.
 *
 * A length typed at the end ("Write report 2h") is split off and set as the
 * task's duration (`extractTrailingDuration` in domain/durations.ts).
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { extractTrailingDuration } from '../../domain/durations'

export interface AddTaskOptions {
  durationMinutes?: number
}

interface AddTaskInputProps {
  placeholder?: string
  onAdd: (title: string, options?: AddTaskOptions) => void
}

export function AddTaskInput({ placeholder, onAdd }: AddTaskInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    const typed = extractTrailingDuration(trimmed)
    if (typed) onAdd(typed.title, { durationMinutes: typed.minutes })
    else onAdd(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? 'Add task'}
        className="min-h-12 w-full rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-base sm:text-sm text-share-onBg placeholder:text-share-onSurfaceDim focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
      />
    </form>
  )
}

