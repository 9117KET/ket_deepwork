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
    title: 'Welcome to Life Planner',
    body: 'Your all-in-one focus hub: Day Planner, Travel Planner, Financial Planner, and Google Calendar sync -- all in one place. This tour covers the Day Planner. Skip anytime or go back a step.',
  },
  {
    id: 'day-setup',
    target: null,
    title: 'Start each day with a check-in',
    body: 'Each morning you\'ll be asked: when did you go to bed last night, when did you wake up, and how many hours you want to sleep tonight. Your actual sleep is shown automatically and your day blocks are built around your wake and bedtime.',
  },
  {
    id: 'date-nav',
    target: 'date-nav',
    title: 'Navigate the calendar',
    body: 'Use Previous / Today / Next to move between days. Each day has its own tasks, sleep data, and deep work sessions. You can view and edit any past or future day.',
  },
  {
    id: 'fill-day',
    target: 'fill-day',
    title: 'Fill your day in one click',
    body: '"Fill from last [weekday]" copies the same day from last week -- useful for recurring schedules. "Copy from yesterday" is shown when no prior week data exists. One click, no duplicates.',
  },
  {
    id: 'tasks-section',
    target: 'tasks-section',
    title: 'Your task sections',
    body: 'Work top to bottom: 3 MUST Todo tasks → Morning routine → High priority → Medium & Low priority → Night routine. Add tasks inside each section, optionally set a time and duration, and check them off as you go. Completing subtasks automatically completes the parent.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Deep work timer & weekly progress',
    body: 'The sidebar shows this week\'s completion rate and your current streak -- a streak counts when you create and complete at least one task on a day. Run a Pomodoro-style deep work timer to log focused sessions. A motivation card refreshes each session.',
  },
  {
    id: 'other-features',
    target: null,
    title: 'More built-in tools',
    body: 'From the top navigation: Track monthly habits, mood, and sleep in the Tracking dashboard. Plan trips with AI-generated itineraries in Travel Planner. Manage budgets in Financial Planner. Connect Google Calendar to pull and push events. Share your planner with anyone via a view or edit link.',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set",
    body: 'Use the Help button anytime to restart this tour. Build your day with intention -- start with your 3 MUST Todo tasks and let the blocks guide the rest.',
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
      <div className="absolute inset-0 bg-slate-950/80" aria-hidden />
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-sky-500/80 ring-offset-2 ring-offset-slate-950 transition-all duration-200"
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
        className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
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
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            Skip tour
          </button>
        </div>
        <h3 id="tour-title" className="mb-2 text-lg font-semibold text-slate-100">
          {step.title}
        </h3>
        <p id="tour-body" className="mb-6 text-sm leading-relaxed text-slate-300">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-sky-600 hover:text-sky-300 disabled:opacity-40 disabled:pointer-events-none"
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
