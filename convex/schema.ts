import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"
import {
  challengeStatusValidator,
  dontValidator,
  remindersSentValidator,
  summaryValidator,
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
    goals: v.array(v.string()),
    donts: v.array(dontValidator),
    /** Local wall-clock deadlines, applied in each member's own timezone. */
    planDeadline: v.string(),
    checkinDeadline: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    /** The one switch the reminder cron reads; "ended" once everyone has left or the end date has passed. */
    status: challengeStatusValidator,
  }).index("by_status", ["status"]),

  challengeMembers: defineTable({
    challengeId: v.id("challenges"),
    userId: v.string(),
    /** IANA zone, refreshed on every summary sync, so deadlines follow the member. */
    timezone: v.string(),
    displayName: v.string(),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_challenge", ["challengeId"]),

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
    /** Ids from `challenges.donts` the member owned up to at check-in. */
    dontsBroken: v.array(v.string()),
    /** Reminder bookkeeping for this local day; never shown to the partner. */
    remindersSent: remindersSentValidator,
    nudgeSentAt: v.optional(v.number()),
  })
    .index("by_challenge_user_date", ["challengeId", "userId", "date"])
    .index("by_user_date", ["userId", "date"]),
})
