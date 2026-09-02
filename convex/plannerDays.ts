import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getUserId } from "./_shared/auth"

/**
 * Every day the user has, as one reactive subscription.
 *
 * Kept for the restore tooling and for callers that genuinely want the lot, but
 * NOT used by the planner's live sync any more - see `getRecent`/`getArchive`
 * below for why.
 */
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

/**
 * The planner's live sync is split across two subscriptions, and the split is
 * the whole point.
 *
 * A Convex query re-runs whenever anything in its read set changes. `getAll`
 * reads every day the user owns, so ticking one task off today re-read the
 * entire history - 110 days and ~610 KB at the time of writing, growing
 * linearly forever. At a hundred edits a day that is ~1.75 GB of read I/O a
 * month against a 1 GB free-tier budget, which is precisely how this project
 * blew its Convex quota in June 2026 and lost writes for weeks.
 *
 * Splitting on a date boundary scopes each read set. Editing today invalidates
 * only `getRecent`, which reads a fortnight rather than a lifetime; the archive
 * re-runs solely when an old day is edited, which is rare. Both are indexed
 * range reads, so nothing scans. The cost of an ordinary edit stops growing
 * with the history behind it.
 *
 * The boundary is passed in rather than computed here so both halves are
 * guaranteed to agree on it - a server-side "today" could sit on the far side
 * of midnight from the client's and silently drop or double a day.
 */
export const getRecent = query({
  args: { since: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    return await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", args.since))
      .collect()
  },
})

/** Everything older than the hot window. Rarely invalidated - see `getRecent`. */
export const getArchive = query({
  args: { before: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    return await ctx.db
      .query("plannerDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).lt("date", args.before))
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

