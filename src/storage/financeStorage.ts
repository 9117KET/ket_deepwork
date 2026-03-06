/**
 * storage/financeStorage.ts
 *
 * Persistence for the Financial Planner. Uses a dedicated localStorage key
 * so planner state is unchanged. Same auth pattern as planner: guest = local only;
 * Supabase sync can be added later with a separate table.
 */

import { useEffect, useState } from 'react'
import type { FinanceState } from '../domain/financeTypes'
import { EMPTY_FINANCE_STATE } from '../domain/financeTypes'

const STORAGE_KEY = 'deepblock_finance_v1'
const SCHEMA_VERSION = 1

interface PersistedFinanceV1 {
  version: number
  state: FinanceState
}

function safeParse(raw: string | null): PersistedFinanceV1 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedFinanceV1
    if (typeof parsed.version !== 'number' || typeof parsed.state !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function migrate(persisted: PersistedFinanceV1 | null): FinanceState {
  if (!persisted) return EMPTY_FINANCE_STATE
  if (persisted.version === SCHEMA_VERSION) {
    return persisted.state
  }
  return persisted.state ?? EMPTY_FINANCE_STATE
}

function readInitialFinanceState(): FinanceState {
  if (typeof window === 'undefined') return EMPTY_FINANCE_STATE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  return migrate(parsed)
}

function writeFinanceState(state: FinanceState): void {
  if (typeof window === 'undefined') return
  const wrapped: PersistedFinanceV1 = {
    version: SCHEMA_VERSION,
    state,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
  } catch {
    // Ignore quota / private mode errors
  }
}

export function usePersistentFinanceState(): [
  FinanceState,
  (updater: (prev: FinanceState) => FinanceState) => void,
] {
  const [state, setState] = useState<FinanceState>(readInitialFinanceState)

  useEffect(() => {
    writeFinanceState(state)
  }, [state])

  const update = (updater: (prev: FinanceState) => FinanceState) => {
    setState((prev) => updater(prev))
  }

  return [state, update]
}
