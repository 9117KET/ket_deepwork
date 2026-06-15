import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getUserId } from "./_shared/auth"

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    return await ctx.db
      .query("plannerDays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  },
})

const dayArgs = {
  date: v.string(),
  tasks: v.array(v.any()),
  deepWorkSessions: v.array(v.any()),
  habitCompletions: v.optional(v.record(v.string(), v.boolean())),
  sleepHours: v.optional(v.number()),
  mood: v.optional(v.string()),
  bedTime: v.optional(v.string()),
  wakeTime: v.optional(v.string()),
  sleepTarget: v.optional(v.string()),
  blockDurations: v.optional(v.any()),
  notDoingItems: v.optional(v.array(v.any())),
  abandonedTasks: v.optional(v.array(v.any())),
  timeOffsetMinutes: v.optional(v.number()),
  sideQuestCompletions: v.optional(v.record(v.string(), v.boolean())),
  dayNote: v.optional(v.string()),
  focusHijacker: v.optional(v.string()),
  shutdownCompletedAt: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
}

// A write is stale (and must be ignored) when the stored row carries a strictly
// newer client edit-time than the incoming payload. Rows predating this field
// have no updatedAt and are always overwritten.
function isStaleWrite(existing: { updatedAt?: number } | null, incoming: { updatedAt?: number }): boolean {
  if (!existing) return false
  return (existing.updatedAt ?? 0) > (incoming.updatedAt ?? 0)
}

export const upsert = mutation({
  args: dayArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)
    const existing = await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .unique()
    if (existing) {
      if (isStaleWrite(existing, args)) return
      await ctx.db.patch(existing._id, { ...args, userId })
    } else {
      await ctx.db.insert("plannerDays", { ...args, userId })
    }
  },
})

export const upsertMany = mutation({
  args: { days: v.array(v.object(dayArgs)) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = getUserId(identity.subject)
    for (const day of args.days) {
      const existing = await ctx.db
        .query("plannerDays")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", day.date))
        .unique()
      if (existing) {
        if (isStaleWrite(existing, day)) continue
        await ctx.db.patch(existing._id, { ...day, userId })
      } else {
        await ctx.db.insert("plannerDays", { ...day, userId })
      }
    }
  },
})

