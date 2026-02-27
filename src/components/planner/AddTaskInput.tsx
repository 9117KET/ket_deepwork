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
        className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
    </form>
  )
}

