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
    body: 'Your all-in-one deep work hub. Built on three frameworks: Cal Newport\'s Deep Work (protect and measure focused time), James Clear\'s Atomic Habits (identity-based habits), and Peter Drucker\'s Effective Executive (ruthless prioritisation). This tour covers the Day Planner. Skip anytime or go back.',
  },
  {
    id: 'day-setup',
    target: null,
    title: 'Start each day with a check-in',
    body: 'Each morning you\'ll be prompted for your bedtime last night, wake time, and sleep target for tonight. Your day is divided into time blocks — Morning, High Priority (your deep work window), Medium, Low, and Night — automatically scaled to your awake hours.',
  },
  {
    id: 'date-nav',
    target: 'date-nav',
    title: 'Navigate your days',
    body: 'Use Previous / Today / Next to move between days. Each day stores its own tasks, deep work sessions, and sleep data. The teal badge in the header shows how many deep work minutes you\'ve logged today.',
  },
  {
    id: 'fill-day',
    target: 'fill-day',
    title: 'Fill your day in one click',
    body: '"Fill from last [weekday]" copies your recurring schedule from the same weekday last week. "Copy from yesterday" is shown when no prior week data exists. One click — no duplicates. Then trim to just what matters today.',
  },
  {
    id: 'tasks-section',
    target: 'tasks-section',
    title: 'Your task sections',
    body: 'Work top to bottom: 3 MUST-Do tasks (your non-negotiables) → Morning routine → High Priority (protect this for deep work) → Medium / Low priority → Night routine. Right-click or tap ⋮ on any task to mark it as "shallow" — logistical work that doesn\'t need deep focus. Once shallow tasks hit 2 h, a warning appears to guard your deep blocks.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Sidebar: habits, timer & progress',
    body: 'The sidebar has four tools. Weekly overview: completion bars for each day this week. Habit checklist: check off daily habits, see 🔥 streak counts, and get an amber ⚠ alert when you\'re at risk of missing twice in a row. Set your identity statement ("I am X") at the top. Deep work timer: label a session, pick a duration, and start — it saves automatically. Motivation card: rotating focus quote.',
  },
  {
    id: 'atomic-habits',
    target: null,
    title: 'Atomic Habits (James Clear)',
    body: 'Three principles built in. Identity: your "I am X" statement anchors every day. Never miss twice: if you missed a habit yesterday, it\'s flagged in amber today so you can act before the streak breaks. Habit stacking: set an "After [X]" anchor for each habit in the editor (tap Edit on the checklist). The monthly habit grid in the Tracking dashboard shows your full consistency history.',
  },
  {
    id: 'other-features',
    target: null,
    title: 'Tracking dashboard & deep work scoreboard',
    body: 'Scroll down on the planner page. The Deep Work This Week card shows hours logged vs. your goal (click the goal to edit). Below it: the block completion grid (month at a glance), mood log, and habit tracking table. Set your depth philosophy here too — Rhythmic adds a teal banner above your High Priority block as a daily reminder to protect it.',
  },
  {
    id: 'more-tools',
    target: null,
    title: 'More built-in tools',
    body: 'From the top navigation: Plan trips with AI-generated itineraries in Travel Planner. Manage budgets in Financial Planner. Sync with Google Calendar. Share your planner with anyone via a view or edit link. All data syncs across devices when signed in.',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set",
    body: 'Daily rhythm: set your identity, check off habits, fill your 3 Must-Dos, protect your High Priority block for deep work, log timer sessions, and review the scoreboard each week. Use the Help button anytime to replay this tour. Build your day with intention.',
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
