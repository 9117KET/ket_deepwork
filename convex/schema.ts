import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"
import {
  challengeStatusValidator,
  commitmentValidator,
  dontValidator,
  endedReasonValidator,
  remindersSentValidator,
  summaryValidator,
  warningValidator,
} from "./_shared/challengeValidators"

export default defineSchema({
  ...authTables,

  plannerDays: defineTable({
    userId: v.string(),
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
    // Client-stamped logical edit time (ms). Used by upsert to reject a write
    // whose snapshot is older than what is already stored, so two mutations
    // racing in flight can't let the stale one clobber the fresh one.
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  userSettings: defineTable({
    userId: v.string(),
    habitDefinitions: v.optional(v.array(v.any())),
    monthTitles: v.optional(v.record(v.string(), v.string())),
    activeDays: v.optional(v.array(v.string())),
    blockDurationRatios: v.optional(v.any()),
    routineMinutes: v.optional(v.any()),
    notDoingList: v.optional(v.array(v.any())),
    identityStatement: v.optional(v.string()),
    depthPhilosophy: v.optional(v.string()),
    deepWorkGoalHours: v.optional(v.number()),
    focusBlockMinutes: v.optional(v.number()),
    focusBreakMinutes: v.optional(v.number()),
    oneThingData: v.optional(v.any()),
    weeklyProjectRotation: v.optional(v.array(v.any())),
    sideQuestDefs: v.optional(v.array(v.any())),
    sideQuestXp: v.optional(v.number()),
    sideQuestStreak: v.optional(v.number()),
    sideQuestLastStreakDate: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  // ── Legacy: sharing, finance, travel ──────────────────────────────────────
  // The features and every function that read or wrote these tables were
  // removed in the minimal rewrite. The tables stay so existing rows are kept
  // until they have been exported (see docs/DEPLOYMENT.md, "Retiring the old
  // features"). Deleting them is a separate, explicit step — never a side
  // effect of a schema change.
  shareTokens: defineTable({
    ownerUserId: v.string(),
    token: v.string(),
    permission: v.union(v.literal("view"), v.literal("edit")),
    label: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_owner", ["ownerUserId"]),

  financialSettings: defineTable({
    userId: v.string(),
    data: v.any(),
  }).index("by_user", ["userId"]),

  travelTrips: defineTable({
    userId: v.string(),
    name: v.string(),
    destination: v.string(),
    origin: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    durationDays: v.number(),
    purpose: v.string(),
    lifeStage: v.string(),
    budgetPreference: v.string(),
    accommodationPreference: v.string(),
    benefits: v.optional(v.string()),
    generatedPlan: v.optional(v.any()),
    dailyPlan: v.optional(v.array(v.any())),
    budget: v.optional(v.any()),
    packingList: v.optional(v.array(v.any())),
    notes: v.optional(v.string()),
    status: v.union(v.literal("planning"), v.literal("active"), v.literal("completed")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  googleCalendarConnections: defineTable({
    userId: v.string(),
    encryptedRefreshToken: v.string(),
    selectedCalendarId: v.optional(v.string()),
    selectedCalendarSummary: v.optional(v.string()),
    /** The "Deepblock log" calendar worked blocks are written to; created on first use. */
    logCalendarId: v.optional(v.string()),
    /**
     * Scopes Google reported granting at the last connect. Absent on
     * connections made before Google Tasks was asked for, which is exactly
     * what tells the client to offer a reconnect.
     */
    grantedScopes: v.optional(v.array(v.string())),
    /** The "Deepblock" Google Tasks list planner tasks are mirrored into; created on first use. */
    taskListId: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  /**
   * Planner task ↔ Google Task. The `synced*` fields are the last state both
   * sides agreed on, which is what lets a sync tell "ticked in Google" from
   * "ticked in the planner" without trusting a timestamp from either side.
   */
  googleTaskLinks: defineTable({
    userId: v.string(),
    taskId: v.string(),
    taskDate: v.string(),
    googleTaskListId: v.string(),
    googleTaskId: v.string(),
    syncedTitle: v.string(),
    syncedDone: v.boolean(),
    /** Deleted in Google. The planner task is left alone and never re-sent. */
    remoteGone: v.optional(v.boolean()),
  })
    .index("by_user_task", ["userId", "taskDate", "taskId"])
    .index("by_user_date", ["userId", "taskDate"]),

  calendarEventLinks: defineTable({
    userId: v.string(),
    taskId: v.string(),
    taskDate: v.string(),
    googleCalendarId: v.string(),
    googleEventId: v.string(),
    etag: v.optional(v.string()),
  })
    .index("by_user_task", ["userId", "taskDate", "taskId"])
    .index("by_user_event", ["userId", "googleCalendarId", "googleEventId"]),

  // ── Accountability challenge ──────────────────────────────────────────────
  // Two people, one shared object. Each member's planner stays private: what
  // the partner sees is the `summary` the member's own client publishes into
  // `challengeDays`, never a `plannerDays` row. Index names follow the repo's
  // `by_user_date` style rather than the generated guidelines' `by_a_and_b`.
  challenges: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    /**
     * Legacy. Lists now live on each `challengeMembers` row; these are never
     * written again (`createChallenge` stores `[]`). A creator whose member row
     * has no lists still resolves to them (`memberCommitments`).
     */
    goals: v.array(v.string()),
    donts: v.array(dontValidator),
    /** Local wall-clock deadlines, applied in each member's own timezone. */
    planDeadline: v.string(),
    checkinDeadline: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    /**
     * The one switch the reminder cron reads; "ended" once the creator or
     * everyone has left, a member went inactive, or the end date has passed.
     */
    status: challengeStatusValidator,
    endedAt: v.optional(v.number()),
    endedReason: v.optional(endedReasonValidator),
    /** An inactivity warning standing against one member; a sub-state of "active". */
    warning: v.optional(warningValidator),
    /** Created for one person; absent or false is a two-person challenge. A partner joining sets it false. */
    solo: v.optional(v.boolean()),
  }).index("by_status", ["status"]),

  challengeMembers: defineTable({
    challengeId: v.id("challenges"),
    userId: v.string(),
    /** IANA zone, refreshed on every summary sync, so deadlines follow the member. */
    timezone: v.string(),
    displayName: v.string(),
    joinedAt: v.number(),
    /** This member's own lists. The partner reads them; only the member writes them. */
    /**
     * A string is a legacy goal (rows written before goals had ids); it reads
     * as `goal-legacy-<index>` and is converted to objects on the member's
     * next edit. Removed goals stay with `archivedAt`, like don'ts.
     */
    goals: v.optional(v.array(v.union(v.string(), commitmentValidator))),
    /** Removed don'ts stay here with `archivedAt`, so old confessions still resolve. */
    donts: v.optional(v.array(dontValidator)),
    commitmentsUpdatedAt: v.optional(v.number()),
    /** The member's last lock-in or check-in (the admin list's "last activity"). */
    lastActedAt: v.optional(v.number()),
    /** The member's local date at join. Older rows derive it from `joinedAt` in `timezone`. */
    joinedDate: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_challenge", ["challengeId"])
    .index("by_user_challenge", ["userId", "challengeId"]),

  challengeInvites: defineTable({
    challengeId: v.id("challenges"),
    token: v.string(),
    createdBy: v.string(),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_challenge", ["challengeId"]),

  challengeDays: defineTable({
    challengeId: v.id("challenges"),
    userId: v.string(),
    date: v.string(),
    summary: summaryValidator,
    summaryUpdatedAt: v.number(),
    /** The two explicit daily acts. Set once; never cleared by a sync. */
    planSetAt: v.optional(v.number()),
    checkinAt: v.optional(v.number()),
    note: v.optional(v.string()),
    /** Ids from the member's own don'ts (active or archived) owned up to at check-in. */
    dontsBroken: v.array(v.string()),
    /** Ids from the member's own goals (active or archived) marked kept that day. Absent reads as `[]`. */
    goalsKept: v.optional(v.array(v.string())),
    /** Reminder bookkeeping for this local day; never shown to the partner. */
    remindersSent: remindersSentValidator,
    /** Legacy once-a-day nudge stamp: read as one entry of `nudgesSentAt`, never written again. */
    nudgeSentAt: v.optional(v.number()),
    /** Nudges sent on this (the nudger's) local day; rules in `_shared/challengeNudges.ts`. */
    nudgesSentAt: v.optional(v.array(v.number())),
  })
    .index("by_challenge_user_date", ["challengeId", "userId", "date"])
    .index("by_user_date", ["userId", "date"]),
})
