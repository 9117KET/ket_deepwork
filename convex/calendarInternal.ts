import { internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"

export const getConnection = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
  },
})

export const storeOAuthConnection = internalMutation({
  args: { userId: v.string(), encryptedRefreshToken: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { encryptedRefreshToken: args.encryptedRefreshToken })
    } else {
      await ctx.db.insert("googleCalendarConnections", {
        userId: args.userId,
        encryptedRefreshToken: args.encryptedRefreshToken,
      })
    }
  },
})

export const setSelectedCalendar = internalMutation({
  args: { userId: v.string(), calendarId: v.string(), calendarSummary: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (!existing) throw new Error("Google Calendar not connected")
    await ctx.db.patch(existing._id, {
      selectedCalendarId: args.calendarId,
      selectedCalendarSummary: args.calendarSummary,
    })
  },
})

export const deleteConnection = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_task", (q) => q.eq("userId", args.userId))
      .collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    const conn = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (conn) await ctx.db.delete(conn._id)
  },
})

export const getEventLink = internalQuery({
  args: { userId: v.string(), googleCalendarId: v.string(), googleEventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_event", (q) =>
        q
          .eq("userId", args.userId)
          .eq("googleCalendarId", args.googleCalendarId)
          .eq("googleEventId", args.googleEventId),
      )
      .unique()
  },
})

export const getTaskEventLink = internalQuery({
  args: { userId: v.string(), taskDate: v.string(), taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_task", (q) =>
        q.eq("userId", args.userId).eq("taskDate", args.taskDate).eq("taskId", args.taskId),
      )
      .unique()
  },
})

export const upsertEventLink = internalMutation({
  args: {
    userId: v.string(),
    taskId: v.string(),
    taskDate: v.string(),
    googleCalendarId: v.string(),
    googleEventId: v.string(),
    etag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_event", (q) =>
        q
          .eq("userId", args.userId)
          .eq("googleCalendarId", args.googleCalendarId)
          .eq("googleEventId", args.googleEventId),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { etag: args.etag })
    } else {
      await ctx.db.insert("calendarEventLinks", args)
    }
  },
})

export const deleteEventLink = internalMutation({
  args: { userId: v.string(), googleCalendarId: v.string(), googleEventId: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_event", (q) =>
        q
          .eq("userId", args.userId)
          .eq("googleCalendarId", args.googleCalendarId)
          .eq("googleEventId", args.googleEventId),
      )
      .unique()
    if (link) await ctx.db.delete(link._id)
  },
})

export const updateEventLinkEtag = internalMutation({
  args: { userId: v.string(), googleCalendarId: v.string(), googleEventId: v.string(), etag: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("calendarEventLinks")
      .withIndex("by_user_event", (q) =>
        q
          .eq("userId", args.userId)
          .eq("googleCalendarId", args.googleCalendarId)
          .eq("googleEventId", args.googleEventId),
      )
      .unique()
    if (link) await ctx.db.patch(link._id, { etag: args.etag })
  },
})

export const getPlannerDaysInRange = internalQuery({
  args: { userId: v.string(), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("plannerDays")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
    return all.filter((d) => d.date >= args.startDate && d.date <= args.endDate)
  },
})

export const upsertPlannerDay = internalMutation({
  args: {
    userId: v.string(),
    date: v.string(),
    tasks: v.array(v.any()),
    deepWorkSessions: v.optional(v.array(v.any())),
    habitCompletions: v.optional(v.record(v.string(), v.boolean())),
    sleepHours: v.optional(v.number()),
    mood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...rest } = args
    const existing = await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .unique()
    // Stamp updatedAt like a client write would. Without it the row keeps its
    // old client stamp, so devices treat the imported tasks as stale (never
    // applying them) and the next client sync clobbers them off the server.
    const stamped = { ...rest, updatedAt: Date.now() }
    if (existing) {
      await ctx.db.patch(existing._id, stamped)
    } else {
      await ctx.db.insert("plannerDays", {
        userId,
        deepWorkSessions: [],
        ...stamped,
      })
    }
  },
})
