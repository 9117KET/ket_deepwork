import { query } from "./_generated/server"
import { getUserId } from "./_shared/auth"

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return {
      id: getUserId(identity.subject),
      email: identity.email,
    }
  },
})
