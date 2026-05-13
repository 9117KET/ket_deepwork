import { ConvexReactClient } from "convex/react"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

if (!convexUrl) {
  console.warn(
    "[convex] Missing VITE_CONVEX_URL. Convex features will be disabled until configured.",
  )
}

export const convex = new ConvexReactClient(convexUrl ?? "")
