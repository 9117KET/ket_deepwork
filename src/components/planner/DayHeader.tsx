/**
 * components/planner/DayHeader.tsx
 *
 * Displays the current day and provides navigation between days.
 */

interface DayHeaderProps {
  dateLabel: string
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
}

export function DayHeader({ dateLabel, onPrevDay, onNextDay, onToday }: DayHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-sky-300/80">Today&apos;s plan</p>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{dateLabel}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevDay}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 hover:text-sky-400 transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-sky-500 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-400 hover:bg-sky-500/20 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNextDay}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 hover:text-sky-400 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

