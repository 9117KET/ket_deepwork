/**
 * hooks/useIsAdmin.ts
 *
 * Whether the signed-in user's email is in the backend's `ADMIN_EMAILS`.
 * Only decides whether to show the admin link; the admin query itself
 * refuses anyone else, so hiding the link is courtesy, not the guard.
 */

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { useAuth } from "../contexts/AuthContext"

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  const status = useQuery(api.challenges.adminStatus, user ? {} : "skip")
  return status?.isAdmin ?? false
}
