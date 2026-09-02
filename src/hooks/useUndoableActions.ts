/**
 * hooks/useUndoableActions.ts
 *
 * One step of undo for the planner's destructive actions.
 *
 * Deliberately one step, and deliberately short-lived. The failure this exists
 * for is "I deleted that by mistake, give it back" in the seconds right after —
 * not a document history. A deep stack would need every action to describe its
 * own inverse; a snapshot answers the real question with a fraction of the
 * machinery.
 *
 * The snapshot is nearly free because the planner updates state immutably: the
 * previous `AppState` object already exists and is about to be dropped, so
 * holding a reference to it costs a pointer rather than a copy of the history.
 *
 * The part that matters is staleness. Restoring a whole snapshot would happily
 * revert work done *after* the mistake — the exact sin this feature exists to
 * prevent — so the offer is withdrawn the moment anything else touches the
 * state, rather than silently clobbering it. That is why the hook owns the
 * update gateway: a change it cannot see is a change that could be destroyed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from '../domain/types'

/** How long an undo offer stays on screen. */
export const UNDO_WINDOW_MS = 12_000

export interface UndoEntry {
  /** What was done, phrased for a toast: "Deleted “Study German”". */
  label: string
  /** The state to go back to. */
  before: AppState
  /**
   * The mutation count this offer is valid against. Any further change moves
   * the counter past it and voids the offer.
   */
  validAtVersion: number
}

/**
 * An offer is stale once anything else has changed the state.
 *
 * Exported and tested on its own because getting it wrong fails silently: a
 * stale undo does not error, it quietly destroys whatever came after.
 */
export function isUndoStale(entry: UndoEntry | null, currentVersion: number): boolean {
  if (!entry) return true
  return entry.validAtVersion !== currentVersion
}

export interface UndoableActions {
  /**
   * The update gateway the planner must use for **every** mutation, undoable
   * or not. Anything routed around it is invisible to the staleness check.
   */
  update: (updater: (prev: AppState) => AppState) => void
  /** The live offer, or null when there is nothing to undo. */
  entry: UndoEntry | null
  /** Wrap a destructive action so the state before it can be restored. */
  run: (label: string, action: () => void) => void
  /** Put the state back. No-op once stale. */
  undo: () => void
  /** Withdraw the offer without restoring. */
  dismiss: () => void
}

export function useUndoableActions(
  appState: AppState,
  baseUpdate: (updater: (prev: AppState) => AppState) => void,
): UndoableActions {
  const [entry, setEntry] = useState<UndoEntry | null>(null)

  /**
   * Counts every state change. A ref because it has to move synchronously as
   * handlers fire, before React has re-rendered anything — `run` reads it
   * immediately after invoking an action.
   */
  const versionRef = useRef(0)

  /**
   * Kept fresh so the callbacks below do not depend on `appState`, which would
   * rebuild every wrapped handler on each keystroke.
   *
   * Synced in an effect rather than during render: both are only read from
   * event handlers, which run after commit, so the effect has always landed by
   * then.
   */
  const stateRef = useRef(appState)
  const entryRef = useRef<UndoEntry | null>(entry)
  useEffect(() => {
    stateRef.current = appState
  }, [appState])
  useEffect(() => {
    entryRef.current = entry
  }, [entry])

  const update = useCallback(
    (updater: (prev: AppState) => AppState) => {
      versionRef.current += 1
      baseUpdate(updater)
    },
    [baseUpdate],
  )

  const run = useCallback((label: string, action: () => void) => {
    const before = stateRef.current
    action()
    // The action may have made several updates; whatever the counter reads now
    // is the only state this offer is valid against.
    setEntry({ label, before, validAtVersion: versionRef.current })
  }, [])

  const undo = useCallback(() => {
    const current = entryRef.current
    if (isUndoStale(current, versionRef.current)) {
      setEntry(null)
      return
    }
    // Restoring is itself a change, so the counter moves and this offer cannot
    // be replayed into a redo loop.
    update(() => current!.before)
    setEntry(null)
  }, [update])

  const dismiss = useCallback(() => setEntry(null), [])

  useEffect(() => {
    if (!entry) return
    const id = window.setTimeout(() => setEntry(null), UNDO_WINDOW_MS)
    return () => window.clearTimeout(id)
  }, [entry])

  return { update, entry, run, undo, dismiss }
}
