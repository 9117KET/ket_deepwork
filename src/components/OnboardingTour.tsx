/**
 * components/OnboardingTour.tsx
 *
 * Interactive step-by-step onboarding: spotlight on UI elements and short copy.
 * Completion is stored in localStorage (see utils/tourStorage).
 */

import { useEffect, useState } from 'react'
import { setTourCompleted } from '../utils/tourStorage'

export interface TourStep {
  id: string
  /** data-tour value to highlight, or null for centered card only */
  target: string | null
  title: string
  body: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Deepblock',
    body: 'Your all-in-one deep work hub. Built on four frameworks: Cal Newport\'s Deep Work (protect focused time), James Clear\'s Atomic Habits (identity-based habits), Gary Keller\'s The ONE Thing (ruthless focus on what matters most), and Peter Drucker\'s Effective Executive (eliminate, delegate, concentrate). This tour covers the Day Planner. Skip anytime or go back.',
  },
  {
    id: 'day-setup',
    target: null,
    title: 'Start each day with a check-in',
    body: 'Each morning you\'ll be prompted for your bedtime, wake time, and sleep target for tonight. Your day is divided into time blocks — Morning, High Priority (your deep work window), Medium, Low, and Night — automatically scaled to your awake hours. Blocks shift if you wake up earlier or later, keeping them proportional.',
  },
  {
    id: 'date-nav',
    target: 'date-nav',
    title: 'Navigate your days + monthly review',
    body: 'Use Previous / Today / Next to move between days. The teal badge shows deep work minutes logged today. During the last 3 days of each month, an amber "Monthly review" banner appears here — click Open ↓ to scroll to the inline review card where you answer 8 reflection questions about deep work hours, your ONE Thing, habits, and goal progress.',
  },
  {
    id: 'fill-day',
    target: 'fill-day',
    title: 'Fill your day in one click',
    body: '"Fill from last [weekday]" copies your recurring schedule from the same weekday last week. "Copy from yesterday" appears when no prior-week data exists. One click, no duplicates — then trim to what actually matters today. Your Top 3 for today at the top are pinned separately and do not get overwritten.',
  },
  {
    id: 'tasks-section',
    target: 'tasks-section',
    title: 'Task sections',
    body: 'Work top to bottom: your Top 3 for today → Morning routine → High Priority (protect this for deep work) → Medium / Low priority → Night routine. Right-click or tap ⋮ on any task to: edit, add above/below, add subtask, mark as shallow, move to Not-Doing, or abandon. Completing a parent auto-completes all subtasks. Once completed shallow tasks exceed 2 h, a warning appears to guard your deep work blocks.',
  },
  {
    id: 'one-thing',
    target: null,
    title: 'The ONE Thing (Gary Keller)',
    body: 'In the sidebar, the North Star card holds your fixed life direction — the single sentence that guides every decision. Below it, the Goal Cascade section lets you set goals at 1-year, 6-month, and 3-month horizons. Each day, week, and month you identify your ONE Thing: the most important task that makes everything else easier or unnecessary. Your 3-month goal appears as a reminder above the task sections each day.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Sidebar: habits, timer & focus',
    body: 'The sidebar has five tools. North Star + goals: your direction and cascading targets. Habit checklist: check off daily habits with 🔥 streak counts and amber ⚠ never-miss-twice alerts. Click "I am X" to edit your identity statement. Deep work timer: label a session, pick a duration (15–90 min), and start — it auto-saves. Side Quests: optional bonus challenges for XP. Focus reminder: rotating quote that refreshes every 45 s.',
  },
  {
    id: 'atomic-habits',
    target: null,
    title: 'Atomic Habits (James Clear)',
    body: 'Identity first: your "I am X" statement at the top of the checklist anchors every habit to who you\'re becoming. Never miss twice: missing once is an accident; missing twice starts a bad pattern. The app flags at-risk habits in amber the day after a miss. Habit stacking: assign an "After [anchor]" trigger to each habit in the editor (tap Edit). The monthly habit grid in the Tracking dashboard shows your full consistency history.',
  },
  {
    id: 'tracking',
    target: null,
    title: 'Tracking dashboard',
    body: 'Scroll down to the Tracking dashboard. At the top: the Deep Work This Week scoreboard — hours logged vs. your editable goal, plus a per-day bar chart. Set your depth philosophy here (Rhythmic adds a teal block-window banner in the planner). Below: the Goal Cascade for long-horizon goals. Then the block completion grid (month at a glance), mood log, and habit tracking table. At the bottom: the Monthly Review card with 8 reflection prompts.',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set",
    body: 'Daily rhythm: wake-up check-in → set today\'s ONE Thing → check off habits → fill your Top 3 for today → protect your High Priority block for deep work → log timer sessions. Weekly: review the scoreboard. Monthly: complete the 8-question review from the amber banner. Use Help anytime to replay this tour. Build every day with intention.',
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

function getTargetRect(target: string | null): Rect | null {
  if (!target || typeof document === 'undefined') return null
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  return el.getBoundingClientRect()
}

export function OnboardingTour({ isActive, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Rect | null>(null)

  const step = TOUR_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === TOUR_STEPS.length - 1

  useEffect(() => {
    if (!isActive || !step) return
    const update = () => setSpotlight(getTargetRect(step.target))
    const rafId = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isActive, step])

  const handleNext = () => {
    if (isLast) {
      setTourCompleted()
      onComplete()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const handleBack = () => {
    if (isFirst) return
    setStepIndex((i) => i - 1)
  }

  const handleSkip = () => {
    setTourCompleted()
    onComplete()
  }

  if (!isActive || !step) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
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

      {/* Card: below spotlight when present, else centered */}
      <div
        className="relative z-10 w-full max-w-md rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-5 shadow-2xl"
        style={
          spotlight
            ? {
                position: 'fixed',
                top: Math.min(spotlight.top + spotlight.height + 24, window.innerHeight - 280),
                left: '50%',
                transform: 'translateX(-50%)',
              }
            : undefined
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-sky-400/90">
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-share-onSurfaceVariant underline hover:text-share-onBg"
          >
            Skip tour
          </button>
        </div>
        <h3 id="tour-title" className="mb-2 text-lg font-semibold text-share-onBg">
          {step.title}
        </h3>
        <p id="tour-body" className="mb-6 text-sm leading-relaxed text-share-onSurface">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className="rounded-md border border-share-outlineVariant/40 px-3 py-1.5 text-sm text-share-onSurface hover:border-sky-600 hover:text-sky-300 disabled:opacity-40 disabled:pointer-events-none"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/30"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
