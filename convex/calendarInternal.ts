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
      // Patch the full mapping, not just the etag: the task id/date change
      // when an event moves days or its task is re-created after deletion.
      await ctx.db.patch(existing._id, {
        taskId: args.taskId,
        taskDate: args.taskDate,
        etag: args.etag,
      })
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

export const setLogCalendar = internalMutation({
  args: { userId: v.string(), logCalendarId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (!existing) throw new Error("Google Calendar not connected")
    await ctx.db.patch(existing._id, { logCalendarId: args.logCalendarId })
  },
})
