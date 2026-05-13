import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// ─── Owner: manage tokens ─────────────────────────────────────────────────────

export const listTokens = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const userId = identity.subject
    return await ctx.db
      .query("shareTokens")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
      .order("desc")
      .collect()
  },
})

export const createToken = mutation({
  args: {
    permission: v.union(v.literal("view"), v.literal("edit")),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const ownerUserId = identity.subject
    const token = crypto.randomUUID()
    const id = await ctx.db.insert("shareTokens", {
      ownerUserId,
      token,
      permission: args.permission,
      label: args.label,
    })
    return { id, token, permission: args.permission, label: args.label ?? null }
  },
})

export const deleteToken = mutation({
  args: { tokenId: v.id("shareTokens") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const userId = identity.subject
    const existing = await ctx.db.get(args.tokenId)
    if (!existing || existing.ownerUserId !== userId) {
      throw new Error("Token not found or access denied")
    }
    await ctx.db.delete(args.tokenId)
  },
})

// ─── Visitor: validate token and load shared planner ─────────────────────────

export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("shareTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!row) return null
    return { permission: row.permission }
  },
})

export const getSharedPlanner = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenRow = await ctx.db
      .query("shareTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!tokenRow) return null

    const days = await ctx.db
      .query("plannerDays")
      .withIndex("by_user", (q) => q.eq("userId", tokenRow.ownerUserId))
      .collect()

    return days.map((d) => ({
      date: d.date,
      tasks: d.tasks,
      deepWorkSessions: d.deepWorkSessions,
      habitCompletions: d.habitCompletions,
      sleepHours: d.sleepHours,
      mood: d.mood,
    }))
  },
})

export const upsertSharedDay = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    tasks: v.array(v.any()),
    deepWorkSessions: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { token, date, tasks, deepWorkSessions } = args
    const tokenRow = await ctx.db
      .query("shareTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique()
    if (!tokenRow) throw new Error("Invalid share token")
    if (tokenRow.permission !== "edit") throw new Error("Token does not have edit permission")

    const existing = await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", tokenRow.ownerUserId).eq("date", date))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { tasks, deepWorkSessions })
    } else {
      await ctx.db.insert("plannerDays", {
        userId: tokenRow.ownerUserId,
        date,
        tasks,
        deepWorkSessions,
      })
    }
  },
})
