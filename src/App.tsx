/**
 * App.tsx
 *
 * Root application shell for the KET Deepwork planner.
 * Responsible for high-level layout and delegating to the planner page.
 */

import { DayPlanner } from './components/planner/DayPlanner'

function App() {
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
        </header>
        <DayPlanner />
      </div>
    </div>
  )
}

export default App
