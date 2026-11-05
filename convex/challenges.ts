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
 * A person may run any number of challenges at once (up to
 * `MAX_ACTIVE_MEMBERSHIPS`), each with its own partner and each private to
 * its two members: nothing returned for challenge A says the partner is in
 * any other. The day's summary is published once and fanned out to every
 * active membership; the lock-in is one act for the whole day; the check-in
 * and the nudge are per challenge, because don'ts and partners differ.
 *
 * Membership is checked on every read and write (`requireMember`), and every
 * function derives the caller from the identity, never from an argument.
 * The partner's `userId` is never returned to the client; the member view is
 * a display name, a timezone and the member's lists.
 */

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v, ConvexError } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { getUserId } from "./_shared/auth"
import { HHMM, ISO_DATE, emptySummary, summaryValidator, type ChallengeSummary, type Dont, type EndedReason } from "./_shared/challengeValidators"
import { isValidTimezone, localDateAndMinutes, CHECKIN_START, hhmmToMinutes } from "./_shared/challengeReminders"
import { NUDGE_DAILY_CAP, NUDGE_MIN_GAP_MS, NUDGE_RULE_CODE, nudgeAvailability, nudgeRefusal, nudgeTimes, partnerOwesToday } from "./_shared/challengeNudges"

type Ctx = QueryCtx | MutationCtx

const MAX_MEMBERS = 2
/** Active challenges one person may be in at once; a bound, not a target. */
export const MAX_ACTIVE_MEMBERSHIPS = 20
/** Memberships, active or ended, that a person's reads look at: the newest ones. */
const MAX_ALL_MEMBERSHIPS = 50
/** Rows the admin list returns, newest first. */
const ADMIN_LIST_CAP = 200
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_NAME = 80
const MAX_LIST = 10
const MAX_ITEM = 200
const MAX_DISPLAY_NAME = 40
const MAX_NOTE = 1000
/** A challenge is a season, not a lifetime: at most a year. */
const MAX_SPAN_DAYS = 366
/** Rows per member `history` returns: a full-length season, with room. */
const HISTORY_CAP = 400
const DAY_MS = 24 * 60 * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The code every expected-state refusal carries; the client shows `message` as is. */
export const CHALLENGE_ERROR_CODE = "challenge"

/**
 * A refusal the user should read as a sentence. Convex redacts a plain
 * `Error` in production ("Server Error"); a `ConvexError`'s data survives.
 */
function fail(message: string, code: string = CHALLENGE_ERROR_CODE): never {
  throw new ConvexError({ code, message })
}

/** Whole days from `a` to `b`, both ISO dates; UTC arithmetic so DST cannot skew it. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** The member's local date now: the timezone given when valid, else the one on file. */
function memberToday(me: Doc<"challengeMembers">, timezone?: string): string {
  const tz = timezone && isValidTimezone(timezone) ? timezone : me.timezone
  return localDateAndMinutes(Date.now(), tz).date
}

async function requireUser(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  return getUserId(identity.subject)
}

/** The caller's user id, or null when signed out. Reads answer; they never throw for this. */
async function viewerId(ctx: Ctx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  return identity ? getUserId(identity.subject) : null
}

interface Membership {
  challenge: Doc<"challenges">
  me: Doc<"challengeMembers">
}

/**
 * Every membership the caller has, active or ended, newest first. Bounded:
 * the newest `MAX_ALL_MEMBERSHIPS` rows on `by_user`; anything older is out
 * of sight.
 */
async function allMemberships(ctx: Ctx, userId: string): Promise<Membership[]> {
  const rows = await ctx.db
    .query("challengeMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_ALL_MEMBERSHIPS)
  const out: Membership[] = []
  for (const me of rows) {
    const challenge = await ctx.db.get(me.challengeId)
    if (challenge) out.push({ challenge, me })
  }
  return out
}

/**
 * The caller's active memberships, newest first, at most
 * `MAX_ACTIVE_MEMBERSHIPS`. Read from the same window as `allMemberships`,
 * so an older active season is not hidden behind newer ended ones.
 */
async function activeMemberships(ctx: Ctx, userId: string): Promise<Membership[]> {
  return (await allMemberships(ctx, userId)).filter((m) => m.challenge.status === "active").slice(0, MAX_ACTIVE_MEMBERSHIPS)
}

/** The caller's row in one challenge, or null. One point read on `by_user_challenge`. */
async function findMember(ctx: Ctx, userId: string, challengeId: Id<"challenges">): Promise<Membership | null> {
  const me = await ctx.db
    .query("challengeMembers")
    .withIndex("by_user_challenge", (q) => q.eq("userId", userId).eq("challengeId", challengeId))
    .unique()
  if (!me) return null
  const challenge = await ctx.db.get(challengeId)
  return challenge ? { challenge, me } : null
}

/**
 * `findMember` for an id that arrives as a plain string (a route param): null
 * when it is not a challenges id at all, so a stale or mistyped URL reads as
 * "not yours" instead of failing argument validation.
 */
async function findMemberByString(ctx: Ctx, userId: string, raw: string): Promise<Membership | null> {
  const challengeId = ctx.db.normalizeId("challenges", raw)
  return challengeId ? await findMember(ctx, userId, challengeId) : null
}

/**
 * The caller's membership of `challengeId`. Reads accept an ended challenge
 * (a finished season stays readable); writes refuse it.
 */
async function requireMember(
  ctx: Ctx,
  userId: string,
  challengeId: Id<"challenges">,
  opts: { write: boolean },
): Promise<Membership> {
  const membership = await findMember(ctx, userId, challengeId)
  if (!membership) fail("You are not in this challenge")
  if (opts.write && membership.challenge.status !== "active") fail("This challenge has ended")
  return membership
}

async function assertBelowCap(ctx: Ctx, userId: string): Promise<void> {
  if ((await activeMemberships(ctx, userId)).length >= MAX_ACTIVE_MEMBERSHIPS) {
    fail(`You are in ${MAX_ACTIVE_MEMBERSHIPS} challenges already`)
  }
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

/** A user's email, from the `users` row (the Password provider's JWT carries none). */
async function userEmail(ctx: Ctx, userId: string): Promise<string | null> {
  const id = ctx.db.normalizeId("users", userId)
  const user = id ? await ctx.db.get(id) : null
  return user?.email ?? null
}

/** `ADMIN_EMAILS`: comma-separated, case-insensitive, trimmed. Unset or empty means nobody. */
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  return admins.includes(email.trim().toLowerCase())
}

/** The challenge as one member sees it. The warning says "me" or "not me", never a user id. */
function challengeView(c: Doc<"challenges">, viewer: string) {
  return {
    id: c._id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    planDeadline: c.planDeadline,
    checkinDeadline: c.checkinDeadline,
    createdAt: c.createdAt,
    status: c.status,
    endedReason: c.endedReason ?? null,
    endedAt: c.endedAt ?? null,
    warning: c.warning
      ? { forMe: c.warning.userId === viewer, missedSince: c.warning.missedSince, issuedAt: c.warning.issuedAt }
      : null,
    isCreator: c.createdBy === viewer,
  }
}
export type ChallengeView = ReturnType<typeof challengeView>

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

/** One challenge as its member sees it: the challenge, both members, the open invite while alone. */
async function challengeEntry(ctx: Ctx, { challenge, me }: Membership, viewer: string) {
  const partner = await partnerOf(ctx, challenge._id, viewer)
  const invite = partner || challenge.status !== "active" ? null : await openInvite(ctx, challenge._id, Date.now())
  return {
    challenge: challengeView(challenge, viewer),
    me: memberView(challenge, me),
    partner: partner ? memberView(challenge, partner) : null,
    invite: invite ? { token: invite.token, expiresAt: invite.expiresAt } : null,
  }
}
export type ChallengeEntry = Awaited<ReturnType<typeof challengeEntry>>

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

/** What the Today block needs of my own row: the acts and the nudge stamps, nothing else. */
function myDayView(row: Doc<"challengeDays">) {
  return {
    planSetAt: row.planSetAt ?? null,
    checkinAt: row.checkinAt ?? null,
    note: row.note ?? null,
    dontsBroken: row.dontsBroken,
    nudgesSentAt: row.nudgesSentAt ?? null,
    nudgeSentAt: row.nudgeSentAt ?? null,
  }
}

function assertIsoDate(value: string, label: string): void {
  if (!ISO_DATE.test(value)) fail(`${label} must be YYYY-MM-DD`)
}

function assertHhmm(value: string, label: string): void {
  if (!HHMM.test(value)) fail(`${label} must be HH:MM`)
}

function inRange(challenge: Doc<"challenges">, date: string): boolean {
  return date >= challenge.startDate && date <= challenge.endDate
}

function cleanList(items: string[], label: string): string[] {
  if (items.length > MAX_LIST) fail(`At most ${MAX_LIST} ${label}`)
  const cleaned = items.map((s) => s.trim()).filter((s) => s.length > 0)
  for (const item of cleaned) {
    if (item.length > MAX_ITEM) fail(`Each of the ${label} must be ${MAX_ITEM} characters or fewer`)
  }
  return cleaned
}

/** New don'ts from cleaned texts. `offset` keeps ids unique beside a member's existing ones. */
function mintDonts(texts: string[], now: number, offset = 0): Dont[] {
  return texts.map((text, i) => ({ id: `dont-${now}-${offset + i + 1}`, text }))
}

function cleanDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) fail("A display name is required")
  if (trimmed.length > MAX_DISPLAY_NAME) fail(`Display name must be ${MAX_DISPLAY_NAME} characters or fewer`)
  return trimmed
}

function cleanTimezone(timezone: string): string {
  if (!isValidTimezone(timezone)) fail("Unknown timezone")
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

/**
 * The bookkeeping every act does: the member's last activity, and the
 * inactivity warning cleared when it names them. Same mutation, so a
 * warned member who acts is never closed by a sweep that read stale rows.
 */
async function recordAct(ctx: MutationCtx, { challenge, me }: Membership, now: number): Promise<void> {
  await ctx.db.patch(me._id, { lastActedAt: now })
  if (challenge.warning && challenge.warning.userId === me.userId) {
    await ctx.db.patch(challenge._id, { warning: undefined })
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Every challenge the caller is in, active first, then ended; newest first
 * within each. `[]` when signed out. Each entry carries only that
 * challenge's own members, never a hint of the partner's other challenges.
 */
export const myChallenges = query({
  args: {},
  handler: async (ctx): Promise<ChallengeEntry[]> => {
    const userId = await viewerId(ctx)
    if (!userId) return []
    const memberships = await allMemberships(ctx, userId)
    const entries: ChallengeEntry[] = []
    for (const m of memberships) entries.push(await challengeEntry(ctx, m, userId))
    const rank = (e: ChallengeEntry) => (e.challenge.status === "active" ? 0 : 1)
    return entries.sort((a, b) => rank(a) - rank(b) || b.challenge.createdAt - a.challenge.createdAt)
  },
})

/**
 * Today for both members of one challenge. Each lives on their own local
 * date, so the client passes both; a query cannot watch a wall clock.
 * Null when signed out or not a member.
 */
export const dayCards = query({
  args: { challengeId: v.string(), myDate: v.string(), partnerDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return null
    const membership = await findMemberByString(ctx, userId, args.challengeId)
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
 * Today across the caller's active challenges, in one subscription, for the
 * Today block. `cards` names the challenges and each partner's local date;
 * an id the caller is not an active member of is skipped, never an error.
 */
export const todayCards = query({
  args: {
    myDate: v.string(),
    cards: v.array(v.object({ challengeId: v.id("challenges"), partnerDate: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return []
    assertIsoDate(args.myDate, "myDate")
    const out: Array<{
      challengeId: Id<"challenges">
      mine: ReturnType<typeof myDayView> | null
      partner: ChallengeDayView | null
    }> = []
    const seen = new Set<string>()
    for (const card of args.cards.slice(0, MAX_ACTIVE_MEMBERSHIPS)) {
      if (seen.has(card.challengeId)) continue
      seen.add(card.challengeId)
      if (!ISO_DATE.test(card.partnerDate)) continue
      const membership = await findMember(ctx, userId, card.challengeId)
      if (!membership || membership.challenge.status !== "active") continue
      const mine = await getDayRow(ctx, card.challengeId, userId, args.myDate)
      const partner = await partnerOf(ctx, card.challengeId, userId)
      const partnerRow = partner ? await getDayRow(ctx, card.challengeId, partner.userId, card.partnerDate) : null
      out.push({
        challengeId: card.challengeId,
        mine: mine ? myDayView(mine) : null,
        partner: partnerRow ? dayView(partnerRow) : null,
      })
    }
    return out
  },
})

/**
 * Every day of one challenge from the start up to `toDate`, for both
 * members. Callers pass yesterday, not today: today's row is rewritten on
 * every planner edit, and keeping it out of this read set is what stops each
 * keystroke from re-reading a whole season (the same hot/cold rule as
 * `plannerDays`). The partner's rows run to `partnerToDate` (default
 * `toDate`): their yesterday, which is not the viewer's when they are a day
 * ahead.
 */
export const history = query({
  args: { challengeId: v.string(), toDate: v.string(), partnerToDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return null
    const membership = await findMemberByString(ctx, userId, args.challengeId)
    if (!membership) return null
    assertIsoDate(args.toDate, "toDate")
    const partnerToDate = args.partnerToDate ?? args.toDate
    assertIsoDate(partnerToDate, "partnerToDate")
    const { challenge } = membership
    const partner = await partnerOf(ctx, challenge._id, userId)
    const rowsFor = async (memberId: string, toDate: string) =>
      (
        await ctx.db
          .query("challengeDays")
          .withIndex("by_challenge_user_date", (q) =>
            q.eq("challengeId", challenge._id).eq("userId", memberId).gte("date", challenge.startDate).lte("date", toDate),
          )
          .take(HISTORY_CAP)
      ).map(dayView)
    return {
      mine: await rowsFor(userId, args.toDate),
      partner: partner ? await rowsFor(partner.userId, partnerToDate) : [],
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
    const members = await membersOf(ctx, challenge._id)
    // Auth is optional here: a signed-in member revisiting the link is told they are in.
    const identity = await ctx.auth.getUserIdentity()
    if (identity && members.some((m) => m.userId === getUserId(identity.subject))) {
      return { status: "member" as const, challengeId: challenge._id, challenge: preview, inviterName: null, ...noLists }
    }
    if (invite.acceptedBy) return { status: "used" as const, challenge: preview, inviterName: null, ...noLists }
    if (invite.expiresAt <= Date.now()) return { status: "expired" as const, challenge: preview, inviterName: null, ...noLists }
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

// ─── Admin (read-only) ────────────────────────────────────────────────────────

/** Whether the caller's email is in `ADMIN_EMAILS`. False when signed out. */
export const adminStatus = query({
  args: {},
  handler: async (ctx): Promise<{ isAdmin: boolean }> => {
    const userId = await viewerId(ctx)
    if (!userId) return { isAdmin: false }
    return { isAdmin: isAdminEmail(await userEmail(ctx, userId)) }
  },
})

/**
 * Every challenge, newest first, for an admin: who is in it, their emails,
 * when each last acted, and any warning standing. Read-only; there is no
 * admin write. Day summaries are not part of it.
 */
export interface AdminChallengeRow {
  id: Id<"challenges">
  name: string
  status: Doc<"challenges">["status"]
  endedReason: EndedReason | null
  startDate: string
  endDate: string
  createdAt: number
  endedAt: number | null
  warning: { displayName: string; missedSince: string; issuedAt: number } | null
  members: Array<{
    displayName: string
    email: string | null
    timezone: string
    joinedAt: number
    lastActedAt: number | null
    isCreator: boolean
  }>
}

export const adminListChallenges = query({
  args: {},
  handler: async (ctx): Promise<AdminChallengeRow[]> => {
    const userId = await requireUser(ctx)
    if (!isAdminEmail(await userEmail(ctx, userId))) fail("Not an admin")
    // `challenges` has no createdAt index; the two `by_status` ranges, each
    // newest first by creation time, cover every row and are merged here.
    const active = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(ADMIN_LIST_CAP)
    const ended = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "ended"))
      .order("desc")
      .take(ADMIN_LIST_CAP)
    const challenges = [...active, ...ended].sort((a, b) => b.createdAt - a.createdAt).slice(0, ADMIN_LIST_CAP)
    const rows: AdminChallengeRow[] = []
    for (const c of challenges) {
      const members = await membersOf(ctx, c._id)
      const memberRows: AdminChallengeRow["members"] = []
      for (const m of members) {
        memberRows.push({
          displayName: m.displayName,
          email: await userEmail(ctx, m.userId),
          timezone: m.timezone,
          joinedAt: m.joinedAt,
          lastActedAt: m.lastActedAt ?? null,
          isCreator: m.userId === c.createdBy,
        })
      }
      const warned = c.warning ? members.find((m) => m.userId === c.warning!.userId) : undefined
      rows.push({
        id: c._id,
        name: c.name,
        status: c.status,
        endedReason: c.endedReason ?? null,
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt,
        endedAt: c.endedAt ?? null,
        warning: c.warning
          ? { displayName: warned?.displayName ?? "A former member", missedSince: c.warning.missedSince, issuedAt: c.warning.issuedAt }
          : null,
        members: memberRows,
      })
    }
    return rows
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
    await assertBelowCap(ctx, userId)
    const name = args.name.trim()
    if (!name) fail("A name is required")
    if (name.length > MAX_NAME) fail(`Name must be ${MAX_NAME} characters or fewer`)
    assertIsoDate(args.startDate, "startDate")
    assertIsoDate(args.endDate, "endDate")
    if (args.startDate > args.endDate) fail("The challenge must end on or after it starts")
    if (daysBetween(args.startDate, args.endDate) + 1 > MAX_SPAN_DAYS) fail("A challenge can run for at most a year")
    assertHhmm(args.planDeadline, "planDeadline")
    assertHhmm(args.checkinDeadline, "checkinDeadline")
    if (hhmmToMinutes(args.planDeadline) >= hhmmToMinutes(CHECKIN_START)) {
      fail(`The plan deadline must be before ${CHECKIN_START}`)
    }
    if (hhmmToMinutes(args.checkinDeadline) <= hhmmToMinutes(CHECKIN_START)) {
      fail(`The check-in deadline must be after ${CHECKIN_START}`)
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
      joinedDate: localDateAndMinutes(now, timezone).date,
      goals,
      donts,
      commitmentsUpdatedAt: now,
    })
    return { challengeId }
  },
})

/** A link to paste to the friend. One open invite at a time; asking again returns it. */
export const createInvite = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const members = await membersOf(ctx, challenge._id)
    if (members.length >= MAX_MEMBERS) fail("The challenge already has two members")
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
    if (!invite) fail("This invite link is not valid")
    const challenge = await ctx.db.get(invite.challengeId)
    if (!challenge || challenge.status !== "active") fail("This challenge has ended")
    const members = await membersOf(ctx, challenge._id)
    if (members.some((m) => m.userId === userId)) return { challengeId: challenge._id }
    if (invite.acceptedBy) fail("This invite has already been used")
    if (invite.expiresAt <= now) fail("This invite has expired")
    if (members.length >= MAX_MEMBERS) fail("The challenge already has two members")
    await assertBelowCap(ctx, userId)
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
      joinedDate: localDateAndMinutes(now, timezone).date,
      goals,
      donts,
      commitmentsUpdatedAt: now,
    })
    await ctx.db.patch(invite._id, { acceptedBy: userId, acceptedAt: now })
    return { challengeId: challenge._id }
  },
})

/**
 * Replace the caller's own goals and don'ts in one challenge. Goals are
 * replaced wholesale. A don't sent with its id keeps that id (its text may
 * change); a current don't left out is archived, not deleted, because a
 * check-in may name it; a don't sent without an id is new. Archived ones
 * stay archived and do not count against the cap.
 */
export const updateMyCommitments = mutation({
  args: {
    challengeId: v.id("challenges"),
    goals: v.array(v.string()),
    donts: v.array(v.object({ id: v.optional(v.string()), text: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const goals = cleanList(args.goals, "goals")
    // Blank rows are dropped below, so they do not count against the cap (as with goals).
    if (args.donts.filter((d) => d.text.trim().length > 0).length > MAX_LIST) fail(`At most ${MAX_LIST} don'ts`)
    const current = memberCommitments(challenge, me).donts
    const active = new Map(current.filter((d) => d.archivedAt === undefined).map((d) => [d.id, d]))
    const now = Date.now()
    const kept = new Set<string>()
    const next: Dont[] = []
    let minted = 0
    for (const row of args.donts) {
      const text = row.text.trim()
      if (text.length > MAX_ITEM) fail(`Each of the don'ts must be ${MAX_ITEM} characters or fewer`)
      if (row.id !== undefined) {
        if (!active.has(row.id) || kept.has(row.id)) fail("Unknown don't")
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

/** The season's name belongs to both members; either may change it while it runs. */
export const renameChallenge = mutation({
  args: { challengeId: v.id("challenges"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const name = args.name.trim()
    if (!name) fail("A name is required")
    if (name.length > MAX_NAME) fail(`Name must be ${MAX_NAME} characters or fewer`)
    await ctx.db.patch(challenge._id, { name })
    return { name }
  },
})

/**
 * Leaving. The creator leaving ends the challenge for both at once
 * (`creatorLeft`, or `allLeft` when they were alone); their row is kept, so
 * the season stays readable to both. Anyone else leaving deletes their own
 * row and the challenge runs on with one member, open to a new invite; the
 * last one out ends it (`allLeft`). Day rows are never deleted.
 */
export const leaveChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const now = Date.now()
    if (challenge.createdBy === userId) {
      const partner = await partnerOf(ctx, challenge._id, userId)
      await ctx.db.patch(challenge._id, { status: "ended", endedReason: partner ? "creatorLeft" : "allLeft", endedAt: now })
      return null
    }
    await ctx.db.delete(me._id)
    const remaining = await membersOf(ctx, challenge._id)
    if (remaining.length === 0) await ctx.db.patch(challenge._id, { status: "ended", endedReason: "allLeft", endedAt: now })
    return null
  },
})

/** Rows removed per read while purging one table; a season holds far fewer. */
const PURGE_BATCH = 500

/**
 * Deleting an ended challenge for good: its days, invites, members and the
 * challenge itself. Two people may do it, and only once it has ended: the
 * creator, and an `ADMIN_EMAILS` admin (who need not be a member). A running
 * challenge is refused; ending it comes first. Nothing here touches either
 * member's own planner. The client warns before calling it.
 */
export const deleteChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) fail("This challenge no longer exists")
    const isAdmin = isAdminEmail(await userEmail(ctx, userId))
    if (challenge.createdBy !== userId && !isAdmin) fail("Only the creator or an admin can delete a challenge")
    if (challenge.status !== "ended") fail("End the challenge before deleting it")

    const id = challenge._id
    const purge = async (next: () => Promise<Array<{ _id: Id<"challengeDays" | "challengeInvites" | "challengeMembers"> }>>) => {
      for (;;) {
        const rows = await next()
        for (const row of rows) await ctx.db.delete(row._id)
        if (rows.length < PURGE_BATCH) break
      }
    }
    await purge(() => ctx.db.query("challengeDays").withIndex("by_challenge_user_date", (q) => q.eq("challengeId", id)).take(PURGE_BATCH))
    await purge(() => ctx.db.query("challengeInvites").withIndex("by_challenge", (q) => q.eq("challengeId", id)).take(PURGE_BATCH))
    await purge(() => ctx.db.query("challengeMembers").withIndex("by_challenge", (q) => q.eq("challengeId", id)).take(PURGE_BATCH))
    await ctx.db.delete(challenge._id)
    return null
  },
})

// ─── The day ──────────────────────────────────────────────────────────────────

/**
 * The planner publishes the day's summary after every edit (debounced on the
 * client), once, and it is fanned out to every active challenge whose span
 * covers the date. Outside a challenge's span it is a no-op for that
 * challenge: the planner can be open on any day, and a day before the start
 * is nobody's business. With no active challenge it does nothing.
 */
export const syncDaySummary = mutation({
  args: { date: v.string(), summary: summaryValidator, timezone: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    assertIsoDate(args.date, "date")
    const memberships = await activeMemberships(ctx, userId)
    const timezoneOk = isValidTimezone(args.timezone)
    for (const { challenge, me } of memberships) {
      if (timezoneOk && args.timezone !== me.timezone) {
        await ctx.db.patch(me._id, { timezone: args.timezone })
      }
      if (!inRange(challenge, args.date)) continue
      // Only the member's own today (± a day for the date line) is published:
      // browsing another day in the planner must not rewrite what the partner saw.
      if (Math.abs(daysBetween(memberToday(me, args.timezone), args.date)) > 1) continue
      await upsertDay(ctx, challenge._id, userId, args.date, args.summary)
    }
    return null
  },
})

/**
 * The morning act, one for the whole day. Without `challengeId` it stamps
 * today's row in every active challenge whose span covers today; with one it
 * stamps that challenge only. Idempotent: the first lock-in is the one that
 * counts. `planSetAt` is the earliest stamp.
 */
export const lockInPlan = mutation({
  args: { date: v.string(), summary: summaryValidator, challengeId: v.optional(v.id("challenges")) },
  handler: async (
    ctx,
    args,
  ): Promise<{ planSetAt: number | null; locked: Array<{ challengeId: Id<"challenges">; planSetAt: number }> }> => {
    const userId = await requireUser(ctx)
    assertIsoDate(args.date, "date")
    let targets: Membership[]
    if (args.challengeId) {
      const membership = await requireMember(ctx, userId, args.challengeId, { write: true })
      if (!inRange(membership.challenge, args.date)) fail("That day is outside the challenge")
      if (args.date !== memberToday(membership.me)) fail("You can only lock in today")
      targets = [membership]
    } else {
      const memberships = await activeMemberships(ctx, userId)
      if (memberships.length === 0) fail("You are not in a challenge")
      const inSpan = memberships.filter((m) => inRange(m.challenge, args.date))
      if (inSpan.length === 0) fail("That day is outside the challenge")
      targets = inSpan.filter((m) => args.date === memberToday(m.me))
      if (targets.length === 0) fail("You can only lock in today")
    }
    const now = Date.now()
    const locked: Array<{ challengeId: Id<"challenges">; planSetAt: number }> = []
    for (const membership of targets) {
      const row = await upsertDay(ctx, membership.challenge._id, userId, args.date, args.summary)
      let planSetAt = row.planSetAt
      if (!planSetAt) {
        planSetAt = now
        await ctx.db.patch(row._id, { planSetAt })
      }
      await recordAct(ctx, membership, now)
      locked.push({ challengeId: membership.challenge._id, planSetAt })
    }
    const planSetAt = locked.length > 0 ? Math.min(...locked.map((l) => l.planSetAt)) : null
    return { planSetAt, locked }
  },
})

/** The evening act, per challenge. Checking in again updates the note and confession, not the time. */
export const checkIn = mutation({
  args: {
    challengeId: v.id("challenges"),
    date: v.string(),
    summary: summaryValidator,
    note: v.optional(v.string()),
    dontsBroken: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const membership = await requireMember(ctx, userId, args.challengeId, { write: true })
    const { challenge, me } = membership
    assertIsoDate(args.date, "date")
    if (!inRange(challenge, args.date)) fail("That day is outside the challenge")
    const back = daysBetween(args.date, memberToday(me))
    if (back !== 0 && back !== 1) fail("You can only check in for today or yesterday")
    const note = args.note?.trim() ?? ""
    if (note.length > MAX_NOTE) fail(`Note must be ${MAX_NOTE} characters or fewer`)
    // Archived ones count: a check-in edited later may name a don't removed since.
    const known = new Set(memberCommitments(challenge, me).donts.map((d) => d.id))
    for (const id of args.dontsBroken) {
      if (!known.has(id)) fail("Unknown don't")
    }
    const dontsBroken = [...new Set(args.dontsBroken)]
    const existing = await getDayRow(ctx, challenge._id, userId, args.date)
    const now = Date.now()
    const checkinAt = existing?.checkinAt ?? now
    await upsertDay(ctx, challenge._id, userId, args.date, args.summary, {
      checkinAt,
      dontsBroken,
      ...(note ? { note } : {}),
    })
    if (!note && existing?.note) {
      await ctx.db.patch(existing._id, { note: undefined })
    }
    await recordAct(ctx, membership, now)
    return { checkinAt }
  },
})

/**
 * An email to the partner in one challenge while they still owe the day
 * something: up to three on the nudger's own local day, at least an hour
 * apart. The rules live in `_shared/challengeNudges.ts`, shared with the
 * card's button. The send is scheduled from inside the transaction, so a
 * nudge that fails to record never goes out; "sent" means queued, not
 * delivered.
 */
export const nudgePartner = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args): Promise<{ left: number; nextAt: number | null }> => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const partner = await partnerOf(ctx, challenge._id, userId)
    if (!partner) fail("Nobody has joined yet")
    const now = Date.now()
    const partnerLocal = localDateAndMinutes(now, partner.timezone)
    if (!inRange(challenge, partnerLocal.date)) fail("The challenge is not running today", NUDGE_RULE_CODE)
    const partnerRow = await getDayRow(ctx, challenge._id, partner.userId, partnerLocal.date)
    const evening = partnerLocal.minutes >= hhmmToMinutes(CHECKIN_START)
    const owes = partnerOwesToday({ evening, planSetAt: partnerRow?.planSetAt, checkinAt: partnerRow?.checkinAt })
    if (!owes) fail(evening ? "They have already checked in" : "They have already locked in their plan", NUDGE_RULE_CODE)
    const myLocal = localDateAndMinutes(now, me.timezone)
    const myRow = await getDayRow(ctx, challenge._id, userId, myLocal.date)
    const times = nudgeTimes(myRow)
    const refusal = nudgeRefusal(nudgeAvailability({ nowMs: now, times, partnerOwes: owes }), now)
    if (refusal) fail(refusal, NUDGE_RULE_CODE)
    const email = await userEmail(ctx, partner.userId)
    if (!email) fail("Your partner has no email address on file")
    const mine = myRow ?? (await upsertDay(ctx, challenge._id, userId, myLocal.date, emptySummary()))
    // A legacy `nudgeSentAt` is carried into the array on the first write; the old field is left as it was.
    const sent = [...times, now]
    await ctx.db.patch(mine._id, { nudgesSentAt: sent })
    const what = evening ? "check in" : "lock in today's plan"
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      to: email,
      subject: `${me.displayName} is nudging you to ${what} — ${challenge.name}`,
      text: `${me.displayName} noticed you have not yet ${evening ? "checked in" : "locked in your plan"} today in "${challenge.name}".\n\nOpen Deepblock: ${process.env.SITE_URL ?? ""}/challenge/${challenge._id}\n`,
    })
    const left = NUDGE_DAILY_CAP - sent.length
    return { left, nextAt: left > 0 ? now + NUDGE_MIN_GAP_MS : null }
  },
})
