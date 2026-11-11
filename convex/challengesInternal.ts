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
  inactivityFrom,
  missedRun,
  warningMissedSince,
  type InactivityRow,
} from "./_shared/challengeInactivity"
import { GROUP_DROP_MIN_MEMBERS, activeInJoinOrder } from "./_shared/challengeGroup"
import { handOverIfCreator, memberRowsOf, membersOf } from "./_shared/challengeMembers"

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
  /** For `warning` and `dropped`: the email goes to the quiet member themself. */
  toInactive?: boolean
  /**
   * For `plan` and `checkin`: true when a covered challenge has three or more
   * active members, so the copy says "the group", not "your partner".
   */
  group?: boolean
  /** For `checkin`: the earliest check-in deadline among the covered challenges ("22:00"). */
  checkinDeadline?: string
  /** For `warning`: the challenge has three or more active members, so a fourth quiet day drops the member instead of closing it. */
  dropsMember?: boolean
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
 * `leaveChallenge` keeps them, so the season stays readable (and the creator
 * may reopen it).
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
  /** The challenge has three or more active members. */
  group: boolean
}

/**
 * The sweep, per active challenge and per active member (all of them, up to
 * eight, in join order):
 *
 * 1. Season over (every member past the end date) ⇒ ended, `seasonOver`.
 * 2. Inactivity first (`_shared/challengeInactivity.ts`): at most four point
 *    reads on `by_challenge_user_date` for the member's last countable local
 *    dates (none before their join, the start or the latest reopen), then
 *    warn, clear or close. With two members or one, a close ends the
 *    challenge and nothing more is sent for it in this pass. With three or
 *    more, it drops that member alone (`leftAt`, `leftReason: "inactive"`,
 *    the creator role handed over if it was theirs), clears the warning,
 *    emails everyone (the dropped one too) and the challenge runs on.
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
      const memberRows = await memberRowsOf(ctx, challenge._id)
      let members = activeInJoinOrder(memberRows)
      let locals = members.map((m) => localDateAndMinutes(args.nowMs, m.timezone))
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
      let creator = challenge.createdBy
      const dropped = new Set<string>()
      for (let i = 0; i < members.length && !closed; i++) {
        const member = members[i]!
        const today = locals[i]!.date
        const from = inactivityFrom(joinedDateOf(member), challenge.reopenedDate)
        const dates = countableDates(from, challenge.startDate, today, CLOSE_AFTER_DAYS).filter((d) => d <= challenge.endDate)
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
          const dropsMember = members.length - dropped.size >= GROUP_DROP_MIN_MEMBERS
          await pushAboutEmails(ctx, out, "warning", challenge, members, member, missed, locals.map((l) => l.date), dropped, dropsMember)
        } else if (decision === "close") {
          if (members.length - dropped.size >= GROUP_DROP_MIN_MEMBERS) {
            // A group runs on without the quiet member. Their row and days are kept; an invite brings them back.
            const stillIn = memberRows.filter((r) => !dropped.has(r.userId))
            const next = await handOverIfCreator(ctx, { ...challenge, createdBy: creator }, stillIn, member)
            if (next) creator = next.userId
            await ctx.db.patch(member._id, { leftAt: args.nowMs, leftReason: "inactive" })
            warning = undefined
            await ctx.db.patch(challenge._id, { warning: undefined })
            await pushAboutEmails(ctx, out, "dropped", challenge, members, member, missed, locals.map((l) => l.date), dropped)
            dropped.add(member.userId)
          } else {
            closed = true
            await ctx.db.patch(challenge._id, { status: "ended", endedReason: "inactive", endedAt: args.nowMs })
            await pushAboutEmails(ctx, out, "closed", challenge, members, member, missed, locals.map((l) => l.date), dropped)
          }
        }
      }
      if (closed) continue
      if (dropped.size > 0) {
        const kept = members.map((m, i) => ({ m, l: locals[i]! })).filter(({ m }) => !dropped.has(m.userId))
        members = kept.map((k) => k.m)
        locals = kept.map((k) => k.l)
      }
      const group = members.length >= GROUP_DROP_MIN_MEMBERS

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
        bucket[decision.kind].push({ challenge, member, row, localDate: decision.localDate, group })
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
        // The earliest deadline among the covered challenges: the one the email must not let pass.
        const deadline = due.map((d) => d.challenge.checkinDeadline).sort()[0]!
        out.push({
          to: email,
          kind,
          displayName: first.member.displayName,
          challengeName: first.challenge.name,
          localDate: first.localDate,
          challengeId: first.challenge._id,
          challengeIds: due.map((d) => d.challenge._id),
          challengeNames: due.map((d) => d.challenge.name),
          ...(due.some((d) => d.group) ? { group: true } : {}),
          ...(kind === "checkin" ? { checkinDeadline: deadline } : {}),
        })
      }
    }
    return out
  },
})

/**
 * The warning, closed or dropped email, one to each active member with an
 * address on file (members already dropped in this pass are skipped).
 */
async function pushAboutEmails(
  ctx: MutationCtx,
  out: DueReminder[],
  kind: "warning" | "closed" | "dropped",
  challenge: Doc<"challenges">,
  members: Doc<"challengeMembers">[],
  inactive: Doc<"challengeMembers">,
  missedDays: number,
  localDates: string[],
  skip: ReadonlySet<string>,
  dropsMember = false,
): Promise<void> {
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!
    if (skip.has(m.userId)) continue
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
      ...(dropsMember ? { dropsMember: true } : {}),
    })
  }
}
