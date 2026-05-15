/**
 * storage/financialStorage.ts
 *
 * Persistence for FinancialState.
 * Phase 1: localStorage only. Phase 2 will add Convex sync.
 */

import { useState, useEffect, useRef } from 'react'
import type { FinancialState } from '../domain/financialTypes'
import { DEFAULT_BIG_WINS, DEFAULT_AUTOMATIONS } from '../domain/financialTypes'

const STORAGE_KEY = 'deepblock_finance_v1'
const SCHEMA_VERSION = 1

interface PersistedFinance {
  version: number
  state: FinancialState
}

const EMPTY_STATE: FinancialState = {
  bigWins: DEFAULT_BIG_WINS.map((w) => ({ ...w })),
  automations: DEFAULT_AUTOMATIONS.map((a) => ({ ...a })),
  taxSettings: {
    freistellungsauftragTotal: 1000,
    freistellungsauftragAllocated: 0,
    basiszins: 2.53,
    kirchensteuer: false,
  },
  fireSettings: {
    expectedAnnualReturnPct: 7,
    inflationPct: 2.5,
    swrPct: 3.5,
    includeRente: true,
  },
}

function safeParse(raw: string | null): PersistedFinance | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedFinance
    if (typeof parsed.version !== 'number' || typeof parsed.state !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function readState(): FinancialState {
  if (typeof window === 'undefined') return EMPTY_STATE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  if (!parsed) return EMPTY_STATE
  // Seed defaults for newly added fields
  const s = parsed.state
  return {
    ...s,
    bigWins: s.bigWins ?? DEFAULT_BIG_WINS.map((w) => ({ ...w })),
    automations: s.automations ?? DEFAULT_AUTOMATIONS.map((a) => ({ ...a })),
    taxSettings: s.taxSettings ?? EMPTY_STATE.taxSettings,
    fireSettings: { ...EMPTY_STATE.fireSettings, ...s.fireSettings },
  }
}

function writeState(state: FinancialState): void {
  if (typeof window === 'undefined') return
  const wrapped: PersistedFinance = { version: SCHEMA_VERSION, state }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped))
  } catch {
    // ignore quota / private mode errors
  }
}

export function useFinancialState(): [
  FinancialState,
  (updater: (prev: FinancialState) => FinancialState) => void,
] {
  const [state, setState] = useState<FinancialState>(() => readState())
  const pendingWrite = useRef(false)

  useEffect(() => {
    if (pendingWrite.current) {
      writeState(state)
      pendingWrite.current = false
    }
  }, [state])

  const update = (updater: (prev: FinancialState) => FinancialState) => {
    pendingWrite.current = true
    setState((prev) => updater(prev))
  }

  return [state, update]
}
