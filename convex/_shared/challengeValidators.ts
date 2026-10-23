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
 * One thing a member promised not to do. Ids are minted server-side and keep
 * through text edits. Removing a don't archives it (`archivedAt`) rather than
 * deleting it, so every id ever named in `challengeDays.dontsBroken` still
 * resolves to its text: a confession is recorded work.
 */
export const dontValidator = v.object({ id: v.string(), text: v.string(), archivedAt: v.optional(v.number()) })
export type Dont = Infer<typeof dontValidator>

/**
 * What a partner is allowed to see of a day. Built on the client from the
 * planner (`buildChallengeSummary`) and stored as-is; the planner's own rows
 * are never read across users. Private tasks are counted, never titled.
 */
export const summaryValidator = v.object({
  top3: v.array(v.object({ title: v.string(), isDone: v.boolean() })),
  tasksDone: v.number(),
  tasksTotal: v.number(),
  privateCount: v.number(),
  deepWorkMinutes: v.number(),
  habitsDone: v.number(),
  habitsTotal: v.number(),
})
export type ChallengeSummary = Infer<typeof summaryValidator>

export const remindersSentValidator = v.object({
  plan: v.number(),
  checkin: v.number(),
  lastAt: v.optional(v.number()),
})

export const challengeStatusValidator = v.union(v.literal("active"), v.literal("ended"))

export function emptySummary(): ChallengeSummary {
  return { top3: [], tasksDone: 0, tasksTotal: 0, privateCount: 0, deepWorkMinutes: 0, habitsDone: 0, habitsTotal: 0 }
}
