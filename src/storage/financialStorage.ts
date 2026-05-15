/**
 * storage/financialStorage.ts
 *
 * Persistence for FinancialState.
 * localStorage as primary (instant, offline) + Convex sync when authenticated.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'
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

function seedDefaults(s: FinancialState): FinancialState {
  return {
    ...s,
    bigWins: s.bigWins ?? DEFAULT_BIG_WINS.map((w) => ({ ...w })),
    automations: s.automations ?? DEFAULT_AUTOMATIONS.map((a) => ({ ...a })),
    taxSettings: s.taxSettings ?? EMPTY_STATE.taxSettings,
    fireSettings: { ...EMPTY_STATE.fireSettings, ...s.fireSettings },
  }
}

function readState(): FinancialState {
  if (typeof window === 'undefined') return EMPTY_STATE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = safeParse(raw)
  return parsed ? seedDefaults(parsed.state) : EMPTY_STATE
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
  const { isAuthenticated } = useConvexAuth()
  const [state, setState] = useState<FinancialState>(() => readState())
  const remoteDoc = useQuery(api.financialSettings.get, isAuthenticated ? {} : 'skip')
  const saveToConvex = useMutation(api.financialSettings.save)

  const initialSyncDone = useRef(false)
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    writeState(state)
  }, [state])

  // On first auth, merge remote state (remote wins for fields that exist remotely)
  useEffect(() => {
    if (!isAuthenticated || remoteDoc === undefined || initialSyncDone.current) return
    initialSyncDone.current = true
    if (remoteDoc?.data && typeof remoteDoc.data === 'object') {
      const remote = seedDefaults(remoteDoc.data as FinancialState)
      const hasRemoteContent =
        remote.csp?.monthlyNetIncome ||
        (remote.richLifeVision?.trim() ?? '') !== '' ||
        (remote.portfolio?.length ?? 0) > 0
      if (hasRemoteContent) {
        // Use queueMicrotask so setState is not called synchronously inside the effect
        queueMicrotask(() => setState(() => remote))
      }
    }
  }, [remoteDoc, isAuthenticated])

  // Mark initial sync done even if remote has no data yet
  useEffect(() => {
    if (!isAuthenticated || remoteDoc === undefined) return
    if (!initialSyncDone.current) {
      initialSyncDone.current = true
    }
  }, [remoteDoc, isAuthenticated])

  // Debounced sync to Convex after every state change (when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return
    if (syncTimeout.current) clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => {
      void saveToConvex({ data: stateRef.current })
    }, 1200)
    return () => {
      if (syncTimeout.current) clearTimeout(syncTimeout.current)
    }
  }, [state, isAuthenticated, saveToConvex])

  const update = (updater: (prev: FinancialState) => FinancialState) => {
    setState((prev) => updater(prev))
  }

  return [state, update]
}
