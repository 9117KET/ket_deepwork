/**
 * components/finance/MonthSelector.tsx
 *
 * Shows which two months are in view (present + next) and a control to reset
 * to current and next month from today.
 */

import { currentAndNextMonthIds } from '../../domain/dateUtils'

interface MonthSelectorProps {
  currentMonthId: string
  nextMonthId: string
  onCurrentMonthChange: (id: string) => void
  onNextMonthChange: (id: string) => void
}

function formatMonthLabel(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(y!, m! - 1, 1),
  )
}

export function MonthSelector({
  currentMonthId,
  nextMonthId,
  onCurrentMonthChange,
  onNextMonthChange,
}: MonthSelectorProps) {
  const { current: nowCurrent, next: nowNext } = currentAndNextMonthIds()
  const isShowingDefault = currentMonthId === nowCurrent && nextMonthId === nowNext

  const handleResetToCurrent = () => {
    onCurrentMonthChange(nowCurrent)
    onNextMonthChange(nowNext)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <span className="text-sm text-slate-400">Planning:</span>
      <span className="font-medium text-slate-200">{formatMonthLabel(currentMonthId)}</span>
      <span className="text-slate-500">+</span>
      <span className="font-medium text-slate-200">{formatMonthLabel(nextMonthId)}</span>
      {!isShowingDefault && (
        <button
          type="button"
          onClick={handleResetToCurrent}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
        >
          Show current & next month
        </button>
      )}
    </div>
  )
}
