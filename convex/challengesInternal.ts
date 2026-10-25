/**
 * convex/challengesInternal.ts — what the reminder cron needs.
 *
 * `claimDueReminders` decides and records in one transaction, before any
 * email is attempted: a send that fails costs one reminder, a send that is
 * recorded twice would cost the member's trust. The cron never overlaps
 * itself (Convex skips a tick while the previous run is still going).
 */

import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { emptySummary } from "./_shared/challengeValidators"
import { reminderDecision, localDateAndMinutes, type ReminderKind } from "./_shared/challengeReminders"

/** More than anyone will ever run; a bound, not a target. */
const MAX_ACTIVE_CHALLENGES = 100

export const getUserEmail = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const id = ctx.db.normalizeId("users", args.userId)
    if (!id) return null
    const user = await ctx.db.get(id)
    return user?.email ?? null
  },
})

export interface DueReminder {
  to: string
  kind: ReminderKind
  displayName: string
  challengeName: string
  localDate: string
}

async function membersOf(ctx: QueryCtx | MutationCtx, challengeId: Id<"challenges">) {
  return await ctx.db
    .query("challengeMembers")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .take(3)
}

export const listActiveChallenges = internalQuery({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(MAX_ACTIVE_CHALLENGES)
    const out: Array<{ challenge: Doc<"challenges">; members: Doc<"challengeMembers">[] }> = []
    for (const challenge of challenges) {
      out.push({ challenge, members: await membersOf(ctx, challenge._id) })
    }
    return out
  },
})

/**
 * Ends a challenge by hand, which stops its reminders. For test seasons left
 * running on a deployment; nothing in the app calls it. Rows are kept, as
 * `leaveChallenge` keeps them, so the season stays readable.
 *   npx convex run challengesInternal:endChallenge '{"challengeId":"..."}'
 */
export const endChallenge = internalMutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.challengeId, { status: "ended" })
    return null
  },
})

export const claimDueReminders = internalMutation({
  args: { nowMs: v.number() },
  handler: async (ctx, args): Promise<DueReminder[]> => {
    const due: DueReminder[] = []
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(MAX_ACTIVE_CHALLENGES)
    for (const challenge of challenges) {
      const members = await membersOf(ctx, challenge._id)
      let everyonePastEnd = members.length > 0
      for (const member of members) {
        const local = localDateAndMinutes(args.nowMs, member.timezone)
        if (local.date <= challenge.endDate) everyonePastEnd = false
        const row = await ctx.db
          .query("challengeDays")
          .withIndex("by_challenge_user_date", (q) =>
            q.eq("challengeId", challenge._id).eq("userId", member.userId).eq("date", local.date),
          )
          .unique()
        const decision = reminderDecision({
          nowMs: args.nowMs,
          timezone: member.timezone,
          planDeadline: challenge.planDeadline,
          checkinDeadline: challenge.checkinDeadline,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          dayRow: row,
        })
        if (!decision) continue
        const userDoc = ctx.db.normalizeId("users", member.userId)
        const email = userDoc ? (await ctx.db.get(userDoc))?.email : undefined
        if (!email) continue
        const sent = row?.remindersSent ?? { plan: 0, checkin: 0 }
        const remindersSent = {
          plan: sent.plan + (decision.kind === "plan" ? 1 : 0),
          checkin: sent.checkin + (decision.kind === "checkin" ? 1 : 0),
          lastAt: args.nowMs,
        }
        if (row) {
          await ctx.db.patch(row._id, { remindersSent })
        } else {
          await ctx.db.insert("challengeDays", {
            challengeId: challenge._id,
            userId: member.userId,
            date: decision.localDate,
            summary: emptySummary(),
            summaryUpdatedAt: args.nowMs,
            dontsBroken: [],
            remindersSent,
          })
        }
        due.push({
          to: email,
          kind: decision.kind,
          displayName: member.displayName,
          challengeName: challenge.name,
          localDate: decision.localDate,
        })
      }
      if (everyonePastEnd) await ctx.db.patch(challenge._id, { status: "ended" })
    }
    return due
  },
})
