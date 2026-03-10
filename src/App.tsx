/**
 * App.tsx
 *
 * Root application shell for the Deepblock planner.
 * Responsible for high-level layout, auth gating, and delegating to the planner page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, DayState } from './domain/types'
import { DayPlanner } from './components/planner/DayPlanner'
import { HelpModal } from './components/HelpModal'
import { OnboardingTour } from './components/OnboardingTour'
import { getTourCompleted } from './utils/tourStorage'
import { useAuth } from './contexts/AuthContext'
import { LoginForm } from './components/auth/LoginForm'
import { ShareModal } from './components/sharing/ShareModal'
import {
  validateShareToken,
  fetchSharedPlannerState,
  upsertSharedDay,
} from './storage/supabaseSharing'

/** Read ?share=TOKEN from the URL once on load. */
function getShareTokenFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('share')
}

function App() {
  const { user, loading, signOut } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [guest, setGuest] = useState(false)

  // ── Shared planner (visitor mode) ──────────────────────────────────────────
  const shareToken = useMemo(() => getShareTokenFromUrl(), [])
  const [sharePermission, setSharePermission] = useState<'view' | 'edit' | null>(null)
  const [sharedState, setSharedState] = useState<AppState | null>(null)
  const [shareLoading, setShareLoading] = useState(Boolean(shareToken))
  const [shareError, setShareError] = useState(false)

  useEffect(() => {
    if (!shareToken) return
    const loadShared = async () => {
      setShareLoading(true)
      const [meta, state] = await Promise.all([
        validateShareToken(shareToken),
        fetchSharedPlannerState(shareToken),
      ])
      if (!meta || !state) {
        setShareError(true)
      } else {
        setSharePermission(meta.permission)
        setSharedState(state)
      }
      setShareLoading(false)
    }
    void loadShared()
  }, [shareToken])

  // When shared state is updated locally, persist changed days via RPC.
  const sharedStateRef = useRef(sharedState)
  useEffect(() => { sharedStateRef.current = sharedState }, [sharedState])

  const handleExternalUpdate = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setSharedState((prev) => {
        const base = prev ?? { days: {} }
        const next = updater(base)
        // Find which days changed and persist them.
        for (const [date, dayState] of Object.entries(next.days)) {
          if (dayState && dayState !== base.days[date] && shareToken) {
            void upsertSharedDay(shareToken, date, dayState as DayState)
          }
        }
        return next
      })
    },
    [shareToken],
  )

  // ── Owner mode ─────────────────────────────────────────────────────────────
  const isAuthenticated = Boolean(user)
  const showPlanner = isAuthenticated || guest

  const userInitial = useMemo(() => {
    const email = user?.email ?? ''
    const firstChar = email.trim().charAt(0)
    return firstChar ? firstChar.toUpperCase() : 'U'
  }, [user])

  const handleSignOut = async () => {
    const error = await signOut()
    if (error) console.error('[auth] Failed to sign out', error)
  }

  const handleOpenDashboard = () => {
    const el = document.getElementById('progress-dashboard')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Monthly tracking UI commented out for now
  // const handleOpenTracking = () => {
  //   const el = document.getElementById('tracking-dashboard')
  //   if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // }

  useEffect(() => {
    if (shareToken) return // skip onboarding tour for shared visitors
    queueMicrotask(() => {
      if (!getTourCompleted()) setTourActive(true)
    })
  }, [shareToken])

  // ── Shared visitor rendering ───────────────────────────────────────────────
  if (shareToken) {
    if (shareLoading) {
      return (
        <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading shared planner…</p>
        </div>
      )
    }
    if (shareError || !sharedState || !sharePermission) {
      return (
        <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-base font-medium text-slate-200">Link not found or expired</p>
            <p className="text-sm text-slate-400">
              This share link may have been removed by its owner.
            </p>
            <a
              href="/"
              className="inline-block mt-4 rounded border border-slate-600 bg-slate-800 px-4 py-2 text-xs text-slate-200 hover:border-sky-600 hover:text-sky-300"
            >
              Go to Deepblock
            </a>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-slate-950 text-slate-100 min-h-screen">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Deepblock</h1>
              <p className="text-sm text-slate-400">
                {sharePermission === 'edit'
                  ? 'Shared planner — you can add, complete, and delete tasks.'
                  : 'Shared planner — view only.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  sharePermission === 'edit'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                    : 'border-slate-600 bg-slate-800 text-slate-300'
                }`}
              >
                {sharePermission === 'edit' ? 'Edit access' : 'View only'}
              </span>
            </div>
          </header>
          <DayPlanner
            shareMode={sharePermission}
            externalState={sharedState}
            onExternalUpdate={handleExternalUpdate}
          />
        </div>
      </div>
    )
  }

  // ── Owner / guest rendering ────────────────────────────────────────────────
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
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-sm font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
              aria-label="Help and tips"
            >
              ?
            </button>
            {showPlanner && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenDashboard}
                  className="hidden sm:inline-flex rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
                >
                  View progress
                </button>
                {/* Monthly tracking UI commented out for now
                <button type="button" onClick={handleOpenTracking} className="...">Monthly tracking</button>
                */}
                {isAuthenticated && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="hidden sm:inline-flex rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-600 hover:text-sky-300"
                    >
                      Share
                    </button>
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
                  </>
                )}
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
      {isAuthenticated && user && (
        <ShareModal
          userId={user.id}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

export default App
