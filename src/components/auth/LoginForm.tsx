/**
 * components/auth/LoginForm.tsx
 *
 * Minimal email/password authentication screen for Deepblock.
 * Uses the AuthContext to sign users in or up, with a guest option.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Deepblock</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to sync your planner across devices, or continue as a guest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
            <p className="text-sm text-sky-400" role="status">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
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

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="font-medium text-slate-400 hover:text-slate-200"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  )
}

