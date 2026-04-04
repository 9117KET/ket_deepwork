/**
 * After editing block durations, asks whether to keep the split for this day only
 * or save it as the default for every day (stored as proportional ratios).
 */

interface BlockDurationScopeModalProps {
  onThisDayOnly: () => void
  onAllDaysDefault: () => void
  onCancel: () => void
}

export function BlockDurationScopeModal({
  onThisDayOnly,
  onAllDaysDefault,
  onCancel,
}: BlockDurationScopeModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100">Save block schedule</h3>
        <p className="mt-2 text-sm text-slate-400">
          Apply these block durations only for the day you are editing, or save them as your default
          split for every day (scaled to each day&apos;s wake and sleep times).
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onThisDayOnly}
            className="rounded-lg border border-sky-600/50 bg-sky-600/20 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-600/30"
          >
            This day only
          </button>
          <button
            type="button"
            onClick={onAllDaysDefault}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            All days (default)
          </button>
        </div>
      </div>
    </div>
  )
}
