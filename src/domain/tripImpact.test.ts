import { describe, it, expect } from "vitest"
import { getDateRange, computeTripImpact } from "./tripImpact"
import type { DayState } from "./types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(date: string, overrides: Partial<DayState> = {}): DayState {
  return { date, tasks: [], deepWorkSessions: [], ...overrides }
}

const HABIT_IDS = ["h-gym", "h-journal", "h-pray"]
const HABIT_LABELS: Record<string, string> = {
  "h-gym": "Gym",
  "h-journal": "Morning journal",
  "h-pray": "Pray",
}

// ── getDateRange ──────────────────────────────────────────────────────────────

describe("getDateRange", () => {
  it("returns just the start date for same-day range", () => {
    expect(getDateRange("2026-07-15", "2026-07-15")).toEqual(["2026-07-15"])
  })

  it("returns 7 dates for a 7-day trip", () => {
    const dates = getDateRange("2026-07-15", "2026-07-21")
    expect(dates.length).toBe(7)
  })

  it("starts with the start date", () => {
    const dates = getDateRange("2026-07-15", "2026-07-20")
    expect(dates[0]).toBe("2026-07-15")
  })

  it("ends with the end date", () => {
    const dates = getDateRange("2026-07-15", "2026-07-20")
    expect(dates[dates.length - 1]).toBe("2026-07-20")
  })

  it("handles month boundary", () => {
    const dates = getDateRange("2026-07-30", "2026-08-02")
    expect(dates).toEqual(["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"])
  })

  it("all dates are valid ISO format", () => {
    const dates = getDateRange("2026-07-15", "2026-07-20")
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

// ── computeTripImpact ─────────────────────────────────────────────────────────

describe("computeTripImpact", () => {
  const START = "2026-07-15"
  const END = "2026-07-17"

  const dayStates: Record<string, DayState> = {
    "2026-07-15": makeDay("2026-07-15", {
      habitCompletions: { "h-gym": true, "h-journal": true, "h-pray": false },
      deepWorkSessions: [{ id: "s1", label: "Writing", durationMinutes: 90, startedAt: "T", finishedAt: "T" }],
      tasks: [
        { id: "t1", title: "Task A", sectionId: "highPriority", date: "2026-07-15", isDone: true },
        { id: "t2", title: "Task B", sectionId: "lowPriority", date: "2026-07-15", isDone: false, isShallow: true },
      ],
      mood: "good",
    }),
    "2026-07-16": makeDay("2026-07-16", {
      habitCompletions: { "h-gym": true, "h-journal": false, "h-pray": true },
      deepWorkSessions: [],
      tasks: [
        { id: "t3", title: "Task C", sectionId: "highPriority", date: "2026-07-16", isDone: true },
      ],
      mood: "great",
    }),
    "2026-07-17": makeDay("2026-07-17", {
      habitCompletions: { "h-gym": false, "h-journal": true, "h-pray": true },
      deepWorkSessions: [{ id: "s2", label: "Coding", durationMinutes: 120, startedAt: "T", finishedAt: "T" }],
      tasks: [],
      mood: "good",
    }),
  }

  it("reports correct duration", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.durationDays).toBe(3)
  })

  it("reports days with data", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.daysWithData).toBe(3)
  })

  it("counts days with missing data correctly", () => {
    const partial = { "2026-07-15": dayStates["2026-07-15"]! }
    const impact = computeTripImpact(START, END, partial, HABIT_IDS, HABIT_LABELS)
    expect(impact.daysWithData).toBe(1)
  })

  it("computes total deep work minutes", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.deepWork.totalMinutes).toBe(210)
  })

  it("computes deep work hours", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.deepWork.totalHours).toBe(3.5)
  })

  it("counts days with deep work", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.deepWork.daysWithDeepWork).toBe(2)
  })

  it("counts finished deep work sessions", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.deepWork.sessionsCount).toBe(2)
  })

  it("computes total tasks created", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.tasks.totalCreated).toBe(3)
  })

  it("computes total tasks completed", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.tasks.totalCompleted).toBe(2)
  })

  it("counts shallow tasks", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.tasks.shallowCount).toBe(1)
  })

  it("computes per-habit completion days", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    const gym = impact.habits.perHabit.find((h) => h.habitId === "h-gym")
    expect(gym!.completedDays).toBe(2)
    const journal = impact.habits.perHabit.find((h) => h.habitId === "h-journal")
    expect(journal!.completedDays).toBe(2)
    const pray = impact.habits.perHabit.find((h) => h.habitId === "h-pray")
    expect(pray!.completedDays).toBe(2)
  })

  it("computes average habit completion rate (0-1)", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.habits.averageCompletionRate).toBeGreaterThan(0)
    expect(impact.habits.averageCompletionRate).toBeLessThanOrEqual(1)
  })

  it("includes per-habit labels", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    const gym = impact.habits.perHabit.find((h) => h.habitId === "h-gym")
    expect(gym!.label).toBe("Gym")
  })

  it("computes mood distribution", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.mood.distribution["good"]).toBe(2)
    expect(impact.mood.distribution["great"]).toBe(1)
  })

  it("identifies most common mood", () => {
    const impact = computeTripImpact(START, END, dayStates, HABIT_IDS, HABIT_LABELS)
    expect(impact.mood.mostCommon).toBe("good")
  })

  it("handles empty day states gracefully", () => {
    const impact = computeTripImpact(START, END, {}, HABIT_IDS, HABIT_LABELS)
    expect(impact.daysWithData).toBe(0)
    expect(impact.deepWork.totalMinutes).toBe(0)
    expect(impact.tasks.totalCreated).toBe(0)
  })

  it("handles no habits gracefully", () => {
    const impact = computeTripImpact(START, END, dayStates, [], {})
    expect(impact.habits.tracked).toBe(0)
    expect(impact.habits.averageCompletionRate).toBe(0)
  })
})
