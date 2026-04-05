/**
 * components/auth/LoginForm.tsx
 *
 * Minimal email/password authentication screen for Life Planner.
 * Uses the AuthContext to sign users in or up, with a guest option.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface LoginFormProps {
  onContinueAsGuest: () => void
}

export function LoginForm({ onContinueAsGuest }: LoginFormProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both email and password.')
      setSubmitting(false)
      return
    }

    if (trimmedPassword.length < 6) {
      setErrorMessage('Password should be at least 6 characters.')
      setSubmitting(false)
      return
    }

    const action = mode === 'signin' ? signIn : signUp
    const error = await action({ email: trimmedEmail, password: trimmedPassword })

    if (error) {
      setErrorMessage(error.message ?? 'Authentication failed. Please try again.')
    } else if (mode === 'signup') {
      setInfoMessage(
        'Account created. You may need to confirm your email depending on project settings, then sign in.',
      )
    }

    setSubmitting(false)
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-share-outlineVariant/30 bg-share-surfaceContainerLow p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 text-center">
          <h1 className="font-shareHeadline text-2xl font-black tracking-tight text-share-onSurface">Life Planner</h1>
          <p className="mt-1 text-sm text-share-onSurfaceVariant">
            Sign in to sync your planner across devices, or continue as a guest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-share-onSurface">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onSurface placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-share-onSurface">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-sm text-share-onSurface placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
              placeholder="At least 6 characters"
              disabled={submitting}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
          {infoMessage && (
            <p className="text-sm text-share-primary" role="status">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer disabled:opacity-60"
          >
            {submitting
              ? mode === 'signin'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-1 text-center text-xs text-share-onSurfaceVariant">
            By creating an account you agree to our{' '}
            <Link to="/terms" className="font-medium text-share-primary hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="font-medium text-share-primary hover:underline">Privacy Policy</Link>.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 text-xs text-share-onSurfaceVariant sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-left font-bold text-share-primary hover:text-share-primaryContainer"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="text-left font-medium text-share-onSurfaceVariant hover:text-share-onSurface sm:text-right"
          >
            Continue as guest
          </button>
        </div>
    </div>
  )
}

