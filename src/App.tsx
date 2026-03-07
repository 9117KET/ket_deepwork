/**
 * App.tsx
 *
 * Root application shell for the Deepblock planner.
 * Responsible for high-level layout, auth gating, and delegating to the planner page.
 */

import { useEffect, useMemo, useState } from 'react'
import { DayPlanner } from './components/planner/DayPlanner'
import { FinancePlanner } from './components/finance/FinancePlanner'
import { HelpModal } from './components/HelpModal'
import { OnboardingTour } from './components/OnboardingTour'
import { getTourCompleted } from './utils/tourStorage'
import { useAuth } from './contexts/AuthContext'
import { LoginForm } from './components/auth/LoginForm'

function App() {
  const { user, loading, signOut } = useAuth()
  const [view, setView] = useState<'planner' | 'finance'>('planner')
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [guest, setGuest] = useState(false)

  const isAuthenticated = Boolean(user)
  const showPlanner = isAuthenticated || guest

  const userInitial = useMemo(() => {
    const email = user?.email ?? ''
    const firstChar = email.trim().charAt(0)
    return firstChar ? firstChar.toUpperCase() : 'U'
  }, [user])

  const handleSignOut = async () => {
    const error = await signOut()
    if (error) {
      console.error('[auth] Failed to sign out', error)
    }
  }

  const handleOpenDashboard = () => {
    const el = document.getElementById('progress-dashboard')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

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
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Deepblock</h1>
            <p className="text-sm text-slate-400">Daily focus hub for everything.</p>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">
              <button
                type="button"
                onClick={() => setView('planner')}
                className={`px-3 py-1.5 first:rounded-l-full last:rounded-r-full ${
                  view === 'planner'
                    ? 'bg-sky-600 text-slate-950'
                    : 'hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                Planner
              </button>
              <button
                type="button"
                onClick={() => setView('finance')}
                className={`px-3 py-1.5 first:rounded-l-full last:rounded-r-full ${
                  view === 'finance'
                    ? 'bg-sky-600 text-slate-950'
                    : 'hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                Finance
              </button>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-sm font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
              aria-label="Help and tips"
            >
              ?
            </button>
            {isAuthenticated && (
              <div className="flex items-center gap-3">
                {view === 'planner' && (
                  <button
                    type="button"
                    onClick={handleOpenDashboard}
                    className="hidden sm:inline-flex rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
                  >
                    View progress
                  </button>
                )}
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-slate-950">
                    {userInitial}
                  </div>
                  <div className="hidden min-w-0 text-xs text-slate-300 sm:block">
                    <div className="max-w-[180px] truncate font-medium">
                      {user?.email ?? 'Signed in'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="touch-manipulation rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 active:bg-slate-700 sm:hidden"
                    aria-label="Sign out"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        {view === 'planner' && <DayPlanner />}
        {view === 'finance' && <FinancePlanner />}
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
