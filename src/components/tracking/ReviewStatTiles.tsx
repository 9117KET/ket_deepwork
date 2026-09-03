/**
 * components/tracking/ReviewStatTiles.tsx
 *
 * The three numbers the Review screen opens with.
 *
 * The grids below them are the evidence; these are the verdict. Before this,
 * answering "is the month going well" meant reading a 31-column table and doing
 * the arithmetic yourself, which is why the dashboard was something people
 * scrolled past rather than read. See `docs/design/desktop/DesktopReview.dc.html`.
 *
 * All three wear the one accent, and none of them turns red. A number that is
 * low is information, not a telling-off — amber and red are reserved for
 * things that need an action right now, and "62% of your deep work goal on a
 * Wednesday" is not one of them.
 */

interface StatTileProps {
  label: string
  /** The headline figure, already formatted. Null renders an em dash. */
  value: string | null
  /** Small text after the figure, e.g. "/ 20h". */
  suffix?: string
  /** 0-1, drives the bar. Null hides it. */
  ratio: number | null
  /** Shown instead of the bar when there is nothing to measure yet. */
  emptyNote?: string
}

function StatTile({ label, value, suffix, ratio, emptyNote }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-share-surfaceContainerLow p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
        {label}
      </p>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-shareHeadline text-3xl font-extrabold leading-none tracking-[-0.02em] text-share-onBg">
          {value ?? '—'}
        </span>
        {suffix && <span className="text-sm text-share-onSurfaceVariant">{suffix}</span>}
      </div>
      {ratio === null ? (
        <p className="mt-3.5 text-xs text-share-onSurfaceVariant/70">{emptyNote ?? 'Nothing to measure yet.'}</p>
      ) : (
        <div className="mt-3.5 h-1 rounded-full bg-share-outlineVariant/30">
          <div
            className="h-1 rounded-full bg-share-primary"
            style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface ReviewStatTilesProps {
  deepWorkHours: number
  deepWorkGoalHours: number
  /** 0-1, or null when the month holds no planned block. */
  blockCompletion: number | null
  /** 0-1, or null when no habits are configured. */
  habitConsistency: number | null
}

export function ReviewStatTiles({
  deepWorkHours,
  deepWorkGoalHours,
  blockCompletion,
  habitConsistency,
}: ReviewStatTilesProps) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-3">
      <StatTile
        label="Deep work this week"
        value={deepWorkHours.toFixed(1)}
        suffix={`/ ${deepWorkGoalHours}h`}
        ratio={deepWorkGoalHours > 0 ? deepWorkHours / deepWorkGoalHours : null}
        emptyNote="Set a weekly goal to track this."
      />
      <StatTile
        label="Block completion"
        value={blockCompletion === null ? null : String(Math.round(blockCompletion * 100))}
        suffix={blockCompletion === null ? undefined : '% this month'}
        ratio={blockCompletion}
        emptyNote="No blocks planned this month."
      />
      <StatTile
        label="Habit consistency"
        value={habitConsistency === null ? null : String(Math.round(habitConsistency * 100))}
        suffix={habitConsistency === null ? undefined : '% of checks'}
        ratio={habitConsistency}
        emptyNote="No habits set up yet."
      />
    </div>
  )
}
