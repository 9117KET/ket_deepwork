import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getUserId } from "./_shared/auth"

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    return await ctx.db
      .query("financialSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
  },
})

export const save = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)
    const existing = await ctx.db
      .query("financialSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data })
    } else {
      await ctx.db.insert("financialSettings", { userId, data: args.data })
    }
  },
})
