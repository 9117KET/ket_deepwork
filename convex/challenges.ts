/**
 * convex/challenges.ts — the two-person accountability challenge.
 *
 * Two people agree on a span of days. Each member sets their own goals and
 * "don'ts" (on their `challengeMembers` row, editable any time, readable by
 * the partner), and each day has two explicit acts: lock in the plan (before
 * a morning deadline) and check in (before midnight). The planner itself
 * stays private. What a partner sees is the `summary` each member's own
 * client publishes — Top 3 titles, counts, earned minutes, habits — never a
 * `plannerDays` row. A task marked private is counted in that summary, never
 * titled.
 *
 * A removed don't is archived, never deleted, so a confession that named it
 * still resolves. Challenges created before per-member lists keep theirs on
 * the `challenges` row; `memberCommitments` hands them to the creator.
 *
 * Membership is checked on every read and write, and every function derives
 * the caller from the identity, never from an argument. The partner's
 * `userId` is never returned to the client; the member view is a display
 * name, a timezone and the member's lists.
 */

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { getUserId } from "./_shared/auth"
import { HHMM, ISO_DATE, emptySummary, summaryValidator, type ChallengeSummary, type Dont } from "./_shared/challengeValidators"
import { isValidTimezone, localDateAndMinutes, CHECKIN_START, hhmmToMinutes } from "./_shared/challengeReminders"
import { NUDGE_DAILY_CAP, NUDGE_MIN_GAP_MS, nudgeAvailability, nudgeRefusal, nudgeTimes, partnerOwesToday } from "./_shared/challengeNudges"

type Ctx = QueryCtx | MutationCtx

const MAX_MEMBERS = 2
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_NAME = 80
const MAX_LIST = 10
const MAX_ITEM = 200
const MAX_DISPLAY_NAME = 40
const MAX_NOTE = 1000
/** A challenge is a season, not a lifetime: 200 rows per member is five times the one being run. */
const HISTORY_CAP = 200

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireUser(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  return getUserId(identity.subject)
}

interface Membership {
  challenge: Doc<"challenges">
  me: Doc<"challengeMembers">
}

/** A person has at most a handful of memberships ever; the newest active one wins. */
async function activeMembership(ctx: Ctx, userId: string): Promise<Membership | null> {
  const rows = await ctx.db
    .query("challengeMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(5)
  for (const me of rows) {
    const challenge = await ctx.db.get(me.challengeId)
    if (challenge && challenge.status === "active") return { challenge, me }
  }
  return null
}

async function requireMembership(ctx: Ctx, userId: string): Promise<Membership> {
  const membership = await activeMembership(ctx, userId)
  if (!membership) throw new Error("You are not in a challenge")
  return membership
}

async function membersOf(ctx: Ctx, challengeId: Id<"challenges">): Promise<Doc<"challengeMembers">[]> {
  return await ctx.db
    .query("challengeMembers")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .take(MAX_MEMBERS + 1)
}

async function partnerOf(ctx: Ctx, challengeId: Id<"challenges">, userId: string) {
  const members = await membersOf(ctx, challengeId)
  return members.find((m) => m.userId !== userId) ?? null
}

async function getDayRow(ctx: Ctx, challengeId: Id<"challenges">, userId: string, date: string) {
  return await ctx.db
    .query("challengeDays")
    .withIndex("by_challenge_user_date", (q) => q.eq("challengeId", challengeId).eq("userId", userId).eq("date", date))
    .unique()
}

/** The newest invite that is still open, if any. */
async function openInvite(ctx: Ctx, challengeId: Id<"challenges">, now: number) {
  const invites = await ctx.db
    .query("challengeInvites")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .order("desc")
    .take(10)
  return invites.find((i) => !i.acceptedBy && i.expiresAt > now) ?? null
}

function challengeView(c: Doc<"challenges">) {
  return {
    id: c._id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    planDeadline: c.planDeadline,
    checkinDeadline: c.checkinDeadline,
    createdAt: c.createdAt,
    status: c.status,
  }
}

/**
 * A member's own goals and don'ts. Rows written before per-member lists have
 * none; the creator's then come from the challenge row, where they used to
 * live, and anyone else starts empty. This is the whole migration.
 */
function memberCommitments(challenge: Doc<"challenges">, member: Doc<"challengeMembers">): { goals: string[]; donts: Dont[] } {
  const legacy = member.userId === challenge.createdBy
  return {
    goals: member.goals ?? (legacy ? challenge.goals : []),
    donts: member.donts ?? (legacy ? challenge.donts : []),
  }
}

function memberView(challenge: Doc<"challenges">, m: Doc<"challengeMembers">) {
  const { goals, donts } = memberCommitments(challenge, m)
  return { displayName: m.displayName, timezone: m.timezone, joinedAt: m.joinedAt, goals, donts }
}

/** What the partner may see of a day. Reminder bookkeeping stays out. */
function dayView(row: Doc<"challengeDays">) {
  return {
    date: row.date,
    summary: row.summary,
    summaryUpdatedAt: row.summaryUpdatedAt,
    planSetAt: row.planSetAt ?? null,
    checkinAt: row.checkinAt ?? null,
    note: row.note ?? null,
    dontsBroken: row.dontsBroken,
  }
}
export type ChallengeDayView = ReturnType<typeof dayView>

function assertIsoDate(value: string, label: string): void {
  if (!ISO_DATE.test(value)) throw new Error(`${label} must be YYYY-MM-DD`)
}

function assertHhmm(value: string, label: string): void {
  if (!HHMM.test(value)) throw new Error(`${label} must be HH:MM`)
}

function inRange(challenge: Doc<"challenges">, date: string): boolean {
  return date >= challenge.startDate && date <= challenge.endDate
}

function cleanList(items: string[], label: string): string[] {
  if (items.length > MAX_LIST) throw new Error(`At most ${MAX_LIST} ${label}`)
  const cleaned = items.map((s) => s.trim()).filter((s) => s.length > 0)
  for (const item of cleaned) {
    if (item.length > MAX_ITEM) throw new Error(`Each of the ${label} must be ${MAX_ITEM} characters or fewer`)
  }
  return cleaned
}

/** New don'ts from cleaned texts. `offset` keeps ids unique beside a member's existing ones. */
function mintDonts(texts: string[], now: number, offset = 0): Dont[] {
  return texts.map((text, i) => ({ id: `dont-${now}-${offset + i + 1}`, text }))
}

function cleanDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("A display name is required")
  if (trimmed.length > MAX_DISPLAY_NAME) throw new Error(`Display name must be ${MAX_DISPLAY_NAME} characters or fewer`)
  return trimmed
}

function cleanTimezone(timezone: string): string {
  if (!isValidTimezone(timezone)) throw new Error("Unknown timezone")
  return timezone
}

async function upsertDay(
  ctx: MutationCtx,
  challengeId: Id<"challenges">,
  userId: string,
  date: string,
  summary: ChallengeSummary,
  extra: Partial<Pick<Doc<"challengeDays">, "planSetAt" | "checkinAt" | "note" | "dontsBroken">> = {},
): Promise<Doc<"challengeDays">> {
  const now = Date.now()
  const existing = await getDayRow(ctx, challengeId, userId, date)
  if (existing) {
    await ctx.db.patch(existing._id, { summary, summaryUpdatedAt: now, ...extra })
    return (await ctx.db.get(existing._id))!
  }
  const id = await ctx.db.insert("challengeDays", {
    challengeId,
    userId,
    date,
    summary,
    summaryUpdatedAt: now,
    dontsBroken: [],
    remindersSent: { plan: 0, checkin: 0 },
    ...extra,
  })
  return (await ctx.db.get(id))!
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** The caller's active challenge, or null. */
export const myChallenge = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    const membership = await activeMembership(ctx, userId)
    if (!membership) return null
    const { challenge, me } = membership
    const partner = await partnerOf(ctx, challenge._id, userId)
    const invite = partner ? null : await openInvite(ctx, challenge._id, Date.now())
    return {
      challenge: challengeView(challenge),
      me: memberView(challenge, me),
      partner: partner ? memberView(challenge, partner) : null,
      invite: invite ? { token: invite.token, expiresAt: invite.expiresAt } : null,
    }
  },
})

/**
 * Today for both members. Each lives on their own local date, so the client
 * passes both; a query cannot watch a wall clock.
 */
export const dayCards = query({
  args: { myDate: v.string(), partnerDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    const membership = await activeMembership(ctx, userId)
    if (!membership) return null
    assertIsoDate(args.myDate, "myDate")
    assertIsoDate(args.partnerDate, "partnerDate")
    const { challenge } = membership
    const mine = await getDayRow(ctx, challenge._id, userId, args.myDate)
    const partner = await partnerOf(ctx, challenge._id, userId)
    const partnerRow = partner ? await getDayRow(ctx, challenge._id, partner.userId, args.partnerDate) : null
    return {
      mine: mine ?? null,
      partner: partnerRow ? dayView(partnerRow) : null,
    }
  },
})

/**
 * Every day from the start up to `toDate`, for both members. Callers pass
 * yesterday, not today: today's row is rewritten on every planner edit, and
 * keeping it out of this read set is what stops each keystroke from
 * re-reading a whole season (the same hot/cold rule as `plannerDays`).
 */
export const history = query({
  args: { toDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const userId = getUserId(identity.subject)
    const membership = await activeMembership(ctx, userId)
    if (!membership) return null
    assertIsoDate(args.toDate, "toDate")
    const { challenge } = membership
    const partner = await partnerOf(ctx, challenge._id, userId)
    const rowsFor = async (memberId: string) =>
      (
        await ctx.db
          .query("challengeDays")
          .withIndex("by_challenge_user_date", (q) =>
            q.eq("challengeId", challenge._id).eq("userId", memberId).gte("date", challenge.startDate).lte("date", args.toDate),
          )
          .take(HISTORY_CAP)
      ).map(dayView)
    return {
      mine: await rowsFor(userId),
      partner: partner ? await rowsFor(partner.userId) : [],
    }
  },
})

/** What an invite link opens onto. No auth: the visitor may not have an account yet. */
export const invitePreview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const none = { challenge: null, inviterName: null, inviterGoals: [] as string[], inviterDonts: [] as string[] }
    const noLists = { inviterGoals: [] as string[], inviterDonts: [] as string[] }
    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!invite) return { status: "notFound" as const, ...none }
    const challenge = await ctx.db.get(invite.challengeId)
    if (!challenge || challenge.status !== "active") return { status: "ended" as const, ...none }
    const preview = { name: challenge.name, startDate: challenge.startDate, endDate: challenge.endDate }
    if (invite.acceptedBy) return { status: "used" as const, challenge: preview, inviterName: null, ...noLists }
    if (invite.expiresAt <= Date.now()) return { status: "expired" as const, challenge: preview, inviterName: null, ...noLists }
    const members = await membersOf(ctx, challenge._id)
    const inviter = members.find((m) => m.userId === invite.createdBy) ?? null
    const inviterName = inviter?.displayName ?? null
    // What the friend is signing up next to: the inviter's active lists, texts only.
    const lists = inviter ? memberCommitments(challenge, inviter) : null
    const inviterLists = lists
      ? { inviterGoals: lists.goals, inviterDonts: lists.donts.filter((d) => d.archivedAt === undefined).map((d) => d.text) }
      : noLists
    if (members.length >= MAX_MEMBERS) return { status: "full" as const, challenge: preview, inviterName, ...inviterLists }
    return { status: "ok" as const, challenge: preview, inviterName, ...inviterLists }
  },
})

// ─── Setup ────────────────────────────────────────────────────────────────────

export const createChallenge = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    goals: v.array(v.string()),
    donts: v.array(v.string()),
    planDeadline: v.string(),
    checkinDeadline: v.string(),
    timezone: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    if (await activeMembership(ctx, userId)) throw new Error("You are already in a challenge")
    const name = args.name.trim()
    if (!name) throw new Error("A name is required")
    if (name.length > MAX_NAME) throw new Error(`Name must be ${MAX_NAME} characters or fewer`)
    assertIsoDate(args.startDate, "startDate")
    assertIsoDate(args.endDate, "endDate")
    if (args.startDate > args.endDate) throw new Error("The challenge must end on or after it starts")
    assertHhmm(args.planDeadline, "planDeadline")
    assertHhmm(args.checkinDeadline, "checkinDeadline")
    if (hhmmToMinutes(args.planDeadline) >= hhmmToMinutes(CHECKIN_START)) {
      throw new Error(`The plan deadline must be before ${CHECKIN_START}`)
    }
    const timezone = cleanTimezone(args.timezone)
    const displayName = cleanDisplayName(args.displayName)
    const goals = cleanList(args.goals, "goals")
    const dontTexts = cleanList(args.donts, "don'ts")
    const now = Date.now()
    const donts = mintDonts(dontTexts, now)
    // The lists are the creator's own; the challenge row keeps empty legacy fields.
    const challengeId = await ctx.db.insert("challenges", {
      name,
      startDate: args.startDate,
      endDate: args.endDate,
      goals: [],
      donts: [],
      planDeadline: args.planDeadline,
      checkinDeadline: args.checkinDeadline,
      createdBy: userId,
      createdAt: now,
      status: "active",
    })
    await ctx.db.insert("challengeMembers", {
      challengeId,
      userId,
      timezone,
      displayName,
      joinedAt: now,
      goals,
      donts,
      commitmentsUpdatedAt: now,
    })
    return { challengeId }
  },
})

/** A link to paste to the friend. One open invite at a time; asking again returns it. */
export const createInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMembership(ctx, userId)
    const members = await membersOf(ctx, challenge._id)
    if (members.length >= MAX_MEMBERS) throw new Error("The challenge already has two members")
    const now = Date.now()
    const open = await openInvite(ctx, challenge._id, now)
    if (open) return { token: open.token, expiresAt: open.expiresAt }
    const token = crypto.randomUUID()
    const expiresAt = now + INVITE_TTL_MS
    await ctx.db.insert("challengeInvites", { challengeId: challenge._id, token, createdBy: userId, expiresAt })
    return { token, expiresAt }
  },
})

/** Joining. The joiner may bring their own lists; without them they start empty. */
export const acceptInvite = mutation({
  args: {
    token: v.string(),
    timezone: v.string(),
    displayName: v.string(),
    goals: v.optional(v.array(v.string())),
    donts: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!invite) throw new Error("This invite link is not valid")
    const challenge = await ctx.db.get(invite.challengeId)
    if (!challenge || challenge.status !== "active") throw new Error("This challenge has ended")
    const members = await membersOf(ctx, challenge._id)
    if (members.some((m) => m.userId === userId)) return { challengeId: challenge._id }
    if (invite.acceptedBy) throw new Error("This invite has already been used")
    if (invite.expiresAt <= now) throw new Error("This invite has expired")
    if (members.length >= MAX_MEMBERS) throw new Error("The challenge already has two members")
    if (await activeMembership(ctx, userId)) throw new Error("You are already in a challenge")
    const timezone = cleanTimezone(args.timezone)
    const displayName = cleanDisplayName(args.displayName)
    const goals = cleanList(args.goals ?? [], "goals")
    const donts = mintDonts(cleanList(args.donts ?? [], "don'ts"), now)
    await ctx.db.insert("challengeMembers", {
      challengeId: challenge._id,
      userId,
      timezone,
      displayName,
      joinedAt: now,
      goals,
      donts,
      commitmentsUpdatedAt: now,
    })
    await ctx.db.patch(invite._id, { acceptedBy: userId, acceptedAt: now })
    return { challengeId: challenge._id }
  },
})

/**
 * Replace the caller's own goals and don'ts. Goals are replaced wholesale.
 * A don't sent with its id keeps that id (its text may change); a current
 * don't left out is archived, not deleted, because a check-in may name it;
 * a don't sent without an id is new. Archived ones stay archived and do not
 * count against the cap.
 */
export const updateMyCommitments = mutation({
  args: {
    goals: v.array(v.string()),
    donts: v.array(v.object({ id: v.optional(v.string()), text: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMembership(ctx, userId)
    const goals = cleanList(args.goals, "goals")
    if (args.donts.length > MAX_LIST) throw new Error(`At most ${MAX_LIST} don'ts`)
    const current = memberCommitments(challenge, me).donts
    const active = new Map(current.filter((d) => d.archivedAt === undefined).map((d) => [d.id, d]))
    const now = Date.now()
    const kept = new Set<string>()
    const next: Dont[] = []
    let minted = 0
    for (const row of args.donts) {
      const text = row.text.trim()
      if (text.length > MAX_ITEM) throw new Error(`Each of the don'ts must be ${MAX_ITEM} characters or fewer`)
      if (row.id !== undefined) {
        if (!active.has(row.id) || kept.has(row.id)) throw new Error("Unknown don't")
        // A blank text for a known id is a removal; it is archived below.
        if (!text) continue
        kept.add(row.id)
        next.push({ id: row.id, text })
      } else if (text) {
        minted += 1
        next.push(mintDonts([text], now, current.length + minted - 1)[0]!)
      }
    }
    const archived = current.map((d) =>
      d.archivedAt !== undefined || kept.has(d.id) ? d : { ...d, archivedAt: now },
    ).filter((d) => d.archivedAt !== undefined)
    const donts = [...next, ...archived]
    await ctx.db.patch(me._id, { goals, donts, commitmentsUpdatedAt: now })
    return { goals, donts }
  },
})

export const leaveChallenge = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMembership(ctx, userId)
    await ctx.db.delete(me._id)
    const remaining = await membersOf(ctx, challenge._id)
    if (remaining.length === 0) await ctx.db.patch(challenge._id, { status: "ended" })
    return null
  },
})

// ─── The day ──────────────────────────────────────────────────────────────────

/**
 * The planner publishes the day's summary after every edit (debounced on the
 * client). Outside the challenge's span it is a no-op: the planner can be
 * open on any day, and a day before the start is nobody's business.
 */
export const syncDaySummary = mutation({
  args: { date: v.string(), summary: summaryValidator, timezone: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMembership(ctx, userId)
    assertIsoDate(args.date, "date")
    if (!inRange(challenge, args.date)) return null
    await upsertDay(ctx, challenge._id, userId, args.date, args.summary)
    if (args.timezone !== me.timezone && isValidTimezone(args.timezone)) {
      await ctx.db.patch(me._id, { timezone: args.timezone })
    }
    return null
  },
})

/** The morning act. Idempotent: the first lock-in is the one that counts. */
export const lockInPlan = mutation({
  args: { date: v.string(), summary: summaryValidator },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMembership(ctx, userId)
    assertIsoDate(args.date, "date")
    if (!inRange(challenge, args.date)) throw new Error("That day is outside the challenge")
    const row = await upsertDay(ctx, challenge._id, userId, args.date, args.summary)
    if (row.planSetAt) return { planSetAt: row.planSetAt }
    const planSetAt = Date.now()
    await ctx.db.patch(row._id, { planSetAt })
    return { planSetAt }
  },
})

/** The evening act. Checking in again updates the note and confession, not the time. */
export const checkIn = mutation({
  args: {
    date: v.string(),
    summary: summaryValidator,
    note: v.optional(v.string()),
    dontsBroken: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMembership(ctx, userId)
    assertIsoDate(args.date, "date")
    if (!inRange(challenge, args.date)) throw new Error("That day is outside the challenge")
    const note = args.note?.trim() ?? ""
    if (note.length > MAX_NOTE) throw new Error(`Note must be ${MAX_NOTE} characters or fewer`)
    // Archived ones count: a check-in edited later may name a don't removed since.
    const known = new Set(memberCommitments(challenge, me).donts.map((d) => d.id))
    for (const id of args.dontsBroken) {
      if (!known.has(id)) throw new Error("Unknown don't")
    }
    const dontsBroken = [...new Set(args.dontsBroken)]
    const existing = await getDayRow(ctx, challenge._id, userId, args.date)
    const checkinAt = existing?.checkinAt ?? Date.now()
    await upsertDay(ctx, challenge._id, userId, args.date, args.summary, {
      checkinAt,
      dontsBroken,
      ...(note ? { note } : {}),
    })
    if (!note && existing?.note) {
      await ctx.db.patch(existing._id, { note: undefined })
    }
    return { checkinAt }
  },
})

/**
 * An email to the partner while they still owe the day something: up to
 * three on the nudger's own local day, at least an hour apart. The rules
 * live in `_shared/challengeNudges.ts`, shared with the card's button. The
 * send is scheduled from inside the transaction, so a nudge that fails to
 * record never goes out; "sent" means queued, not delivered.
 */
export const nudgePartner = mutation({
  args: {},
  handler: async (ctx): Promise<{ left: number; nextAt: number | null }> => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMembership(ctx, userId)
    const partner = await partnerOf(ctx, challenge._id, userId)
    if (!partner) throw new Error("Nobody has joined yet")
    const now = Date.now()
    const partnerLocal = localDateAndMinutes(now, partner.timezone)
    if (!inRange(challenge, partnerLocal.date)) throw new Error("The challenge is not running today")
    const partnerRow = await getDayRow(ctx, challenge._id, partner.userId, partnerLocal.date)
    const evening = partnerLocal.minutes >= hhmmToMinutes(CHECKIN_START)
    const owes = partnerOwesToday({ evening, planSetAt: partnerRow?.planSetAt, checkinAt: partnerRow?.checkinAt })
    if (!owes) throw new Error(evening ? "They have already checked in" : "They have already locked in their plan")
    const myLocal = localDateAndMinutes(now, me.timezone)
    const myRow = await getDayRow(ctx, challenge._id, userId, myLocal.date)
    const times = nudgeTimes(myRow)
    const refusal = nudgeRefusal(nudgeAvailability({ nowMs: now, times, partnerOwes: owes }), now)
    if (refusal) throw new Error(refusal)
    const partnerDoc = ctx.db.normalizeId("users", partner.userId)
    const email = partnerDoc ? ((await ctx.db.get(partnerDoc))?.email ?? null) : null
    if (!email) throw new Error("Your partner has no email address on file")
    const mine = myRow ?? (await upsertDay(ctx, challenge._id, userId, myLocal.date, emptySummary()))
    // A legacy `nudgeSentAt` is carried into the array on the first write; the old field is left as it was.
    const sent = [...times, now]
    await ctx.db.patch(mine._id, { nudgesSentAt: sent })
    const what = evening ? "check in" : "lock in today's plan"
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      to: email,
      subject: `${me.displayName} is nudging you to ${what} — ${challenge.name}`,
      text: `${me.displayName} noticed you have not yet ${evening ? "checked in" : "locked in your plan"} today in "${challenge.name}".\n\nOpen Deepblock: ${process.env.SITE_URL ?? ""}/challenge\n`,
    })
    const left = NUDGE_DAILY_CAP - sent.length
    return { left, nextAt: left > 0 ? now + NUDGE_MIN_GAP_MS : null }
  },
})
