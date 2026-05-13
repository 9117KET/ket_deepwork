import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react"
import { useConvexAuth, useQuery } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { api } from "../../convex/_generated/api"

export interface AppUser {
  id: string
  email?: string
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signUp: (params: { email: string; password: string }) => Promise<Error | null>
  signIn: (params: { email: string; password: string }) => Promise<Error | null>
  signOut: () => Promise<Error | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions()

  const currentUser = useQuery(
    api.users.currentUser,
    isAuthenticated ? {} : "skip",
  )

  const user: AppUser | null =
    isAuthenticated && currentUser
      ? { id: currentUser.id, email: currentUser.email ?? undefined }
      : null

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      try {
        await convexSignIn("password", { email, password, flow: "signIn" })
        return null
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e))
      }
    },
    [convexSignIn],
  )

  const signUp = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      try {
        await convexSignIn("password", { email, password, flow: "signUp" })
        return null
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e))
      }
    },
    [convexSignIn],
  )

  const signOut = useCallback(async () => {
    try {
      await convexSignOut()
      return null
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e))
    }
  }, [convexSignOut])

  return (
    <AuthContext.Provider
      value={{ user, loading: isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
