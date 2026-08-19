/**
 * components/OnboardingTour.tsx
 *
 * Interactive step-by-step onboarding: spotlight on UI elements and short copy.
 * Completion is stored in localStorage (see utils/tourStorage).
 *
 * Layout notes (all three mattered on phones):
 *  - The card is always `position: fixed` with explicit left/right insets, so it
 *    never runs edge-to-edge. It previously switched to fixed positioning only
 *    when a spotlight was present, which dropped the overlay's padding.
 *  - Its height is capped to the viewport and the body scrolls, so the
 *    Back / Next buttons stay on screen for long steps.
 *  - A target hidden at the current breakpoint measures 0x0 at (0,0), which used
 *    to draw a degenerate ring in the top-left corner. Zero-area rects are
 *    treated as "no target" and the card simply centres.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { setTourCompleted } from '../utils/tourStorage'

export interface TourStep {
  id: string
  /** data-tour value to highlight, or null for centered card only */
  target: string | null
  title: string
  body: string
  /**
   * Overrides for narrow layouts (< lg), where the planner's right sidebar is
   * replaced by the Timer / Habits / Stats tabs and there is no right-click.
   * Fall back to `title` / `body`.
   */
  titleCompact?: string
  bodyCompact?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Deepblock',
    body: 'Your deep work hub, built on four ideas: protect focused time (Cal Newport), habits that shape identity (James Clear), the ONE Thing that matters most (Gary Keller), and concentrating effort (Peter Drucker). This tour covers the Day Planner — skip anytime.',
  },
  {
    id: 'day-setup',
    target: null,
    title: 'Start each day with a check-in',
    body: 'Each morning, log last night’s bedtime, your wake time, and tonight’s sleep target. Your day then splits into blocks — Morning, High Priority (deep work), Medium, Low, Night — sized to your awake hours and reshaped if you wake earlier or later.',
  },
  {
    id: 'date-nav',
    target: 'date-nav',
    title: 'Move between days',
    body: 'Previous / Today / Next switch days, and the teal badge counts deep work minutes logged today. In the last 3 days of a month, an amber Monthly review banner appears here.',
  },
  {
    id: 'fill-day',
    target: 'fill-day',
    title: 'Fill your day in one tap',
    body: '"Fill from last [weekday]" copies that weekday’s schedule from last week; "Copy from yesterday" shows when there is no prior week. No duplicates — then trim to what actually matters. Your Top 3 is never overwritten.',
  },
  {
    id: 'tasks-section',
    target: 'tasks-section',
    title: 'Task sections',
    body: 'Work top to bottom: Top 3 → Morning → High Priority (protect this one) → Medium / Low → Night. Right-click or tap ⋮ on a task to edit, add, mark it shallow, or abandon it. Completing a parent completes its subtasks.',
    bodyCompact: 'Work top to bottom: Top 3 → Morning → High Priority (protect this one) → Medium / Low → Night. Tap ⋮ on a task to edit, add, mark it shallow, or abandon it. Completing a parent completes its subtasks.',
  },
  {
    id: 'one-thing',
    target: null,
    title: 'The ONE Thing',
    body: 'In the sidebar, North Star holds your fixed life direction and Goal Cascade sets 1-year, 6-month and 3-month targets. Each day, week and month you name your ONE Thing — the task that makes everything else easier or unnecessary.',
    bodyCompact: 'Each day, week and month you name your ONE Thing — the task that makes everything else easier or unnecessary. Your 3-month goal sits above the task sections. North Star and Goal Cascade need a wider screen.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Sidebar: habits, timer & focus',
    titleCompact: 'Timer, Habits & Stats tabs',
    body: 'Five tools live here. North Star and goals set direction. The habit checklist tracks 🔥 streaks and flags ⚠ at-risk habits — click "I am X" to edit your identity. The deep work timer logs a labelled 15–90 min session automatically. Plus Side Quests and a rotating focus quote.',
    bodyCompact: 'The bottom tabs hold your tools. Timer runs a labelled 15–90 min deep work session and logs it automatically. Habits tracks 🔥 streaks, flags ⚠ at-risk habits, and holds your "I am X" identity. Stats shows your week at a glance.',
  },
  {
    id: 'atomic-habits',
    target: null,
    title: 'Atomic Habits',
    body: 'Identity first: "I am X" anchors each habit to who you’re becoming. Never miss twice — missing once is an accident, so a habit turns amber the day after a miss. Habit stacking: give each habit an "After [anchor]" trigger in the editor.',
  },
  {
    id: 'tracking',
    target: null,
    title: 'Tracking dashboard',
    body: 'Scroll down for the Deep Work This Week scoreboard — hours logged vs. your goal, plus a per-day chart — and set your depth philosophy (Rhythmic adds a block-window banner). Below: block completion grid, mood log, habit table, and the Monthly Review card.',
    bodyCompact: 'The Stats tab shows your week at a glance. Scroll the page for the full dashboard: deep work scoreboard vs. your goal, depth philosophy, block completion grid, mood log, habit table, and the Monthly Review card.',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set",
    body: 'Daily: check in → set your ONE Thing → tick habits → pick your Top 3 → protect your High Priority block → log timer sessions. Weekly: review the scoreboard. Monthly: the 8-question review. Replay this tour anytime from Help.',
  },
]

interface OnboardingTourProps {
  isActive: boolean
  onComplete: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/** Gap between the card and the viewport edges / the spotlighted element. */
const EDGE_MARGIN = 12
const SPOTLIGHT_GAP = 20

/**
 * Rect of the highlighted element, or null when there is nothing to highlight.
 * An element hidden at this breakpoint (e.g. the sidebar on mobile) is still in
 * the DOM but measures 0x0, so treat any zero-area rect as "no target".
 */
function getTargetRect(target: string | null): Rect | null {
  if (!target || typeof document === 'undefined') return null
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return r
}

/** True below Tailwind's `lg`, where the sidebar collapses into bottom tabs. */
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  useEffect(() => {
    // The lazy initialiser above already read the current match, so subscribing
    // is enough — no synchronous setState needed here.
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}

export function OnboardingTour({ isActive, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Rect | null>(null)
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerHeight,
  )
  const [cardH, setCardH] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const isCompact = useIsCompact()

  const step = TOUR_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === TOUR_STEPS.length - 1

  const title = (isCompact && step?.titleCompact) || step?.title
  const body = (isCompact && step?.bodyCompact) || step?.body

  useEffect(() => {
    if (!isActive || !step) return
    const update = () => {
      setSpotlight(getTargetRect(step.target))
      setViewportH(window.innerHeight)
    }
    const rafId = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isActive, step])

  // Measure the card so it can be clamped inside the viewport. Re-runs per step
  // because the copy length — and therefore the height — varies.
  useLayoutEffect(() => {
    if (!isActive) return
    const el = cardRef.current
    if (!el) return
    const measure = () => setCardH(el.getBoundingClientRect().height)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isActive, stepIndex, body])

  const handleNext = useCallback(() => {
    if (isLast) {
      setTourCompleted()
      onComplete()
    } else {
      setStepIndex((i) => i + 1)
    }
  }, [isLast, onComplete])

  const handleBack = useCallback(() => {
    setStepIndex((i) => (i === 0 ? i : i - 1))
  }, [])

  const handleSkip = useCallback(() => {
    setTourCompleted()
    onComplete()
  }, [onComplete])

  if (!isActive || !step) return null

  // Sit under the spotlight when there is room, otherwise centre — always fully
  // on screen so the Back / Next controls stay reachable.
  const maxTop = Math.max(EDGE_MARGIN, viewportH - cardH - EDGE_MARGIN)
  const cardTop = spotlight
    ? Math.min(Math.max(spotlight.top + spotlight.height + SPOTLIGHT_GAP, EDGE_MARGIN), maxTop)
    : Math.max(EDGE_MARGIN, Math.round((viewportH - cardH) / 2))

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      {/* Dark overlay with optional spotlight cutout */}
      <div className="absolute inset-0 bg-share-bg/80" aria-hidden />
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-sky-500/80 ring-offset-2 ring-offset-share-bg transition-all duration-200"
          style={{
            top: spotlight.top - 6,
            left: spotlight.left - 6,
            width: spotlight.width + 12,
            height: spotlight.height + 12,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.82)',
          }}
          aria-hidden
        />
      )}

      <div
        ref={cardRef}
        className="fixed z-10 mx-auto flex max-w-md flex-col overflow-hidden rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh shadow-2xl"
        style={{
          left: EDGE_MARGIN,
          right: EDGE_MARGIN,
          top: cardTop,
          maxHeight: `calc(100dvh - ${EDGE_MARGIN * 2}px)`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <span className="text-xs font-medium uppercase tracking-wide text-sky-400/90">
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="-m-2 p-2 text-xs text-share-onSurfaceVariant underline hover:text-share-onBg"
          >
            Skip tour
          </button>
        </div>

        {/* Scrolls when the copy is taller than the viewport allows. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          <h3 id="tour-title" className="mb-2 text-base font-semibold text-share-onBg sm:text-lg">
            {title}
          </h3>
          <p id="tour-body" className="pb-4 text-sm leading-relaxed text-share-onSurface">
            {body}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-share-outlineVariant/25 px-5 py-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className="min-h-[44px] rounded-md border border-share-outlineVariant/40 px-4 text-sm text-share-onSurface hover:border-sky-600 hover:text-sky-300 disabled:pointer-events-none disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="min-h-[44px] rounded-md border border-sky-500 bg-sky-500/20 px-5 text-sm font-medium text-sky-300 hover:bg-sky-500/30"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
