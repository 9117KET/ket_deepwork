/**
 * components/planner/AddTaskInput.tsx
 *
 * Compact input used to add a new task within a section.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

interface AddTaskInputProps {
  placeholder?: string
  onAdd: (title: string) => void
}

export function AddTaskInput({ placeholder, onAdd }: AddTaskInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? 'Add task'}
        className="w-full rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-1.5 text-base sm:text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
      />
    </form>
  )
}

