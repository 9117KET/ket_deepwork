/**
 * convex/challenges.ts — the accountability challenge, one to eight people.
 *
 * Up to `MAX_MEMBERS` people agree on a span of days. Each member sets their
 * own goals and "don'ts" (on their `challengeMembers` row, editable any
 * time, readable by the others), and each day has two explicit acts: lock in
 * the plan (before a morning deadline) and check in (before the check-in
 * deadline). The planner itself stays private. What the others see is the
 * `summary` each member's own client publishes — Top 3 titles, counts,
 * earned minutes, habits — never a `plannerDays` row. A task marked private
 * is counted in that summary, never titled.
 *
 * Leaving keeps the member row (`leftAt`, a former member), so an invite
 * brings them back with everything intact; the creator leaving hands the
 * role to the longest-standing member; the last one out ends it. The
 * creator may reopen an ended challenge with everything it recorded.
 * `partner` in every return is the first other member (`others[0]`), which
 * the client built for two people still reads.
 *
 * A removed don't is archived, never deleted, so a confession that named it
 * still resolves. Challenges created before per-member lists keep theirs on
 * the `challenges` row; `memberCommitments` hands them to the creator.
 *
 * A person may run any number of challenges at once (up to
 * `MAX_ACTIVE_MEMBERSHIPS`), each with its own members and each private to
 * them: nothing returned for challenge A says a member is in any other. The
 * day's summary is published once and fanned out to every active
 * membership; the lock-in is one act for the whole day; the check-in and the
 * nudge are per challenge, because don'ts and members differ.
 *
 * Membership is checked on every read and write (`requireMember`), and every
 * function derives the caller from the identity, never from an argument.
 * No other member's `userId` or email is ever returned to the client; the
 * member view is a key (the member row id), a display name, a timezone and
 * the member's lists.
 */

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v, ConvexError } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { getUserId } from "./_shared/auth"
import {
  HHMM,
  ISO_DATE,
  emptySummary,
  summaryValidator,
  type ChallengeSummary,
  type ClosedSpan,
  type Commitment,
  type Dont,
  type EndedReason,
} from "./_shared/challengeValidators"
import { isValidTimezone, localDateAndMinutes, CHECKIN_START, hhmmToMinutes } from "./_shared/challengeReminders"
import { NUDGE_DAILY_CAP, NUDGE_MIN_GAP_MS, NUDGE_RULE_CODE, nudgeAvailability, nudgeRefusal, nudgeTimes, partnerOwesToday } from "./_shared/challengeNudges"
import {
  MAX_MEMBERS,
  MEMBER_ROW_BOUND,
  activeInJoinOrder,
  appendClosedSpan,
  closedSpanFor,
  firstClosedDate,
  nudgeTimesFor,
  reopenEndProblem,
} from "./_shared/challengeGroup"
import { handOverIfCreator, memberCommitments, memberRowsOf, membersOf } from "./_shared/challengeMembers"

export { MAX_MEMBERS } from "./_shared/challengeGroup"
export { legacyGoalId, normalizeGoals } from "./_shared/challengeMembers"

type Ctx = QueryCtx | MutationCtx

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
 * of sight. A former member's row (`leftAt`) is not a membership.
 */
async function allMemberships(ctx: Ctx, userId: string): Promise<Membership[]> {
  const rows = await ctx.db
    .query("challengeMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_ALL_MEMBERSHIPS)
  const out: Membership[] = []
  for (const me of rows) {
    if (me.leftAt !== undefined) continue
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

/** The caller's own member row in one challenge, active or former, or null. One point read. */
async function ownRow(ctx: Ctx, userId: string, challengeId: Id<"challenges">): Promise<Doc<"challengeMembers"> | null> {
  return await ctx.db
    .query("challengeMembers")
    .withIndex("by_user_challenge", (q) => q.eq("userId", userId).eq("challengeId", challengeId))
    .unique()
}

/**
 * The caller's active row in one challenge, or null. A former member
 * (`leftAt`) is not in it: they see and write nothing.
 */
async function findMember(ctx: Ctx, userId: string, challengeId: Id<"challenges">): Promise<Membership | null> {
  const me = await ownRow(ctx, userId, challengeId)
  if (!me || me.leftAt !== undefined) return null
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

/**
 * Who is in a challenge, as one viewer's reads need it: every row (for the
 * warned member's name), the active members in join order, and the others
 * the viewer sees, `partner` being the first of them.
 */
interface Roster {
  rows: Doc<"challengeMembers">[]
  active: Doc<"challengeMembers">[]
  others: Doc<"challengeMembers">[]
}

async function rosterOf(ctx: Ctx, challengeId: Id<"challenges">, viewer: string): Promise<Roster> {
  const rows = await memberRowsOf(ctx, challengeId)
  const active = activeOf(rows)
  return { rows, active, others: active.filter((m) => m.userId !== viewer) }
}

/** The active members among `rows`, join order (the one rule `membersOf` uses). */
const activeOf = (rows: Doc<"challengeMembers">[]) => activeInJoinOrder(rows)

/** The refusal for a join or an invite with every seat taken. */
const FULL_MESSAGE = `This challenge is full (${MAX_MEMBERS} members)`

/** Validates an optional per-member date list; the result maps member key to date. */
function memberDates(list: Array<{ key: string; date: string }> | undefined, label: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of (list ?? []).slice(0, MEMBER_ROW_BOUND)) {
    assertIsoDate(entry.date, label)
    out.set(entry.key, entry.date)
  }
  return out
}

async function getDayRow(ctx: Ctx, challengeId: Id<"challenges">, userId: string, date: string) {
  return await ctx.db
    .query("challengeDays")
    .withIndex("by_challenge_user_date", (q) => q.eq("challengeId", challengeId).eq("userId", userId).eq("date", date))
    .unique()
}

/**
 * The newest invite that is still open, if any. An invite made by someone
 * who is no longer an active member (`active`) is dead and never handed out.
 */
async function openInvite(ctx: Ctx, challengeId: Id<"challenges">, now: number, active: Doc<"challengeMembers">[]) {
  const invites = await ctx.db
    .query("challengeInvites")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .order("desc")
    .take(10)
  const makers = new Set(active.map((m) => m.userId))
  return invites.find((i) => !i.acceptedBy && i.expiresAt > now && makers.has(i.createdBy)) ?? null
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

/**
 * The challenge as one member sees it. The warning says "me" or "not me" and
 * names the warned member by key and display name, never a user id.
 * `rows` are the challenge's member rows (`memberRowsOf`), active and former.
 */
function challengeView(c: Doc<"challenges">, viewer: string, rows: Doc<"challengeMembers">[]) {
  const warned = c.warning ? rows.find((m) => m.userId === c.warning!.userId) : undefined
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
      ? {
          forMe: c.warning.userId === viewer,
          missedSince: c.warning.missedSince,
          issuedAt: c.warning.issuedAt,
          /** The warned member's key and name; empty key and "A former member" if their row is gone. */
          memberKey: warned ? (warned._id as string) : "",
          displayName: warned?.displayName ?? "A former member",
        }
      : null,
    isCreator: c.createdBy === viewer,
    /** Created for one person and nobody has joined since. Rows without the field are two-person. */
    solo: c.solo === true,
    /** Active members, the viewer included. */
    memberCount: activeOf(rows).length,
    capacity: MAX_MEMBERS,
    /** The reopener's local date of the latest reopen, or null if never reopened. */
    reopenedDate: c.reopenedDate ?? null,
    /** The stretches spent ended before each reopen, oldest first; empty when none. */
    closedSpans: c.closedSpans ?? [],
  }
}
export type ChallengeView = ReturnType<typeof challengeView>

/** The texts of the active goals: the shape `goals` has always had, which the client live before ids still renders. */
function activeGoalTexts(goals: Commitment[]): string[] {
  return goals.filter((g) => g.archivedAt === undefined).map((g) => g.text)
}

/**
 * A member as another member (or they themselves) sees them. `goals` stays
 * `string[]` (active texts only) so a client built before goal ids keeps
 * rendering; `goalItems` carries the ids, archived ones included, like `donts`.
 * `key` (the member row id) is the only identifier of a member that leaves
 * the server: no user id, no email.
 */
function memberView(challenge: Doc<"challenges">, m: Doc<"challengeMembers">) {
  const { goals, donts } = memberCommitments(challenge, m)
  return {
    displayName: m.displayName,
    timezone: m.timezone,
    joinedAt: m.joinedAt,
    goals: activeGoalTexts(goals),
    goalItems: goals,
    donts,
    key: m._id as string,
    isCreator: m.userId === challenge.createdBy,
  }
}
export type MemberView = ReturnType<typeof memberView>

/**
 * One challenge as its member sees it: the challenge, every other active
 * member in join order (`others`; `partner` is the first of them), and the
 * open invite while seats remain.
 */
async function challengeEntry(ctx: Ctx, { challenge, me }: Membership, viewer: string) {
  const roster = await rosterOf(ctx, challenge._id, viewer)
  const seatsLeft = roster.active.length < MAX_MEMBERS
  const invite = seatsLeft && challenge.status === "active" ? await openInvite(ctx, challenge._id, Date.now(), roster.active) : null
  const others = roster.others.map((m) => memberView(challenge, m))
  return {
    challenge: challengeView(challenge, viewer, roster.rows),
    me: memberView(challenge, me),
    partner: others[0] ?? null,
    others,
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
    goalsKept: row.goalsKept ?? [],
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
    goalsKept: row.goalsKept ?? [],
    nudgesSentAt: row.nudgesSentAt ?? null,
    nudgeSentAt: row.nudgeSentAt ?? null,
    /** My nudges today per member nudged (key: their member key); empty object when none. */
    nudgesByMember: row.nudgesByMember ?? {},
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

/** New goals from cleaned texts, the twin of `mintDonts`. */
function mintGoals(texts: string[], now: number, offset = 0): Commitment[] {
  return texts.map((text, i) => ({ id: `goal-${now}-${offset + i + 1}`, text }))
}

/**
 * The span and deadline rules, shared by `createChallenge` and `updateSpan`
 * so the two can never accept different seasons. Deadlines are checked only
 * when given.
 */
function assertSpan(
  span: { startDate: string; endDate: string; planDeadline?: string; checkinDeadline?: string },
  reopenedDate?: string,
): void {
  assertIsoDate(span.startDate, "startDate")
  assertIsoDate(span.endDate, "endDate")
  if (span.startDate > span.endDate) fail("The challenge must end on or after it starts")
  // A reopened season is measured from its reopen day, as `reopenChallenge` measured it; any other from its start.
  if (reopenedDate !== undefined) {
    if (daysBetween(reopenedDate, span.endDate) + 1 > MAX_SPAN_DAYS) fail(REOPEN_SPAN_MESSAGE)
  } else if (daysBetween(span.startDate, span.endDate) + 1 > MAX_SPAN_DAYS) {
    fail("A challenge can run for at most a year")
  }
  if (span.planDeadline !== undefined) {
    assertHhmm(span.planDeadline, "planDeadline")
    if (hhmmToMinutes(span.planDeadline) >= hhmmToMinutes(CHECKIN_START)) {
      fail(`The plan deadline must be before ${CHECKIN_START}`)
    }
  }
  if (span.checkinDeadline !== undefined) {
    assertHhmm(span.checkinDeadline, "checkinDeadline")
    if (hhmmToMinutes(span.checkinDeadline) <= hhmmToMinutes(CHECKIN_START)) {
      fail(`The check-in deadline must be after ${CHECKIN_START}`)
    }
  }
}

/** The refusal for a reopened season longer than 366 days from its reopen day (`reopenChallenge`, `updateSpan`). */
const REOPEN_SPAN_MESSAGE = "A season runs at most 366 days from the day it was reopened"

const SHORT_MONTHS =["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "24 Oct" from an ISO date, for a refusal sentence. */
function dayMonth(iso: string): string {
  const [, month, day] = iso.split("-").map(Number)
  return `${day} ${SHORT_MONTHS[(month ?? 1) - 1]}`
}

/**
 * The checks a daily mark and a check-in share: the date is in the span and
 * is the member's today or yesterday, and every id names one of the member's
 * own goals / don'ts (archived ones count: a day edited later may name one
 * removed since). Returns the ids de-duplicated; a list not given stays
 * undefined.
 */
function cleanMarks(
  { challenge, me }: Membership,
  date: string,
  marks: { goalsKept?: string[]; dontsBroken?: string[] },
): { goalsKept?: string[]; dontsBroken?: string[] } {
  assertIsoDate(date, "date")
  if (!inRange(challenge, date)) fail("That day is outside the challenge")
  const back = daysBetween(date, memberToday(me))
  if (back !== 0 && back !== 1) fail("You can only check in for today or yesterday")
  const { goals, donts } = memberCommitments(challenge, me)
  const check = (ids: string[] | undefined, known: Commitment[], refusal: string) => {
    if (ids === undefined) return undefined
    const set = new Set(known.map((c) => c.id))
    for (const id of ids) if (!set.has(id)) fail(refusal)
    return [...new Set(ids)]
  }
  return {
    goalsKept: check(marks.goalsKept, goals, "Unknown goal"),
    dontsBroken: check(marks.dontsBroken, donts, "Unknown don't"),
  }
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
  extra: Partial<Pick<Doc<"challengeDays">, "planSetAt" | "checkinAt" | "note" | "dontsBroken" | "goalsKept">> = {},
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

const otherDatesValidator = v.optional(v.array(v.object({ key: v.string(), date: v.string() })))

/**
 * Every other active member's day, in `others` order, each read at their own
 * date from `dates` (by member key), else at `fallbackDate`.
 */
async function otherDays(
  ctx: Ctx,
  challengeId: Id<"challenges">,
  others: Doc<"challengeMembers">[],
  dates: Map<string, string>,
  fallbackDate: string,
): Promise<Array<{ key: string; day: ChallengeDayView | null }>> {
  const out: Array<{ key: string; day: ChallengeDayView | null }> = []
  for (const m of others) {
    const key = m._id as string
    const row = await getDayRow(ctx, challengeId, m.userId, dates.get(key) ?? fallbackDate)
    out.push({ key, day: row ? dayView(row) : null })
  }
  return out
}

/**
 * Today for every member of one challenge. Each lives on their own local
 * date, so the client passes them: `partnerDate` for the first other member
 * (and anyone without an entry), `otherDates` per member key; a query cannot
 * watch a wall clock. `partner` is `others[0]`'s day at `partnerDate`, as it
 * was for two people. Null when signed out or not a member.
 */
export const dayCards = query({
  args: { challengeId: v.string(), myDate: v.string(), partnerDate: v.string(), otherDates: otherDatesValidator },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return null
    const membership = await findMemberByString(ctx, userId, args.challengeId)
    if (!membership) return null
    assertIsoDate(args.myDate, "myDate")
    assertIsoDate(args.partnerDate, "partnerDate")
    const dates = memberDates(args.otherDates, "otherDates")
    const { challenge } = membership
    const roster = await rosterOf(ctx, challenge._id, userId)
    const mine = await getDayRow(ctx, challenge._id, userId, args.myDate)
    const first = roster.others[0]
    const partnerRow = first ? await getDayRow(ctx, challenge._id, first.userId, args.partnerDate) : null
    return {
      challenge: challengeView(challenge, userId, roster.rows),
      mine: mine ?? null,
      partner: partnerRow ? dayView(partnerRow) : null,
      others: await otherDays(ctx, challenge._id, roster.others, dates, args.partnerDate),
    }
  },
})

/**
 * Today across the caller's active challenges, in one subscription, for the
 * Today block. `cards` names the challenges, the first other member's local
 * date (`partnerDate`) and optionally each member's (`otherDates`); an id the
 * caller is not an active member of is skipped, never an error.
 */
export const todayCards = query({
  args: {
    myDate: v.string(),
    cards: v.array(v.object({ challengeId: v.id("challenges"), partnerDate: v.string(), otherDates: otherDatesValidator })),
  },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return []
    assertIsoDate(args.myDate, "myDate")
    const out: Array<{
      challengeId: Id<"challenges">
      challenge: ChallengeView
      mine: ReturnType<typeof myDayView> | null
      partner: ChallengeDayView | null
      others: Array<{ key: string; day: ChallengeDayView | null }>
    }> = []
    const seen = new Set<string>()
    for (const card of args.cards.slice(0, MAX_ACTIVE_MEMBERSHIPS)) {
      if (seen.has(card.challengeId)) continue
      seen.add(card.challengeId)
      if (!ISO_DATE.test(card.partnerDate)) continue
      const membership = await findMember(ctx, userId, card.challengeId)
      if (!membership || membership.challenge.status !== "active") continue
      // A malformed per-member date is skipped like a malformed partnerDate: that member reads at partnerDate.
      const dates = new Map(
        (card.otherDates ?? [])
          .slice(0, MEMBER_ROW_BOUND)
          .filter((d) => ISO_DATE.test(d.date))
          .map((d) => [d.key, d.date] as const),
      )
      const roster = await rosterOf(ctx, card.challengeId, userId)
      const mine = await getDayRow(ctx, card.challengeId, userId, args.myDate)
      const first = roster.others[0]
      const partnerRow = first ? await getDayRow(ctx, card.challengeId, first.userId, card.partnerDate) : null
      out.push({
        challengeId: card.challengeId,
        challenge: challengeView(membership.challenge, userId, roster.rows),
        mine: mine ? myDayView(mine) : null,
        partner: partnerRow ? dayView(partnerRow) : null,
        others: await otherDays(ctx, card.challengeId, roster.others, dates, card.partnerDate),
      })
    }
    return out
  },
})

/**
 * Every day of one challenge from the start up to `toDate`, for every
 * member. Callers pass yesterday, not today: today's row is rewritten on
 * every planner edit, and keeping it out of this read set is what stops each
 * keystroke from re-reading a whole season (the same hot/cold rule as
 * `plannerDays`). The first other member's rows (`partner`) run to
 * `partnerToDate` (default `toDate`): their yesterday, which is not the
 * viewer's when they are a day ahead. Each other member's rows (`others`)
 * run to their entry in `otherToDates`, else `partnerToDate ?? toDate`.
 */
export const history = query({
  args: {
    challengeId: v.string(),
    toDate: v.string(),
    partnerToDate: v.optional(v.string()),
    otherToDates: v.optional(v.array(v.object({ key: v.string(), toDate: v.string() }))),
  },
  handler: async (ctx, args) => {
    const userId = await viewerId(ctx)
    if (!userId) return null
    const membership = await findMemberByString(ctx, userId, args.challengeId)
    if (!membership) return null
    assertIsoDate(args.toDate, "toDate")
    const partnerToDate = args.partnerToDate ?? args.toDate
    assertIsoDate(partnerToDate, "partnerToDate")
    const toDates = memberDates(
      args.otherToDates?.map((d) => ({ key: d.key, date: d.toDate })),
      "otherToDates",
    )
    const { challenge } = membership
    const roster = await rosterOf(ctx, challenge._id, userId)
    const partner = roster.others[0] ?? null
    const rowsFor = async (memberId: string, toDate: string) =>
      (
        await ctx.db
          .query("challengeDays")
          .withIndex("by_challenge_user_date", (q) =>
            q.eq("challengeId", challenge._id).eq("userId", memberId).gte("date", challenge.startDate).lte("date", toDate),
          )
          .take(HISTORY_CAP)
      ).map(dayView)
    const others: Array<{ key: string; rows: ChallengeDayView[] }> = []
    for (const m of roster.others) {
      const key = m._id as string
      others.push({ key, rows: await rowsFor(m.userId, toDates.get(key) ?? partnerToDate) })
    }
    return {
      challenge: challengeView(challenge, userId, roster.rows),
      mine: await rowsFor(userId, args.toDate),
      partner: partner ? await rowsFor(partner.userId, partnerToDate) : [],
      others,
    }
  },
})

/**
 * What an invite link opens onto. No auth: the visitor may not have an
 * account yet. It names nobody but the inviter; `memberCount` is how many are
 * in it (0 when there is no challenge to read). A former member previews as
 * `ok`: accepting brings their own row back. A link whose inviter is no
 * longer an active member previews as `notFound` and names nobody: a former
 * member's name and lists are never shown.
 */
export const invitePreview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const seats = (memberCount: number) => ({ memberCount, capacity: MAX_MEMBERS })
    const none = { challenge: null, inviterName: null, inviterGoals: [] as string[], inviterDonts: [] as string[], ...seats(0) }
    const noLists = { inviterGoals: [] as string[], inviterDonts: [] as string[] }
    const invite = await ctx.db
      .query("challengeInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!invite) return { status: "notFound" as const, ...none }
    const challenge = await ctx.db.get(invite.challengeId)
    if (!challenge || challenge.status !== "active") return { status: "ended" as const, ...none }
    const preview = { name: challenge.name, startDate: challenge.startDate, endDate: challenge.endDate }
    const rows = await memberRowsOf(ctx, challenge._id)
    const members = activeOf(rows)
    const count = seats(members.length)
    // Auth is optional here: a signed-in member revisiting the link is told they are in.
    const identity = await ctx.auth.getUserIdentity()
    if (identity && members.some((m) => m.userId === getUserId(identity.subject))) {
      return { status: "member" as const, challengeId: challenge._id, challenge: preview, inviterName: null, ...noLists, ...count }
    }
    // A link made by someone who has since left or been dropped is dead: it reads as not valid
    // (the client's existing `notFound` sentence), and nothing of the former member is shown.
    const inviter = members.find((m) => m.userId === invite.createdBy)
    if (!inviter) return { status: "notFound" as const, ...none }
    if (invite.acceptedBy) return { status: "used" as const, challenge: preview, inviterName: null, ...noLists, ...count }
    if (invite.expiresAt <= Date.now()) return { status: "expired" as const, challenge: preview, inviterName: null, ...noLists, ...count }
    const inviterName = inviter.displayName
    // What the friend is signing up next to: the inviter's active lists, texts only.
    const lists = memberCommitments(challenge, inviter)
    const inviterLists = {
      inviterGoals: activeGoalTexts(lists.goals),
      inviterDonts: lists.donts.filter((d) => d.archivedAt === undefined).map((d) => d.text),
    }
    if (members.length >= MAX_MEMBERS) return { status: "full" as const, challenge: preview, inviterName, ...inviterLists, ...count }
    return { status: "ok" as const, challenge: preview, inviterName, ...inviterLists, ...count }
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
  solo: boolean
  /** Rows of members who left or were dropped; they are not in `members`. */
  formerMembers: number
  /** Active members, join order. */
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
      const all = await memberRowsOf(ctx, c._id)
      const members = activeOf(all)
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
      const warned = c.warning ? all.find((m) => m.userId === c.warning!.userId) : undefined
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
        solo: c.solo === true,
        formerMembers: all.length - members.length,
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
    /** Just me: no partner expected. An invite can still be made later. */
    solo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await assertBelowCap(ctx, userId)
    const name = args.name.trim()
    if (!name) fail("A name is required")
    if (name.length > MAX_NAME) fail(`Name must be ${MAX_NAME} characters or fewer`)
    assertSpan(args)
    const timezone = cleanTimezone(args.timezone)
    const displayName = cleanDisplayName(args.displayName)
    const goalTexts = cleanList(args.goals, "goals")
    const dontTexts = cleanList(args.donts, "don'ts")
    const now = Date.now()
    const goals = mintGoals(goalTexts, now)
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
      ...(args.solo === true ? { solo: true } : {}),
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

/**
 * A link to paste to a friend; any active member may make one while seats
 * remain. One seat per link, one open invite at a time; asking again returns it.
 */
export const createInvite = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const members = await membersOf(ctx, challenge._id)
    if (members.length >= MAX_MEMBERS) fail(FULL_MESSAGE)
    const now = Date.now()
    const open = await openInvite(ctx, challenge._id, now, members)
    if (open) return { token: open.token, expiresAt: open.expiresAt }
    const token = crypto.randomUUID()
    const expiresAt = now + INVITE_TTL_MS
    await ctx.db.insert("challengeInvites", { challengeId: challenge._id, token, createdBy: userId, expiresAt })
    return { token, expiresAt }
  },
})

/**
 * Joining. The joiner may bring their own lists; without them they start
 * empty. A former member (left or dropped) gets their own row back, with
 * their name, join order, lists and ids, and their recorded days reappear;
 * only `joinedDate` moves to their today, so inactivity counts from the
 * return. Lists sent with the accept are used for a returning member only
 * where their own list is empty.
 */
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
    const rows = await memberRowsOf(ctx, challenge._id)
    const members = activeOf(rows)
    if (members.some((m) => m.userId === userId)) return { challengeId: challenge._id }
    // A former member cannot keep adding people through a link they made before leaving.
    if (!members.some((m) => m.userId === invite.createdBy)) fail("This invite link is no longer valid")
    if (invite.acceptedBy) fail("This invite has already been used")
    if (invite.expiresAt <= now) fail("This invite has expired")
    if (members.length >= MAX_MEMBERS) fail(FULL_MESSAGE)
    await assertBelowCap(ctx, userId)
    const timezone = cleanTimezone(args.timezone)
    const displayName = cleanDisplayName(args.displayName)
    const goals = mintGoals(cleanList(args.goals ?? [], "goals"), now)
    const donts = mintDonts(cleanList(args.donts ?? [], "don'ts"), now)
    const former = await ownRow(ctx, userId, challenge._id)
    if (former) {
      // A returning member: the same row, active again. Nothing they recorded is touched.
      await ctx.db.patch(former._id, {
        leftAt: undefined,
        leftReason: undefined,
        timezone,
        joinedDate: localDateAndMinutes(now, timezone).date,
        ...((former.goals ?? []).length === 0 && goals.length > 0 ? { goals, commitmentsUpdatedAt: now } : {}),
        ...((former.donts ?? []).length === 0 && donts.length > 0 ? { donts, commitmentsUpdatedAt: now } : {}),
      })
    } else {
      // Former rows are kept forever; the read that finds them is bounded, so the table is too.
      if (rows.length >= MEMBER_ROW_BOUND) fail("This challenge cannot take new members")
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
    }
    await ctx.db.patch(invite._id, { acceptedBy: userId, acceptedAt: now })
    // A solo challenge that gains a member is a shared challenge from now on.
    if (challenge.solo === true) await ctx.db.patch(challenge._id, { solo: false })
    return { challengeId: challenge._id }
  },
})

/**
 * One list's edit under the keep-or-archive rule. An item sent with a known
 * id keeps that id (its text may change; a blank text removes it); a current
 * item left out is archived, not deleted, because a recorded day may name
 * it; an item sent without an id is new. Archived ones stay archived and do
 * not count against the cap. `label` is the plural in sentences ("goals"),
 * `unknown` the refusal for an id that is not an active one of the member's.
 */
function reconcileList(
  current: Commitment[],
  rows: Array<{ id?: string; text: string }>,
  now: number,
  mint: (texts: string[], now: number, offset: number) => Commitment[],
  label: string,
  unknown: string,
): Commitment[] {
  // Blank rows are dropped below, so they do not count against the cap.
  if (rows.filter((r) => r.text.trim().length > 0).length > MAX_LIST) fail(`At most ${MAX_LIST} ${label}`)
  const active = new Set(current.filter((c) => c.archivedAt === undefined).map((c) => c.id))
  const kept = new Set<string>()
  const next: Commitment[] = []
  let minted = 0
  for (const row of rows) {
    const text = row.text.trim()
    if (text.length > MAX_ITEM) fail(`Each of the ${label} must be ${MAX_ITEM} characters or fewer`)
    if (row.id !== undefined) {
      if (!active.has(row.id) || kept.has(row.id)) fail(unknown)
      // A blank text for a known id is a removal; it is archived below.
      if (!text) continue
      kept.add(row.id)
      next.push({ id: row.id, text })
    } else if (text) {
      minted += 1
      next.push(mint([text], now, current.length + minted - 1)[0]!)
    }
  }
  const archived = current
    .map((c) => (c.archivedAt !== undefined || kept.has(c.id) ? c : { ...c, archivedAt: now }))
    .filter((c) => c.archivedAt !== undefined)
  return [...next, ...archived]
}

/**
 * Replace the caller's own goals and don'ts in one challenge. Both follow
 * one rule (`reconcileList`): a known id keeps its id, a missing one is
 * archived, a new one is minted. A goal may also arrive as a bare string,
 * which is new. A member still on legacy string goals is converted to
 * objects here, and the `goal-legacy-<i>` ids the client read are honoured,
 * so a day marked before the first edit still resolves after it.
 */
export const updateMyCommitments = mutation({
  args: {
    challengeId: v.id("challenges"),
    goals: v.array(v.union(v.string(), v.object({ id: v.optional(v.string()), text: v.string() }))),
    donts: v.array(v.object({ id: v.optional(v.string()), text: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const current = memberCommitments(challenge, me)
    const now = Date.now()
    const goalRows = args.goals.map((g) => (typeof g === "string" ? { text: g } : g))
    const goalItems = reconcileList(current.goals, goalRows, now, mintGoals, "goals", "Unknown goal")
    const donts = reconcileList(current.donts, args.donts, now, mintDonts, "don'ts", "Unknown don't")
    await ctx.db.patch(me._id, { goals: goalItems, donts, commitmentsUpdatedAt: now })
    // The same two goal fields as `memberView`: texts for an older client, items with ids for the new one.
    return { goals: activeGoalTexts(goalItems), goalItems, donts }
  },
})

/**
 * Correcting the season's dates and deadlines. Only the (current) creator
 * may, and only while it runs. No recorded day may fall out of it: the end
 * cannot move before any active member's today (the season-over sweep would
 * end it at once), and the start cannot move past the first lock-in,
 * check-in or mark any member recorded, former members included (`history`
 * reads from the start, so those days would vanish from view), nor past the
 * first closed stretch. The 366-day cap runs from the start, or from
 * `reopenedDate` once the challenge has been reopened (as the reopen measured
 * it), so a reopened season longer than a year from its start stays editable.
 * Day rows are never touched; `status` is untouched.
 */
export const updateSpan = mutation({
  args: {
    challengeId: v.id("challenges"),
    startDate: v.string(),
    endDate: v.string(),
    planDeadline: v.optional(v.string()),
    checkinDeadline: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ChallengeView> => {
    const userId = await requireUser(ctx)
    const { challenge } = await requireMember(ctx, userId, args.challengeId, { write: true })
    if (challenge.createdBy !== userId) fail("Only the creator can change the dates")
    assertSpan(args, challenge.reopenedDate)
    const rows = await memberRowsOf(ctx, challenge._id)
    for (const m of activeOf(rows)) {
      if (args.endDate < memberToday(m)) fail("The end date can't be before today")
    }
    let firstRecorded: string | null = null
    for (const m of rows) {
      // Ascending by date; the first row carrying an act or a mark is the member's earliest record.
      const days = ctx.db
        .query("challengeDays")
        .withIndex("by_challenge_user_date", (q) => q.eq("challengeId", challenge._id).eq("userId", m.userId))
      for await (const row of days) {
        const marked = row.dontsBroken.length > 0 || (row.goalsKept ?? []).length > 0
        if (row.planSetAt === undefined && row.checkinAt === undefined && !marked) continue
        if (firstRecorded === null || row.date < firstRecorded) firstRecorded = row.date
        break
      }
    }
    if (firstRecorded !== null && args.startDate > firstRecorded) {
      fail(`The start can't move past ${dayMonth(firstRecorded)}, when the first lock-in, check-in or mark was recorded`)
    }
    const firstClosed = firstClosedDate(challenge.closedSpans)
    if (firstClosed !== null && args.startDate > firstClosed) {
      fail(`The start can't move past ${dayMonth(firstClosed)}, when the challenge was closed`)
    }
    await ctx.db.patch(challenge._id, {
      startDate: args.startDate,
      endDate: args.endDate,
      ...(args.planDeadline !== undefined ? { planDeadline: args.planDeadline } : {}),
      ...(args.checkinDeadline !== undefined ? { checkinDeadline: args.checkinDeadline } : {}),
    })
    return challengeView((await ctx.db.get(challenge._id))!, userId, rows)
  },
})

/** The season's name belongs to every member; any may change it while it runs. */
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
 * Leaving. Nothing is deleted: the leaver's row is kept and marked
 * (`leftAt`, `leftReason: "left"`), a former member who sees nothing of the
 * challenge until an invite brings them back with everything intact. The
 * creator leaving hands the role to the longest-standing remaining member
 * and the challenge runs on. The last active member leaving ends it
 * (`allLeft`) and keeps their row active, so they can still read it and
 * reopen it. A warning naming the leaver goes with them. Day rows are never
 * touched.
 */
export const leaveChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const now = Date.now()
    const rows = await memberRowsOf(ctx, challenge._id)
    const others = activeOf(rows).filter((m) => m.userId !== userId)
    if (others.length === 0) {
      await ctx.db.patch(challenge._id, { status: "ended", endedReason: "allLeft", endedAt: now })
      return null
    }
    await handOverIfCreator(ctx, challenge, rows, me)
    await ctx.db.patch(me._id, { leftAt: now, leftReason: "left" })
    if (challenge.warning?.userId === userId) await ctx.db.patch(challenge._id, { warning: undefined })
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

/**
 * Reopening an ended challenge, by its creator, with everything it recorded.
 * One patch on the challenge: active again, the end reason, end time and any
 * warning gone, `endDate` set (`endDate ?? the old one`), the reopen stamped,
 * and the stretch it spent closed appended to `closedSpans`. No member row
 * and no day row is touched; former members stay former. The end date must
 * be on or after every active member's today (else code `needsEndDate`, and
 * the client asks for one), not before the start, and at most 366 days from
 * the reopen day. Inactivity counts no day before the reopen day. Every other
 * active member is emailed once that it runs again.
 */
export const reopenChallenge = mutation({
  args: { challengeId: v.id("challenges"), endDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) fail("This challenge no longer exists")
    const membership = await findMember(ctx, userId, challenge._id)
    if (!membership) fail("You are not in this challenge")
    const { me } = membership
    if (challenge.createdBy !== userId) fail("Only the creator can reopen a challenge")
    if (challenge.status === "active") fail("This challenge is already running")
    await assertBelowCap(ctx, userId)
    const endDate = args.endDate ?? challenge.endDate
    assertIsoDate(endDate, "endDate")
    const now = Date.now()
    const members = await membersOf(ctx, challenge._id)
    const reopenDay = localDateAndMinutes(now, me.timezone).date
    const problem = reopenEndProblem({
      endDate,
      startDate: challenge.startDate,
      memberTodays: members.map((m) => memberToday(m)),
      reopenDay,
    })
    if (problem === "needsEndDate") fail("Pick an end date from today on", "needsEndDate")
    if (problem === "beforeStart") fail("The challenge must end on or after it starts")
    if (problem === "tooLong") fail("A season runs at most 366 days from today")

    let span: ClosedSpan | null = null
    if (challenge.endedAt !== undefined) {
      const endedDate = localDateAndMinutes(challenge.endedAt, me.timezone).date
      let acted = false
      for (const m of members) {
        const row = await getDayRow(ctx, challenge._id, m.userId, endedDate)
        if (row && (row.planSetAt !== undefined || row.checkinAt !== undefined)) acted = true
      }
      span = closedSpanFor({ endedDate, actedOnEndedDate: acted, reopenedDate: reopenDay })
    }
    await ctx.db.patch(challenge._id, {
      status: "active",
      endedReason: undefined,
      endedAt: undefined,
      warning: undefined,
      endDate,
      reopenedDate: reopenDay,
      reopenedAt: now,
      closedSpans: appendClosedSpan(challenge.closedSpans, span),
    })

    const link = `${process.env.SITE_URL ?? ""}/challenge/${challenge._id}`
    for (const m of members) {
      if (m.userId === userId) continue
      const email = await userEmail(ctx, m.userId)
      if (!email) continue
      await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
        to: email,
        subject: `${challenge.name} is running again`,
        text: [
          `Hi ${m.displayName},`,
          ``,
          `${me.displayName} reopened "${challenge.name}". It runs to ${dayMonth(endDate)}, and everything recorded so far is kept. The days it was closed count against nobody.`,
          ``,
          link,
        ].join("\n"),
      })
    }
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

/**
 * The evening act, per challenge. Checking in again updates the note and the
 * marks, not the time. `dontsBroken` is the full set (the sheet seeds it from
 * the row), so the latest explicit save wins; `goalsKept`, when given, is
 * written the same way, and when absent the row's marks are left as they are.
 */
export const checkIn = mutation({
  args: {
    challengeId: v.id("challenges"),
    date: v.string(),
    summary: summaryValidator,
    note: v.optional(v.string()),
    dontsBroken: v.array(v.string()),
    goalsKept: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const membership = await requireMember(ctx, userId, args.challengeId, { write: true })
    const { challenge } = membership
    const marks = cleanMarks(membership, args.date, { goalsKept: args.goalsKept, dontsBroken: args.dontsBroken })
    const note = args.note?.trim() ?? ""
    if (note.length > MAX_NOTE) fail(`Note must be ${MAX_NOTE} characters or fewer`)
    const existing = await getDayRow(ctx, challenge._id, userId, args.date)
    const now = Date.now()
    const checkinAt = existing?.checkinAt ?? now
    await upsertDay(ctx, challenge._id, userId, args.date, args.summary, {
      checkinAt,
      dontsBroken: marks.dontsBroken ?? [],
      ...(marks.goalsKept !== undefined ? { goalsKept: marks.goalsKept } : {}),
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
 * A daily mark, any time during the day: which goals the member kept and
 * which don'ts they broke, in one challenge. Same date rules as `checkIn`
 * (in the span, today or yesterday on the member's own clock), every id one
 * of the member's own (archived counts), de-duplicated. Only the lists given
 * are written; a list left out stays as it was. It touches nothing else on
 * the row (not the summary, the acts, the note or the reminders), and it is
 * not one of the two daily acts: no `recordAct`, so it never counts against
 * inactivity. A missing row is created with an empty summary and no acts.
 */
export const markDay = mutation({
  args: {
    challengeId: v.id("challenges"),
    date: v.string(),
    goalsKept: v.optional(v.array(v.string())),
    dontsBroken: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ goalsKept: string[]; dontsBroken: string[] }> => {
    const userId = await requireUser(ctx)
    const membership = await requireMember(ctx, userId, args.challengeId, { write: true })
    const marks = cleanMarks(membership, args.date, { goalsKept: args.goalsKept, dontsBroken: args.dontsBroken })
    const patch = {
      ...(marks.goalsKept !== undefined ? { goalsKept: marks.goalsKept } : {}),
      ...(marks.dontsBroken !== undefined ? { dontsBroken: marks.dontsBroken } : {}),
    }
    const challengeId = membership.challenge._id
    const existing = await getDayRow(ctx, challengeId, userId, args.date)
    if (existing) {
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch)
      const row = (await ctx.db.get(existing._id))!
      return { goalsKept: row.goalsKept ?? [], dontsBroken: row.dontsBroken }
    }
    await ctx.db.insert("challengeDays", {
      challengeId,
      userId,
      date: args.date,
      summary: emptySummary(),
      summaryUpdatedAt: Date.now(),
      dontsBroken: [],
      remindersSent: { plan: 0, checkin: 0 },
      ...patch,
    })
    return { goalsKept: marks.goalsKept ?? [], dontsBroken: marks.dontsBroken ?? [] }
  },
})

/**
 * An email to one other member of a challenge while they still owe the day
 * something: up to three per member nudged on the nudger's own local day, at
 * least an hour apart. `memberKey` names the target; without it the target
 * is the first other member (`partner`), which is what the two-person client
 * sends. The rules live in `_shared/challengeNudges.ts`, shared with the
 * card's button; the per-target times are `nudgesByMember[key]` on the
 * nudger's day row, and the legacy `nudgesSentAt` list is still appended so
 * a two-person client's count stays right. The send is scheduled from
 * inside the transaction, so a nudge that fails to record never goes out;
 * "sent" means queued, not delivered.
 */
export const nudgePartner = mutation({
  args: { challengeId: v.id("challenges"), memberKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ left: number; nextAt: number | null }> => {
    const userId = await requireUser(ctx)
    const { challenge, me } = await requireMember(ctx, userId, args.challengeId, { write: true })
    const others = (await membersOf(ctx, challenge._id)).filter((m) => m.userId !== userId)
    let partner: Doc<"challengeMembers"> | undefined
    if (args.memberKey !== undefined) {
      partner = others.find((m) => (m._id as string) === args.memberKey)
      if (!partner) fail("They are not in this challenge")
    } else {
      partner = others[0]
      if (!partner) fail("Nobody has joined yet")
    }
    const key = partner._id as string
    const now = Date.now()
    const partnerLocal = localDateAndMinutes(now, partner.timezone)
    if (!inRange(challenge, partnerLocal.date)) fail("The challenge is not running today", NUDGE_RULE_CODE)
    const partnerRow = await getDayRow(ctx, challenge._id, partner.userId, partnerLocal.date)
    const evening = partnerLocal.minutes >= hhmmToMinutes(CHECKIN_START)
    const owes = partnerOwesToday({ evening, planSetAt: partnerRow?.planSetAt, checkinAt: partnerRow?.checkinAt })
    if (!owes) fail(evening ? "They have already checked in" : "They have already locked in their plan", NUDGE_RULE_CODE)
    const myLocal = localDateAndMinutes(now, me.timezone)
    const myRow = await getDayRow(ctx, challenge._id, userId, myLocal.date)
    const times = nudgeTimesFor(myRow, key, partner._id === others[0]?._id)
    const refusal = nudgeRefusal(nudgeAvailability({ nowMs: now, times, partnerOwes: owes }), now)
    if (refusal) fail(refusal, NUDGE_RULE_CODE)
    const email = await userEmail(ctx, partner.userId)
    if (!email) fail(others.length > 1 ? "They have no email address on file" : "Your partner has no email address on file")
    const mine = myRow ?? (await upsertDay(ctx, challenge._id, userId, myLocal.date, emptySummary()))
    const sent = [...times, now]
    // A row from before per-target bookkeeping: its legacy list was all toward the first other member.
    const legacy = nudgeTimes(mine)
    const byMember = mine.nudgesByMember ?? (legacy.length > 0 ? { [others[0]!._id as string]: legacy } : {})
    // The legacy list keeps every nudge of the day; a legacy `nudgeSentAt` is carried into it on the first write.
    const allSent = [...legacy, now]
    await ctx.db.patch(mine._id, { nudgesSentAt: allSent, nudgesByMember: { ...byMember, [key]: sent } })
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
