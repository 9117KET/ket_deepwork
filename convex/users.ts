import { query } from "./_generated/server"
import { getUserId } from "./_shared/auth"

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    // The Password provider's JWT carries no email claim, so `identity.email`
    // is empty; the `users` row (whose id the subject is built from) has it.
    const id = ctx.db.normalizeId("users", userId)
    const user = id ? await ctx.db.get(id) : null
    return {
      id: userId,
      email: user?.email ?? identity.email ?? null,
    }
  },
})
