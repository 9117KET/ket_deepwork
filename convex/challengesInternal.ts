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
import {
  CLOSE_AFTER_DAYS,
  countableDates,
  inactivityDecision,
  missedRun,
  warningMissedSince,
  type InactivityRow,
} from "./_shared/challengeInactivity"

/**
 * The sweep's bound: more active challenges than anyone will ever run. Past
 * it, the oldest-created beyond the first hundred go unswept, which is why it
 * is a bound and not a target.
 */
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

/**
 * One email the sweep will send. A member in several challenges who owes
 * the same act gets one `plan` (or `checkin`) email naming them all:
 * `challengeIds`/`challengeNames` list every challenge it covers, and
 * `challengeId`/`challengeName` are the first, which the link opens.
 * `warning` and `closed` are about one challenge; `aboutName` is the quiet
 * member and `missedDays` the run that was counted.
 */
export interface DueReminder {
  to: string
  kind: ReminderKind
  displayName: string
  challengeName: string
  localDate: string
  challengeId: Id<"challenges">
  challengeIds: Id<"challenges">[]
  challengeNames: string[]
  aboutName?: string
  missedDays?: number
  /** For `warning`: the email goes to the quiet member themself. */
  toInactive?: boolean
}

async function membersOf(ctx: QueryCtx | MutationCtx, challengeId: Id<"challenges">) {
  return await ctx.db
    .query("challengeMembers")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .take(3)
}

async function emailOf(ctx: QueryCtx | MutationCtx, userId: string): Promise<string | null> {
  const id = ctx.db.normalizeId("users", userId)
  return id ? ((await ctx.db.get(id))?.email ?? null) : null
}

/** The member's local date at join: stored on newer rows, derived from `joinedAt` on older ones. */
function joinedDateOf(member: Doc<"challengeMembers">): string {
  return member.joinedDate ?? localDateAndMinutes(member.joinedAt, member.timezone).date
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
    await ctx.db.patch(args.challengeId, { status: "ended", endedReason: "manual", endedAt: Date.now() })
    return null
  },
})

/** A plan or check-in reminder one row is due, waiting to be grouped by member. */
interface DueRow {
  challenge: Doc<"challenges">
  member: Doc<"challengeMembers">
  row: Doc<"challengeDays"> | null
  localDate: string
}

/**
 * The sweep, per active challenge and per member:
 *
 * 1. Season over (every member past the end date) ⇒ ended, `seasonOver`.
 * 2. Inactivity first (`_shared/challengeInactivity.ts`): at most four point
 *    reads on `by_challenge_user_date` for the member's last countable local
 *    dates, then warn, clear or close. A close ends the challenge and nothing
 *    more is sent for it in this pass.
 * 3. Plan and check-in reminders, judged per row as before, except for the
 *    member under warning, who gets the warning and nothing else.
 *
 * Reminders are then grouped per member: one `plan` email and one `checkin`
 * email at most, naming every challenge it covers, while `remindersSent` is
 * recorded on every row it covers.
 */
export const claimDueReminders = internalMutation({
  args: { nowMs: v.number() },
  handler: async (ctx, args): Promise<DueReminder[]> => {
    const out: DueReminder[] = []
    const dueByMember = new Map<string, { plan: DueRow[]; checkin: DueRow[] }>()
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(MAX_ACTIVE_CHALLENGES)

    for (const challenge of challenges) {
      const members = await membersOf(ctx, challenge._id)
      const locals = members.map((m) => localDateAndMinutes(args.nowMs, m.timezone))
      const everyonePastEnd = members.length > 0 && locals.every((l) => l.date > challenge.endDate)
      if (everyonePastEnd) {
        await ctx.db.patch(challenge._id, { status: "ended", endedReason: "seasonOver", endedAt: args.nowMs })
        continue
      }

      // ── Inactivity ──
      let warning = challenge.warning
      // A warning naming someone who has since left can never be cleared by their act.
      if (warning && !members.some((m) => m.userId === warning!.userId)) {
        warning = undefined
        await ctx.db.patch(challenge._id, { warning: undefined })
      }
      let closed = false
      for (let i = 0; i < members.length && !closed; i++) {
        const member = members[i]!
        const today = locals[i]!.date
        const dates = countableDates(joinedDateOf(member), challenge.startDate, today, CLOSE_AFTER_DAYS).filter(
          (d) => d <= challenge.endDate,
        )
        const rows: InactivityRow[] = []
        for (const date of dates) {
          const row = await ctx.db
            .query("challengeDays")
            .withIndex("by_challenge_user_date", (q) =>
              q.eq("challengeId", challenge._id).eq("userId", member.userId).eq("date", date),
            )
            .unique()
          if (row) rows.push(row)
        }
        const missed = missedRun(rows, dates)
        const decision = inactivityDecision({ missed, warning, userId: member.userId, lastDate: dates[dates.length - 1] })
        if (decision === "clear") {
          warning = undefined
          await ctx.db.patch(challenge._id, { warning: undefined })
        } else if (decision === "warn") {
          warning = { userId: member.userId, missedSince: warningMissedSince(dates), issuedAt: args.nowMs }
          await ctx.db.patch(challenge._id, { warning })
          await pushAboutEmails(ctx, out, "warning", challenge, members, member, missed, locals.map((l) => l.date))
        } else if (decision === "close") {
          closed = true
          await ctx.db.patch(challenge._id, { status: "ended", endedReason: "inactive", endedAt: args.nowMs })
          await pushAboutEmails(ctx, out, "closed", challenge, members, member, missed, locals.map((l) => l.date))
        }
      }
      if (closed) continue

      // ── Plan and check-in reminders, per row ──
      for (let i = 0; i < members.length; i++) {
        const member = members[i]!
        if (warning && warning.userId === member.userId) continue
        const local = locals[i]!
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
        const bucket = dueByMember.get(member.userId) ?? { plan: [], checkin: [] }
        bucket[decision.kind].push({ challenge, member, row, localDate: decision.localDate })
        dueByMember.set(member.userId, bucket)
      }
    }

    // ── One email per member per kind, every covered row recorded ──
    for (const [userId, bucket] of dueByMember) {
      // Members without an email are skipped without writing a row, as before.
      const email = await emailOf(ctx, userId)
      if (!email) continue
      for (const kind of ["plan", "checkin"] as const) {
        const due = bucket[kind]
        if (due.length === 0) continue
        for (const d of due) {
          const sent = d.row?.remindersSent ?? { plan: 0, checkin: 0 }
          const remindersSent = {
            plan: sent.plan + (kind === "plan" ? 1 : 0),
            checkin: sent.checkin + (kind === "checkin" ? 1 : 0),
            lastAt: args.nowMs,
          }
          if (d.row) {
            await ctx.db.patch(d.row._id, { remindersSent })
          } else {
            await ctx.db.insert("challengeDays", {
              challengeId: d.challenge._id,
              userId,
              date: d.localDate,
              summary: emptySummary(),
              summaryUpdatedAt: args.nowMs,
              dontsBroken: [],
              remindersSent,
            })
          }
        }
        const first = due[0]!
        out.push({
          to: email,
          kind,
          displayName: first.member.displayName,
          challengeName: first.challenge.name,
          localDate: first.localDate,
          challengeId: first.challenge._id,
          challengeIds: due.map((d) => d.challenge._id),
          challengeNames: due.map((d) => d.challenge.name),
        })
      }
    }
    return out
  },
})

/** The warning or closed email, one to each member with an address on file. */
async function pushAboutEmails(
  ctx: MutationCtx,
  out: DueReminder[],
  kind: "warning" | "closed",
  challenge: Doc<"challenges">,
  members: Doc<"challengeMembers">[],
  inactive: Doc<"challengeMembers">,
  missedDays: number,
  localDates: string[],
): Promise<void> {
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!
    const email = await emailOf(ctx, m.userId)
    if (!email) continue
    out.push({
      to: email,
      kind,
      displayName: m.displayName,
      challengeName: challenge.name,
      localDate: localDates[i]!,
      challengeId: challenge._id,
      challengeIds: [challenge._id],
      challengeNames: [challenge.name],
      aboutName: inactive.displayName,
      missedDays,
      toInactive: m.userId === inactive.userId,
    })
  }
}
