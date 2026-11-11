/**
 * convex/_shared/challengeMembers.ts
 *
 * The one reader of a challenge's members, shared by `challenges.ts` and
 * `challengesInternal.ts` so the two can never disagree on who is in it or
 * read with different bounds. Also the hand-over of the creator role, which
 * both `leaveChallenge` and the inactivity sweep perform.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server"
import type { Doc, Id } from "../_generated/dataModel"
import type { Commitment, Dont } from "./challengeValidators"
import { MEMBER_ROW_BOUND, activeInJoinOrder, successorOf } from "./challengeGroup"

type Ctx = QueryCtx | MutationCtx

/**
 * Every member row of a challenge, active and former, at most
 * `MEMBER_ROW_BOUND`. Former rows are kept forever, so the bound is on rows,
 * and a join that would pass it is refused.
 */
export async function memberRowsOf(ctx: Ctx, challengeId: Id<"challenges">): Promise<Doc<"challengeMembers">[]> {
  return await ctx.db
    .query("challengeMembers")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .take(MEMBER_ROW_BOUND)
}

/** The active members of a challenge (no `leftAt`), longest-standing first (`joinedAt` ascending). */
export async function membersOf(ctx: Ctx, challengeId: Id<"challenges">): Promise<Doc<"challengeMembers">[]> {
  return activeInJoinOrder(await memberRowsOf(ctx, challengeId))
}

/** The id a legacy (plain string) goal reads as: its index in the stored list. */
export function legacyGoalId(index: number): string {
  return `goal-legacy-${index}`
}

/**
 * Goals as objects. A string is a legacy goal, written before goals had ids:
 * the one at index `i` reads as `{ id: "goal-legacy-<i>", text }`, so a mark
 * made against it keeps resolving after the member's first edit (which
 * stores these ids for real). Objects pass through.
 */
export function normalizeGoals(goals: ReadonlyArray<string | Commitment> | undefined): Commitment[] {
  return (goals ?? []).map((g, i) => (typeof g === "string" ? { id: legacyGoalId(i), text: g } : g))
}

/**
 * A member's own goals and don'ts. Rows written before per-member lists have
 * none; the creator's then come from the challenge row, where they used to
 * live, and anyone else starts empty. This is the whole migration. (A
 * hand-over stores the legacy lists on the old creator's row and empty lists
 * on a list-less successor's row, so the fallback never moves to the new
 * creator.)
 */
export function memberCommitments(challenge: Doc<"challenges">, member: Doc<"challengeMembers">): { goals: Commitment[]; donts: Dont[] } {
  const legacy = member.userId === challenge.createdBy
  return {
    goals: normalizeGoals(member.goals ?? (legacy ? challenge.goals : [])),
    donts: member.donts ?? (legacy ? challenge.donts : []),
  }
}

/**
 * Moves the creator role off `leaving` to the longest-standing other active
 * member, when `leaving` is the creator. A creator whose own lists still live
 * on the challenge row (legacy) gets them written onto their member row
 * first, with the same ids they read as, so nothing they marked stops
 * resolving; a successor whose row has no lists gets empty ones, so the
 * legacy lists never become theirs. Returns the new creator, or null when
 * nothing moved.
 */
export async function handOverIfCreator(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  rows: Doc<"challengeMembers">[],
  leaving: Doc<"challengeMembers">,
): Promise<Doc<"challengeMembers"> | null> {
  if (challenge.createdBy !== leaving.userId) return null
  const next = successorOf(rows, leaving.userId)
  if (!next) return null
  if (leaving.goals === undefined || leaving.donts === undefined) {
    const lists = memberCommitments(challenge, leaving)
    await ctx.db.patch(leaving._id, {
      ...(leaving.goals === undefined ? { goals: lists.goals } : {}),
      ...(leaving.donts === undefined ? { donts: lists.donts } : {}),
    })
  }
  // A successor on a pre-v2 row (no lists) would otherwise read the legacy challenge-row lists as their own.
  if (next.goals === undefined || next.donts === undefined) {
    await ctx.db.patch(next._id, {
      ...(next.goals === undefined ? { goals: [] } : {}),
      ...(next.donts === undefined ? { donts: [] } : {}),
    })
  }
  await ctx.db.patch(challenge._id, { createdBy: next.userId })
  return next
}
