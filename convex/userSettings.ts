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
    routineMinutes: v.optional(v.any()),
    notDoingList: v.optional(v.array(v.any())),
    identityStatement: v.optional(v.string()),
    depthPhilosophy: v.optional(v.string()),
    deepWorkGoalHours: v.optional(v.number()),
    focusBlockMinutes: v.optional(v.number()),
    focusBreakMinutes: v.optional(v.number()),
    oneThingData: v.optional(v.any()),
    weeklyProjectRotation: v.optional(v.array(v.any())),
    sideQuestDefs: v.optional(v.array(v.any())),
    sideQuestXp: v.optional(v.number()),
    sideQuestStreak: v.optional(v.number()),
    sideQuestLastStreakDate: v.optional(v.string()),
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
    if (args.focusBlockMinutes !== undefined && (args.focusBlockMinutes < 1 || args.focusBlockMinutes > 480)) {
      throw new Error("focusBlockMinutes must be between 1 and 480")
    }
    if (args.focusBreakMinutes !== undefined && (args.focusBreakMinutes < 0 || args.focusBreakMinutes > 240)) {
      throw new Error("focusBreakMinutes must be between 0 and 240")
    }
    if (args.routineMinutes !== undefined && args.routineMinutes !== null) {
      const r = args.routineMinutes as { morningRoutine?: unknown; nightRoutine?: unknown }
      for (const key of ["morningRoutine", "nightRoutine"] as const) {
        const value = r[key]
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 180) {
          throw new Error(`routineMinutes.${key} must be a number between 0 and 180`)
        }
      }
    }
    const userId = getUserId(identity.subject)
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
