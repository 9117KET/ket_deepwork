import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = identity.subject
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
  },
})

export const upsert = mutation({
  args: {
    habitDefinitions: v.optional(v.array(v.any())),
    monthTitles: v.optional(v.record(v.string(), v.string())),
    activeDays: v.optional(v.array(v.string())),
    blockDurationRatios: v.optional(v.any()),
    notDoingList: v.optional(v.array(v.any())),
    identityStatement: v.optional(v.string()),
    depthPhilosophy: v.optional(v.string()),
    deepWorkGoalHours: v.optional(v.number()),
    oneThingData: v.optional(v.any()),
    weeklyProjectRotation: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    if (args.identityStatement && args.identityStatement.length > 2000) {
      throw new Error("identityStatement exceeds 2000 character limit")
    }
    if (args.deepWorkGoalHours !== undefined && (args.deepWorkGoalHours < 0 || args.deepWorkGoalHours > 168)) {
      throw new Error("deepWorkGoalHours must be between 0 and 168")
    }
    const userId = identity.subject
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert("userSettings", { userId, ...args })
    }
  },
})
