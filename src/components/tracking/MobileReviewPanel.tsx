/**
 * components/tracking/MobileReviewPanel.tsx
 *
 * The phone's Review screen: two numbers, and a way into everything else.
 *
 * Review holds five month-scale tools and two 31-column grids. On a desktop
 * they fit beside each other; on a 390px screen, rendering them all is how the
 * old Stats tab became 2,580px of scroll that nobody read to the bottom of.
 *
 * So the phone gets the summary and a door. Deep work this week and block
 * completion answer "how is it going" without a tap. Everything heavier —
 * the month grid, the reviews, the journal, the goals — is one tap away and
 * renders only once asked for. Nothing was removed; it stopped being in the
 * way. See `docs/design/mobile/Review.dc.html`.
 *
 * The bar chart is deliberately unlabelled beyond M-S. Seven bars and a
 * weekday letter is the most a phone can show without becoming a table, and
 * the shape — where the gaps are — is the whole message.
 */

interface MobileReviewPanelProps {
  deepWorkHours: number
  deepWorkGoalHours: number
  /** Minutes of deep work per day, Monday first. */
  weekMinutes: number[]
  /** 0-1, or null when the month holds no planned block. */
  blockCompletion: number | null
  /** Reveal the heavy content and scroll to an anchor inside it. */
  onOpen: (targetId: string) => void
  journalWritten: boolean
  weeklyDue: boolean
  monthlyWritten: boolean
}

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function MobileReviewPanel({
  deepWorkHours,
  deepWorkGoalHours,
  weekMinutes,
  blockCompletion,
  onOpen,
  journalWritten,
  weeklyDue,
  monthlyWritten,
}: MobileReviewPanelProps) {
  // Scale the bars to the biggest day, not to the goal: a week where you did
  // three hours should still show its own shape rather than seven slivers.
  const peak = Math.max(1, ...weekMinutes)

  const links = [
    {
      key: 'journal',
      label: 'Day journal',
      note: journalWritten ? 'Written today' : 'Empty today',
      isDue: false,
      targetId: 'review-journal',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M9 3v18" /></svg>
      ),
    },
    {
      key: 'weekly',
      label: 'Weekly review',
      note: weeklyDue ? 'Due today' : 'Not due yet',
      isDue: weeklyDue,
      targetId: 'review-weekly',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
      ),
    },
    {
      key: 'monthly',
      label: 'Monthly review',
      note: monthlyWritten ? 'Written' : 'Not written yet',
      isDue: false,
      targetId: 'review-monthly',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      ),
    },
    {
      key: 'goals',
      label: 'Goals & North Star',
      note: 'Life → 5yr → 1yr → 6mo',
      isDue: false,
      targetId: 'review-goals',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.4 6.3 6.6.3-5.2 4.1 1.8 6.3-5.6-3.7-5.6 3.7 1.8-6.3L3 9.6l6.6-.3z" /></svg>
      ),
    },
  ]

  return (
    <div className="lg:hidden" data-testid="mobile-review">
      <div className="rounded-2xl bg-share-surfaceContainerLow p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
            Deep work this week
          </p>
          <p className="text-[11px] text-share-onSurfaceVariant/70">goal {deepWorkGoalHours}h</p>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-shareHeadline text-[38px] font-extrabold leading-none tracking-[-0.02em] text-share-onBg">
            {deepWorkHours.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-share-onSurfaceVariant">hours</span>
        </div>

        <div className="mt-4 grid h-16 grid-cols-7 items-end gap-1.5">
          {weekMinutes.map((mins, i) => (
            <div
              key={i}
              style={{ height: `${Math.max(4, (mins / peak) * 100)}%` }}
              className={`rounded-t ${mins > 0 ? 'bg-share-primary' : 'bg-share-outlineVariant/30'}`}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-[10px] text-share-onSurfaceVariant/70">
          {WEEKDAY_INITIALS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-share-surfaceContainerLow p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
          Block completion
        </p>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-shareHeadline text-[38px] font-extrabold leading-none tracking-[-0.02em] text-share-onBg">
            {blockCompletion === null ? '—' : Math.round(blockCompletion * 100)}
          </span>
          <span className="text-sm font-semibold text-share-onSurfaceVariant">
            {blockCompletion === null ? 'nothing planned yet' : '% this month'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpen('review-block-grid')}
          className="mt-4 flex w-full items-center gap-2.5 border-t border-share-outlineVariant/25 pt-3.5 text-left"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-share-onSurfaceVariant" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
          <span className="flex-1 text-sm font-semibold text-share-onBg">Open the month grid</span>
          <Chevron />
        </button>
      </div>

      <nav className="mt-5">
        {links.map((link, i) => (
          <button
            key={link.key}
            type="button"
            onClick={() => onOpen(link.targetId)}
            className={`touch-target flex w-full items-center gap-3 py-3 text-left ${
              i === links.length - 1 ? '' : 'border-b border-share-outlineVariant/25'
            }`}
          >
            <span className="shrink-0 text-share-onSurfaceVariant" aria-hidden="true">
              {link.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-share-onBg">{link.label}</span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  link.isDue ? 'text-share-primary' : 'text-share-onSurfaceVariant/70'
                }`}
              >
                {link.note}
              </span>
            </span>
            <Chevron />
          </button>
        ))}
      </nav>
    </div>
  )
}

function Chevron() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-share-outlineVariant"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
