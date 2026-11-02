/**
 * components/challenge/ChallengeChrome.tsx
 *
 * The frame every challenge route shares: the app chrome with its account
 * menu, the phone tab bar (lit on Challenges), and the two states before a
 * page has anything to show. Signed-out visitors get the sign-in form: a
 * challenge needs an account on both sides, because the partner's view and
 * the reminders both hang off it.
 */

import { useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppChrome } from '../layout/AppChrome'
import { AccountMenu } from '../nav/AccountMenu'
import { LoginForm } from '../auth/LoginForm'
import { MobileTabBar } from '../planner/MobileTabBar'
import { useAuth } from '../../contexts/AuthContext'
import { useIsAdmin } from '../../hooks/useIsAdmin'

interface ChallengeChromeProps {
  children: ReactNode
  /** The sign-in form's heading for signed-out visitors. */
  signInTitle?: string
  signInSubtitle?: string
  /** Width of the content column; the dashboard is wider from `lg`. */
  wide?: boolean
}

export function ChallengeChrome({
  children,
  signInTitle = 'Challenge a friend',
  signInSubtitle = 'Sign in to start or join an accountability challenge.',
  wide = false,
}: ChallengeChromeProps) {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()

  const userInitial = useMemo(() => {
    const firstChar = (user?.email ?? '').trim().charAt(0)
    return firstChar ? firstChar.toUpperCase() : 'U'
  }, [user])
  const handleSignOut = useCallback(async () => {
    const error = await signOut()
    if (error) console.error('[auth] Failed to sign out', error)
  }, [signOut])

  const trailing = (
    <AccountMenu
      dropUp
      userInitial={userInitial}
      userEmail={user?.email}
      items={[
        { kind: 'action', key: 'planner', label: 'Back to today', onSelect: () => navigate('/') },
        { kind: 'action', key: 'review', label: 'Review', onSelect: () => navigate('/review') },
        { kind: 'action', key: 'admin', label: 'Admin', onSelect: () => navigate('/admin/challenges'), hidden: !isAdmin },
        { kind: 'separator', key: 'sep-1', hidden: !user },
        { kind: 'action', key: 'signout', label: 'Sign out', onSelect: () => void handleSignOut(), muted: true, hidden: !user },
      ]}
    />
  )
  const tabBar = <MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />

  if (loading) {
    return (
      <AppChrome trailing={trailing}>
        <div className="flex min-h-[50dvh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm" role="status">
            Loading…
          </p>
        </div>
        {tabBar}
      </AppChrome>
    )
  }

  if (!user) {
    return (
      <AppChrome trailing={trailing}>
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 pb-24">
          <LoginForm title={signInTitle} subtitle={signInSubtitle} />
        </div>
        {tabBar}
      </AppChrome>
    )
  }

  return (
    <AppChrome showCalendarLink showChallengeLink trailing={trailing}>
      <div className={`mx-auto px-4 py-5 pb-28 md:py-8 md:pb-10 ${wide ? 'max-w-xl lg:max-w-6xl lg:px-10' : 'max-w-xl'}`}>{children}</div>
      {tabBar}
    </AppChrome>
  )
}

/** A loading placeholder in the shape of what is coming, so the page does not jump. */
export function ChallengeSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-3 motion-reduce:animate-none">
      <div className="h-7 w-2/3 rounded-md bg-share-surfaceContainer" />
      <div className="h-4 w-1/2 rounded-md bg-share-surfaceContainer" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 rounded-xl bg-share-surfaceContainerLow" />
      ))}
    </div>
  )
}
