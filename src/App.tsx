/**
 * App.tsx
 *
 * Root application shell for the KET Deepwork planner.
 * Responsible for high-level layout and delegating to the planner page.
 */

import { useEffect, useState } from 'react'
import { DayPlanner } from './components/planner/DayPlanner'
import { HelpModal } from './components/HelpModal'
import { OnboardingTour } from './components/OnboardingTour'
import { getTourCompleted } from './utils/tourStorage'

function App() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)

  useEffect(() => {
    if (!getTourCompleted()) setTourActive(true)
  }, [])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              2026 Deepwork Planner
            </h1>
            <p className="text-sm text-slate-400">
              Daily focus hub for job applications, German, and deep work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="mt-2 shrink-0 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:border-sky-600 hover:text-sky-300 sm:mt-0"
          >
            Help
          </button>
        </header>
        <DayPlanner />
      </div>
      <HelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setHelpOpen(false)
          setTourActive(true)
        }}
      />
      <OnboardingTour isActive={tourActive} onComplete={() => setTourActive(false)} />
    </div>
  )
}

export default App
