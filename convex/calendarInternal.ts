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
  args: { userId: v.string(), encryptedRefreshToken: v.string(), grantedScopes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedRefreshToken: args.encryptedRefreshToken,
        grantedScopes: args.grantedScopes,
      })
    } else {
      await ctx.db.insert("googleCalendarConnections", {
        userId: args.userId,
        encryptedRefreshToken: args.encryptedRefreshToken,
        grantedScopes: args.grantedScopes,
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
    const taskLinks = await ctx.db
      .query("googleTaskLinks")
      .withIndex("by_user_task", (q) => q.eq("userId", args.userId))
      .collect()
    for (const link of taskLinks) {
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

// ─── Google Tasks links ────────────────────────────────────────────────────────

export const setTaskList = internalMutation({
  args: { userId: v.string(), taskListId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (!existing) throw new Error("Google Calendar not connected")
    await ctx.db.patch(existing._id, { taskListId: args.taskListId })
  },
})

export const getTaskLinksForDate = internalQuery({
  args: { userId: v.string(), taskDate: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleTaskLinks")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("taskDate", args.taskDate))
      .collect()
  },
})

export const getTaskLink = internalQuery({
  args: { userId: v.string(), taskDate: v.string(), taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleTaskLinks")
      .withIndex("by_user_task", (q) =>
        q.eq("userId", args.userId).eq("taskDate", args.taskDate).eq("taskId", args.taskId),
      )
      .unique()
  },
})

/**
 * Record a freshly inserted Google Task against its planner task. Two devices
 * syncing the same day at once can both insert; the second to arrive is told
 * so (`duplicate`) and deletes its copy, so a task is never mirrored twice.
 */
export const linkGoogleTask = internalMutation({
  args: {
    userId: v.string(),
    taskId: v.string(),
    taskDate: v.string(),
    googleTaskListId: v.string(),
    googleTaskId: v.string(),
    syncedTitle: v.string(),
    syncedDone: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ duplicate: boolean }> => {
    const existing = await ctx.db
      .query("googleTaskLinks")
      .withIndex("by_user_task", (q) =>
        q.eq("userId", args.userId).eq("taskDate", args.taskDate).eq("taskId", args.taskId),
      )
      .unique()
    if (existing) {
      if (existing.googleTaskId !== args.googleTaskId && !existing.remoteGone) return { duplicate: true }
      await ctx.db.patch(existing._id, {
        googleTaskListId: args.googleTaskListId,
        googleTaskId: args.googleTaskId,
        syncedTitle: args.syncedTitle,
        syncedDone: args.syncedDone,
        remoteGone: undefined,
      })
      return { duplicate: false }
    }
    await ctx.db.insert("googleTaskLinks", args)
    return { duplicate: false }
  },
})

export const recordTaskLinkSynced = internalMutation({
  args: { linkId: v.id("googleTaskLinks"), syncedTitle: v.string(), syncedDone: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, { syncedTitle: args.syncedTitle, syncedDone: args.syncedDone })
  },
})

export const markTaskLinkGone = internalMutation({
  args: { linkId: v.id("googleTaskLinks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, { remoteGone: true })
  },
})

export const deleteTaskLink = internalMutation({
  args: { linkId: v.id("googleTaskLinks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.linkId)
  },
})
