/**
 * App.tsx
 *
 * Root application shell for the Deepblock planner.
 * Responsible for high-level layout, auth gating, and delegating to the planner page.
 */

import { useEffect, useMemo, useState } from 'react'
import { DayPlanner } from './components/planner/DayPlanner'
import { HelpModal } from './components/HelpModal'
import { OnboardingTour } from './components/OnboardingTour'
import { getTourCompleted } from './utils/tourStorage'
import { useAuth } from './contexts/AuthContext'
import { useLanguage } from './contexts/LanguageContext'
import { LoginForm } from './components/auth/LoginForm'

function App() {
  const { user, loading, signOut } = useAuth()
  const { language, setLanguage, t } = useLanguage()
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
        <p className="text-sm text-slate-400">{t('app.loading')}</p>
      </div>
    )
  }

  if (!showPlanner) {
    return <LoginForm onContinueAsGuest={() => setGuest(true)} />
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Deepblock</h1>
            <p className="text-sm text-slate-400">{t('app.tagline')}</p>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
              <span className="hidden sm:inline">{t('app.languageLabel')}:</span>
              {(['en', 'de', 'fr'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`rounded-full px-1.5 py-0.5 ${
                    language === code
                      ? 'bg-sky-600 text-slate-950'
                      : 'hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
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
                <button
                  type="button"
                  onClick={handleOpenDashboard}
                  className="hidden sm:inline-flex rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
                >
                  {t('app.viewProgress')}
                </button>
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-slate-950">
                    {userInitial}
                  </div>
                  <div className="hidden text-xs text-slate-300 sm:block">
                    <div className="max-w-[180px] truncate font-medium">
                      {user?.email ?? 'Signed in'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        {t('app.signOut')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
