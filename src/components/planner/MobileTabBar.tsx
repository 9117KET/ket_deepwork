/**
 * components/planner/MobileTabBar.tsx
 *
 * The phone's four destinations.
 *
 * The bar itself barely changed; what changed is that it now partitions
 * something. Before the redesign every tab rendered the same ~2,500px of
 * dashboard and only ~700px swapped, so tapping was mostly theatre. Today,
 * Focus and Habits each own their screen, and Review is a route of its own —
 * which is why it is a link rather than a panel toggle.
 *
 * Icons come from the artboards as inline SVG on a 24px grid. They are shapes,
 * not decoration: on a bar with four items and no room for description, the
 * icon is what makes a tab findable at a glance. See `docs/design/mobile/`.
 */

import { Link } from 'react-router-dom'

/** The three tabs that swap a panel inside the planner. Review is a route. */
export type MobileTab = 'today' | 'focus' | 'habits'

interface MobileTabBarProps {
  /** Null on the Review route, where none of the planner's own tabs is active. */
  activeTab: MobileTab | null
  onTabChange: (tab: MobileTab) => void
  /** True on /planner/review, so Review lights up instead. */
  reviewActive?: boolean
}

const ICON_PROPS = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
} as const

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: (
      <svg {...ICON_PROPS} strokeLinecap="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4.5l3 2M9 2h6" />
      </svg>
    ),
  },
  {
    id: 'habits',
    label: 'Habits',
    icon: (
      <svg {...ICON_PROPS} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
]

const itemClass =
  'touch-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] transition-colors short:py-1'

export function MobileTabBar({ activeTab, onTabChange, reviewActive }: MobileTabBarProps) {
  return (
    // Hidden at lg+, where the planner's right rail replaces these tabs. Between
    // md and lg the AppChrome sidebar (fixed, 240px) is already showing, so the
    // bar starts after it instead of spanning the full width and covering the
    // sidebar's account menu.
    <div
      data-testid="mobile-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-share-outlineVariant/30 bg-share-bg/95 pb-safe-nav backdrop-blur-sm md:left-[240px] lg:hidden"
    >
      <div className="flex">
        <Link
          to="/"
          className={`${itemClass} font-medium text-share-onSurfaceVariant/60 hover:text-share-onSurface`}
          aria-label="Home"
        >
          <span className="material-symbols-outlined text-[1.1rem]">home</span>
          <span>Home</span>
        </Link>
        {TABS.map((tab) => {
          const isActive = !reviewActive && activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`${itemClass} ${
                isActive
                  ? 'font-bold text-share-primary'
                  : 'font-medium text-share-onSurfaceVariant/60 hover:text-share-onSurface'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          )
        })}
        <Link
          to="/planner/review"
          aria-current={reviewActive ? 'page' : undefined}
          className={`${itemClass} ${
            reviewActive
              ? 'font-bold text-share-primary'
              : 'font-medium text-share-onSurfaceVariant/60 hover:text-share-onSurface'
          }`}
        >
          <svg {...ICON_PROPS} strokeLinecap="round">
            <path d="M5 20V9M12 20V4M19 20v-7" />
          </svg>
          <span>Review</span>
        </Link>
      </div>
    </div>
  )
}
