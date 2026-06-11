import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

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
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  userSettings: defineTable({
    userId: v.string(),
    habitDefinitions: v.optional(v.array(v.any())),
    monthTitles: v.optional(v.record(v.string(), v.string())),
    activeDays: v.optional(v.array(v.string())),
    blockDurationRatios: v.optional(v.any()),
    notDoingList: v.optional(v.array(v.any())),
    identityStatement: v.optional(v.string()),
    depthPhilosophy: v.optional(v.string()),
    deepWorkGoalHours: v.optional(v.number()),
    oneThingData: v.optional(v.any()),
    weeklyProjectRotation: v.optional(v.array(v.any())),
    sideQuestDefs: v.optional(v.array(v.any())),
    sideQuestXp: v.optional(v.number()),
    sideQuestStreak: v.optional(v.number()),
    sideQuestLastStreakDate: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

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
  })
    .index("by_user", ["userId"]),

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
})
