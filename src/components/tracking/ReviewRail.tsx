/**
 * components/tracking/ReviewRail.tsx
 *
 * The Review screen's right-hand column: what this month is called, and a way
 * into each of the things that live at month scale.
 *
 * The rail exists because of what Review is now. Moving the dashboard off the
 * day gave it a page of its own, and a page of its own turned out to be a long
 * scroll of five unrelated tools. The rail is the table of contents for that
 * scroll: it names what is down there, says whether each one needs you, and
 * takes you to it. See `docs/design/desktop/DesktopReview.dc.html`.
 *
 * "Due Friday" in the accent is the only urgent thing on this screen, so it is
 * the only thing wearing the accent — rule 4 again.
 */

interface RailLink {
  key: string
  label: string
  /** Small line under the label: when it is due, or what it holds. */
  note: string
  /** True when the note is a call to act now, not a description. */
  isDue?: boolean
  /** Element id to scroll to. */
  targetId: string
  icon: React.ReactNode
}

interface ReviewRailProps {
  /** The month's title, e.g. "The Foundation". Empty when unset. */
  chapterTitle: string
  links: RailLink[]
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ReviewRail({ chapterTitle, links }: ReviewRailProps) {
  return (
    <div className="flex flex-col">
      <div className="rounded-2xl border-l-2 border-share-primary bg-share-surfaceContainerLow p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-share-onSurfaceVariant">
          This chapter is called
        </p>
        <p className="mt-2 font-shareHeadline text-base font-bold text-share-onBg">
          {chapterTitle || <span className="font-normal text-share-onSurfaceVariant/70">Unnamed — name it below</span>}
        </p>
      </div>

      <nav className="mt-5">
        {links.map((link, i) => (
          <button
            key={link.key}
            type="button"
            onClick={() => scrollTo(link.targetId)}
            className={`flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-share-primary ${
              i === links.length - 1 ? '' : 'border-b border-share-outlineVariant/25'
            }`}
          >
            <span className="shrink-0 text-share-onSurfaceVariant" aria-hidden="true">
              {link.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-share-onBg">{link.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  link.isDue ? 'text-share-primary' : 'text-share-onSurfaceVariant/70'
                }`}
              >
                {link.note}
              </span>
            </span>
            <svg
              width="14"
              height="14"
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
          </button>
        ))}
      </nav>

      <div className="mt-6 rounded-xl bg-share-surfaceContainerLow/60 p-4 text-xs leading-relaxed text-share-onSurfaceVariant">
        Month-scale views live here and only here. The planner no longer renders this
        dashboard underneath the day.
      </div>
    </div>
  )
}

export type { RailLink }
