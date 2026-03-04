/**
 * contexts/AuthContext.tsx
 *
 * Lightweight authentication context backed by Supabase.
 * Exposes the current user and simple sign-in / sign-up / sign-out helpers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signUp: (params: { email: string; password: string }) => Promise<Error | null>
  signIn: (params: { email: string; password: string }) => Promise<Error | null>
  signOut: () => Promise<Error | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[auth] Failed to get initial session', error)
      }
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    void init()

    const {
      data: authListener,
      error: listenerError,
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    if (listenerError) {
      // eslint-disable-next-line no-console
      console.error('[auth] Failed to subscribe to auth changes', listenerError)
    }

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        return error
      }
      return null
    },
    [],
  )

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return error
      }
      return null
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      return error
    }
    return null
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

