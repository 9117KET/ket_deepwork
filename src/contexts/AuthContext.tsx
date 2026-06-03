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

function friendlyAuthError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes("InvalidAccountId")) return new Error("No account found with that email address.")
  if (msg.includes("InvalidSecret")) return new Error("Incorrect password. Please try again.")
  if (msg.includes("AccountAlreadyExists")) return new Error("An account with this email already exists. Please sign in.")
  if (msg.includes("TooManyFailedAttempts")) return new Error("Too many failed attempts. Please wait a moment and try again.")
  return new Error("Authentication failed. Please check your credentials and try again.")
}

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
        return friendlyAuthError(e)
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
        return friendlyAuthError(e)
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
