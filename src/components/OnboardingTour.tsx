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
    body: 'This short tour will show you the main areas. You can skip anytime or go back a step.',
  },
  {
    id: 'date-nav',
    target: 'date-nav',
    title: 'Navigate the calendar',
    body: 'Use Previous / Today / Next to change the day. Your tasks are per day.',
  },
  {
    id: 'fill-day',
    target: 'fill-day',
    title: 'Fill your day in one click',
    body: '“Fill from last [weekday]” copies last week’s same day (e.g. last Thursday). “Copy from yesterday” appears when you don’t have that. Click once to avoid duplicates.',
  },
  {
    id: 'tasks-section',
    target: 'tasks-section',
    title: 'Your task sections',
    body: 'Work top to bottom: 3 must-dos → Morning routine → High / Medium / Low priority → Night routine. Add tasks at the bottom of each section. Set a time and duration so the app can remind you when it’s due.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Weekly overview & timer',
    body: 'Right side: see this week’s progress and today’s % done, run a deep work timer, and read a short focus reminder. The sidebar stays visible as you scroll.',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set",
    body: 'Use the Help button anytime to reopen the written guide or restart this tour. Focus on the work.',
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
