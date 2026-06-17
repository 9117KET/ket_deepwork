/**
 * pages/RestorePage.tsx  (route: /restore)
 *
 * One-shot recovery tool. Re-uploads the days stored in THIS device's
 * localStorage to the signed-in user's Convex account, in paced batches so it
 * cannot spike the I/O quota the way the original one-shot migration did.
 *
 * Safe to ship: a user can only ever write their own data to their own account
 * (the mutation is authenticated and scoped by userId). Reach it at /restore.
 */

import { useMemo, useState } from "react"
import { useMutation, useConvexAuth } from "convex/react"
import { api } from "../../convex/_generated/api"
import {
  readLocalDaysForRestore,
  restoreDaysInBatches,
  type RestoreProgress,
} from "../storage/restoreFromLocal"

type Status = "idle" | "running" | "done" | "error"

const BATCH_SIZE = 8
const DELAY_MS = 1500

export function RestorePage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const upsertManyDays = useMutation(api.plannerDays.upsertMany)

  const days = useMemo(() => readLocalDaysForRestore(), [])
  const dateRange = useMemo(() => {
    if (days.length === 0) return null
    return { first: days[0]!.date, last: days[days.length - 1]!.date }
  }, [days])

  const [status, setStatus] = useState<Status>("idle")
  const [progress, setProgress] = useState<RestoreProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const estSeconds = Math.max(0, Math.ceil(days.length / BATCH_SIZE) - 1) * (DELAY_MS / 1000)

  const handleRestore = async () => {
    setStatus("running")
    setError(null)
    setProgress({ batch: 0, batches: Math.ceil(days.length / BATCH_SIZE), done: 0, total: days.length })
    try {
      await restoreDaysInBatches(days, upsertManyDays, {
        batchSize: BATCH_SIZE,
        delayMs: DELAY_MS,
        onProgress: setProgress,
      })
      setStatus("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus("error")
    }
  }

  return (
    <div className="min-h-screen bg-share-bg px-4 py-10 font-shareSans text-share-onBg">
      <div className="mx-auto w-full max-w-md space-y-5 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-6 shadow-xl">
        <div>
          <h1 className="text-lg font-bold text-share-onBg">Restore from this device</h1>
          <p className="mt-1 text-sm text-share-onSurfaceVariant">
            Re-uploads the days saved in this browser to your account, in small
            paced batches. It overwrites the matching server day only when this
            device's copy is the same or newer.
          </p>
        </div>

        <div className="rounded border border-share-outlineVariant/30 bg-share-surfaceContainerHighest px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-share-onSurfaceVariant">Days found locally</span>
            <span className="font-mono font-semibold text-share-onBg">{days.length}</span>
          </div>
          {dateRange && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-share-onSurfaceVariant">Range</span>
              <span className="font-mono text-xs text-share-onSurface">
                {dateRange.first} → {dateRange.last}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-share-onSurfaceVariant">Batches</span>
            <span className="font-mono text-xs text-share-onSurface">
              {Math.ceil(days.length / BATCH_SIZE)} × {BATCH_SIZE} · ~{estSeconds}s
            </span>
          </div>
        </div>

        {!isLoading && !isAuthenticated && (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            You must be signed in. Open the planner, sign in, then come back to
            <span className="font-mono"> /restore</span>.
          </p>
        )}

        {progress && (
          <div className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded bg-share-surfaceContainerHighest">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-share-onSurfaceVariant">
              Batch {progress.batch}/{progress.batches} · {progress.done}/{progress.total} days uploaded
            </p>
          </div>
        )}

        {status === "done" && (
          <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Done — {progress?.done ?? days.length} days uploaded. Refresh the planner to confirm.
          </p>
        )}
        {status === "error" && (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Failed: {error}. Your local data is untouched — you can retry.
          </p>
        )}

        <button
          onClick={handleRestore}
          disabled={!isAuthenticated || status === "running" || days.length === 0}
          className="w-full rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "running"
            ? `Restoring… (${progress?.done ?? 0}/${days.length})`
            : status === "done"
              ? "Restore again"
              : `Restore ${days.length} days`}
        </button>

        <p className="text-center text-xs text-share-onSurfaceVariant/60">
          Tip: back up first — run{" "}
          <span className="font-mono">copy(localStorage.getItem('deepblock_state_v1'))</span> in
          the console and save it to a file.
        </p>
      </div>
    </div>
  )
}
