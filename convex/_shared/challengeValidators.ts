/**
 * convex/_shared/challengeValidators.ts
 *
 * Validators shared by `schema.ts` and `challenges.ts`, so an argument
 * validator and the table it writes to cannot drift apart. That drift is
 * exactly what broke sync for months in 2026 (see docs/DEPLOYMENT.md,
 * "Sync outage"): the client sent a field the deployed validator did not know.
 */

import { v, type Infer } from "convex/values"

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * One goal or one don't of a member. Ids are minted server-side and keep
 * through text edits. Removing one archives it (`archivedAt`) rather than
 * deleting it, so every id ever named in `challengeDays.goalsKept` or
 * `dontsBroken` still resolves to its text: a mark is recorded work.
 */
export const commitmentValidator = v.object({ id: v.string(), text: v.string(), archivedAt: v.optional(v.number()) })
export type Commitment = Infer<typeof commitmentValidator>
/** Kept as an alias; existing imports keep working. */
export const dontValidator = commitmentValidator
export type Dont = Commitment

/**
 * What a partner is allowed to see of a day. Built on the client from the
 * planner (`buildChallengeSummary`) and stored as-is; the planner's own rows
 * are never read across users. Private tasks are counted, never titled.
 */
export const summaryValidator = v.object({
  top3: v.array(v.object({ title: v.string(), isDone: v.boolean() })),
  /** `top3` is the first tasks on the list, because no Top 3 was set. */
  top3FromTasks: v.optional(v.boolean()),
  tasksDone: v.number(),
  tasksTotal: v.number(),
  /**
   * Every visible task outside the Top 3, title and done state: the partner
   * sees the whole day, and a task the member marked private is left out here
   * and counted in `privateCount` instead. Absent from rows written before
   * 7 Nov 2026 and from older clients, which sent only the two counts.
   */
  tasks: v.optional(v.array(v.object({ title: v.string(), isDone: v.boolean() }))),
  privateCount: v.number(),
  deepWorkMinutes: v.number(),
  habitsDone: v.number(),
  habitsTotal: v.number(),
  /** Whole minutes planned for the day: every root task, private ones included. Absent from old clients. */
  plannedMinutes: v.optional(v.number()),
  /** Whole minutes earned by ticks (rounded down), the rule of `computeDayCompletion`. Absent from old clients. */
  doneMinutes: v.optional(v.number()),
})
export type ChallengeSummary = Infer<typeof summaryValidator>

export const remindersSentValidator = v.object({
  plan: v.number(),
  checkin: v.number(),
  lastAt: v.optional(v.number()),
})

export const challengeStatusValidator = v.union(v.literal("active"), v.literal("ended"))

/**
 * Why a challenge ended. Absent on challenges that ended before reasons were
 * recorded. `creatorLeft`: legacy, the creator left under the two-person rule
 * (no longer written: the creator now hands over to the longest-standing
 * member); `allLeft`: the last member left; `inactive`: a member went four full days
 * without a lock-in or check-in after a warning; `seasonOver`: every member
 * is past the end date; `manual`: ended by hand (`challengesInternal.endChallenge`).
 */
export const endedReasonValidator = v.union(
  v.literal("creatorLeft"),
  v.literal("allLeft"),
  v.literal("inactive"),
  v.literal("seasonOver"),
  v.literal("manual"),
)
export type EndedReason = Infer<typeof endedReasonValidator>

/**
 * The inactivity warning on an active challenge: which member, the first of
 * the three missed days it counted, and when it went out. Cleared by that
 * member's next lock-in or check-in; kept as the record when the challenge
 * closes for inactivity. `userId` never leaves the server.
 */
export const warningValidator = v.object({
  userId: v.string(),
  missedSince: v.string(),
  issuedAt: v.number(),
})
export type ChallengeWarning = Infer<typeof warningValidator>

/**
 * Why a member row is a former member's. `left`: they left by hand;
 * `inactive`: the sweep dropped them from a group of three or more after
 * four quiet days. The row is kept whole either way, so an invite brings
 * them back with their name, lists and days intact.
 */
export const leftReasonValidator = v.union(v.literal("left"), v.literal("inactive"))
export type LeftReason = Infer<typeof leftReasonValidator>

/**
 * A stretch an ended challenge spent closed before a reopen, ISO dates,
 * both inclusive. Those days count as missed for nobody.
 */
export const closedSpanValidator = v.object({ from: v.string(), to: v.string() })
export type ClosedSpan = Infer<typeof closedSpanValidator>

/**
 * Nudges sent on the nudger's local day, per member nudged: the key is the
 * nudged member row's id as a string (`memberKey`), the value the send times.
 */
export const nudgesByMemberValidator = v.record(v.string(), v.array(v.number()))

export function emptySummary(): ChallengeSummary {
  return { top3: [], tasksDone: 0, tasksTotal: 0, privateCount: 0, deepWorkMinutes: 0, habitsDone: 0, habitsTotal: 0 }
}
