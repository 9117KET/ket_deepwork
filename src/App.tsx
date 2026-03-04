/**
 * App.tsx
 *
 * Root application shell for the Deepblock planner.
 * Responsible for high-level layout, auth gating, and delegating to the planner page.
 */

import { useEffect, useState } from 'react'
import { DayPlanner } from './components/planner/DayPlanner'
import { HelpModal } from './components/HelpModal'
import { OnboardingTour } from './components/OnboardingTour'
import { getTourCompleted } from './utils/tourStorage'
import { useAuth } from './contexts/AuthContext'
import { LoginForm } from './components/auth/LoginForm'

function App() {
  const { user, loading, signOut } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [guest, setGuest] = useState(false)

  const isAuthenticated = Boolean(user)
  const showPlanner = isAuthenticated || guest

  useEffect(() => {
    queueMicrotask(() => {
      if (!getTourCompleted()) setTourActive(true)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading your workspace...</p>
      </div>
    )
  }

  if (!showPlanner) {
    return <LoginForm onContinueAsGuest={() => setGuest(true)} />
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Deepblock
            </h1>
            <p className="text-sm text-slate-400">
              Daily focus hub for job applications, German, and deep work.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-4 sm:mt-0">
            {isAuthenticated && (
              <div className="text-right text-xs text-slate-400">
                <div className="font-medium text-slate-200 truncate max-w-[180px]">
                  {user?.email ?? 'Signed in'}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const error = await signOut()
                    if (error) {
                      // eslint-disable-next-line no-console
                      console.error('[auth] Failed to sign out', error)
                    }
                  }}
                  className="mt-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Sign out
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="shrink-0 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              Help
            </button>
          </div>
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
