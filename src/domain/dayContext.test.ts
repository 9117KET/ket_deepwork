import { describe, it, expect } from "vitest"
import {
  computeTripDay,
  isTripActiveOnDate,
  computeTaskSummary,
  computeHabitSummary,
  computeExpenseSummary,
  buildDayContext,
} from "./dayContext"
import type { AppState, DayState } from "./types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DayState> = {}): DayState {
  return {
    date: "2026-07-15",
    tasks: [],
    deepWorkSessions: [],
    ...overrides,
  }
}

const EMPTY_APP_STATE: AppState = { days: {} }

const TRIP_ACTIVE = {
  _id: "trip-1",
  name: "Summer in Tokyo",
  destination: "Tokyo, Japan",
  startDate: "2026-07-14",
  endDate: "2026-07-20",
  durationDays: 7,
  budgetPreference: "moderate",
}

const TRIP_FUTURE = {
  _id: "trip-2",
  name: "Paris Next Month",
  destination: "Paris, France",
  startDate: "2026-09-01",
  endDate: "2026-09-07",
  durationDays: 7,
  budgetPreference: "comfort",
}

// ── computeTripDay ────────────────────────────────────────────────────────────

describe("computeTripDay", () => {
  it("returns 1 on the start date", () => {
    expect(computeTripDay("2026-07-14", "2026-07-14")).toBe(1)
  })

  it("returns 2 on the second day", () => {
    expect(computeTripDay("2026-07-14", "2026-07-15")).toBe(2)
  })

  it("returns 7 on the last day of a 7-day trip", () => {
    expect(computeTripDay("2026-07-14", "2026-07-20")).toBe(7)
  })

  it("returns 0 or negative for dates before trip", () => {
    expect(computeTripDay("2026-07-14", "2026-07-13")).toBeLessThan(1)
  })

  it("handles month boundary correctly", () => {
    expect(computeTripDay("2026-07-30", "2026-08-02")).toBe(4)
  })
})

// ── isTripActiveOnDate ────────────────────────────────────────────────────────

describe("isTripActiveOnDate", () => {
  it("returns true on the start date", () => {
    expect(isTripActiveOnDate("2026-07-14", "2026-07-20", "2026-07-14")).toBe(true)
  })

  it("returns true in the middle of the trip", () => {
    expect(isTripActiveOnDate("2026-07-14", "2026-07-20", "2026-07-17")).toBe(true)
  })

  it("returns true on the end date", () => {
    expect(isTripActiveOnDate("2026-07-14", "2026-07-20", "2026-07-20")).toBe(true)
  })

  it("returns false before the trip starts", () => {
    expect(isTripActiveOnDate("2026-07-14", "2026-07-20", "2026-07-13")).toBe(false)
  })

  it("returns false after the trip ends", () => {
    expect(isTripActiveOnDate("2026-07-14", "2026-07-20", "2026-07-21")).toBe(false)
  })

  it("returns false with no startDate", () => {
    expect(isTripActiveOnDate(undefined, "2026-07-20", "2026-07-17")).toBe(false)
  })

  it("returns true when no endDate and date is after start", () => {
    expect(isTripActiveOnDate("2026-07-14", undefined, "2026-08-01")).toBe(true)
  })
})

// ── computeTaskSummary ────────────────────────────────────────────────────────

describe("computeTaskSummary", () => {
  it("returns zeros for undefined dayState", () => {
    const result = computeTaskSummary(undefined)
    expect(result).toEqual({ total: 0, completed: 0, deepWork: 0, shallow: 0 })
  })

  it("counts total root tasks (excludes subtasks)", () => {
    const day = makeDay({
      tasks: [
        { id: "t1", title: "Root 1", sectionId: "highPriority", date: "2026-07-15", isDone: false },
        { id: "t2", title: "Subtask", sectionId: "highPriority", date: "2026-07-15", isDone: false, parentId: "t1" },
        { id: "t3", title: "Root 2", sectionId: "lowPriority", date: "2026-07-15", isDone: true },
      ],
    })
    const result = computeTaskSummary(day)
    expect(result.total).toBe(2)
    expect(result.completed).toBe(1)
  })

  it("counts deep work tasks (non-shallow, not done)", () => {
    const day = makeDay({
      tasks: [
        { id: "t1", title: "Deep task", sectionId: "highPriority", date: "2026-07-15", isDone: false },
        { id: "t2", title: "Shallow task", sectionId: "lowPriority", date: "2026-07-15", isDone: false, isShallow: true },
        { id: "t3", title: "Done deep task", sectionId: "highPriority", date: "2026-07-15", isDone: true },
      ],
    })
    const result = computeTaskSummary(day)
    expect(result.deepWork).toBe(1)
    expect(result.shallow).toBe(1)
  })

  it("returns zeros for day with no tasks", () => {
    const result = computeTaskSummary(makeDay({ tasks: [] }))
    expect(result.total).toBe(0)
  })
})

// ── computeHabitSummary ───────────────────────────────────────────────────────

describe("computeHabitSummary", () => {
  it("returns total from habitIds length even with no completions", () => {
    const result = computeHabitSummary(undefined, ["h1", "h2", "h3"])
    expect(result.total).toBe(3)
    expect(result.completed).toBe(0)
  })

  it("counts completed habits correctly", () => {
    const day = makeDay({ habitCompletions: { "h1": true, "h2": false, "h3": true } })
    const result = computeHabitSummary(day, ["h1", "h2", "h3"])
    expect(result.completed).toBe(2)
    expect(result.total).toBe(3)
  })

  it("returns zeros for empty habitIds", () => {
    const result = computeHabitSummary(makeDay(), [])
    expect(result.total).toBe(0)
    expect(result.completed).toBe(0)
  })

  it("preserves habitIds in result", () => {
    const result = computeHabitSummary(undefined, ["h1", "h2"])
    expect(result.habitIds).toEqual(["h1", "h2"])
  })
})

// ── computeExpenseSummary ─────────────────────────────────────────────────────

describe("computeExpenseSummary", () => {
  it("returns null when no expenses on that date", () => {
    const result = computeExpenseSummary(
      [{ date: "2026-07-14", amountBase: 50, currency: "EUR" }],
      "2026-07-15",
    )
    expect(result).toBeNull()
  })

  it("sums amountBase for expenses on the date", () => {
    const expenses = [
      { date: "2026-07-15", amountBase: 30, currency: "EUR" },
      { date: "2026-07-15", amountBase: 20, currency: "EUR" },
      { date: "2026-07-16", amountBase: 50, currency: "EUR" },
    ]
    const result = computeExpenseSummary(expenses, "2026-07-15")
    expect(result!.total).toBe(50)
    expect(result!.count).toBe(2)
  })

  it("uses currency from first matching expense", () => {
    const result = computeExpenseSummary(
      [{ date: "2026-07-15", amountBase: 1000, currency: "JPY" }],
      "2026-07-15",
    )
    expect(result!.currency).toBe("JPY")
  })

  it("returns null for empty expenses array", () => {
    expect(computeExpenseSummary([], "2026-07-15")).toBeNull()
  })

  it("falls back to amount when amountBase is missing", () => {
    const result = computeExpenseSummary(
      [{ date: "2026-07-15", amount: 25, currency: "EUR" }],
      "2026-07-15",
    )
    expect(result!.total).toBe(25)
  })
})

// ── buildDayContext ───────────────────────────────────────────────────────────

describe("buildDayContext", () => {
  const TODAY = "2026-07-15"

  it("returns empty context for empty state", () => {
    const ctx = buildDayContext(TODAY, EMPTY_APP_STATE, [], [], [])
    expect(ctx.date).toBe(TODAY)
    expect(ctx.tasks.total).toBe(0)
    expect(ctx.deepWorkMinutes).toBe(0)
    expect(ctx.activeTrip).toBeNull()
    expect(ctx.expenses).toBeNull()
  })

  it("detects active trip for the date", () => {
    const ctx = buildDayContext(TODAY, EMPTY_APP_STATE, [], [TRIP_ACTIVE], [])
    expect(ctx.activeTrip).not.toBeNull()
    expect(ctx.activeTrip!.destination).toBe("Tokyo, Japan")
    expect(ctx.activeTrip!.day).toBe(2)
    expect(ctx.activeTrip!.totalDays).toBe(7)
  })

  it("returns null for trip that hasn't started", () => {
    const ctx = buildDayContext(TODAY, EMPTY_APP_STATE, [], [TRIP_FUTURE], [])
    expect(ctx.activeTrip).toBeNull()
  })

  it("picks first active trip when multiple exist", () => {
    const ctx = buildDayContext(TODAY, EMPTY_APP_STATE, [], [TRIP_ACTIVE, TRIP_FUTURE], [])
    expect(ctx.activeTrip!.name).toBe("Summer in Tokyo")
  })

  it("computes task summary from appState", () => {
    const state: AppState = {
      days: {
        [TODAY]: makeDay({
          tasks: [
            { id: "t1", title: "Task A", sectionId: "highPriority", date: TODAY, isDone: true },
            { id: "t2", title: "Task B", sectionId: "highPriority", date: TODAY, isDone: false },
          ],
        }),
      },
    }
    const ctx = buildDayContext(TODAY, state, [], [], [])
    expect(ctx.tasks.total).toBe(2)
    expect(ctx.tasks.completed).toBe(1)
  })

  it("computes habit summary from appState", () => {
    const state: AppState = {
      days: {
        [TODAY]: makeDay({ habitCompletions: { "h1": true, "h2": false } }),
      },
    }
    const ctx = buildDayContext(TODAY, state, ["h1", "h2"], [], [])
    expect(ctx.habitCompletions.completed).toBe(1)
    expect(ctx.habitCompletions.total).toBe(2)
  })

  it("combines financial and trip expenses for the date", () => {
    const finExpenses = [{ date: TODAY, amountBase: 30, currency: "EUR" }]
    const tripWithBudget = {
      ...TRIP_ACTIVE,
      budget: {
        expenses: [{ date: TODAY, amountBase: 20, currency: "EUR" }],
      },
    }
    const ctx = buildDayContext(TODAY, EMPTY_APP_STATE, [], [tripWithBudget], finExpenses)
    expect(ctx.expenses!.total).toBe(50)
    expect(ctx.expenses!.count).toBe(2)
  })

  it("includes mood and sleep from dayState", () => {
    const state: AppState = {
      days: { [TODAY]: makeDay({ mood: "great", sleepHours: 8 }) },
    }
    const ctx = buildDayContext(TODAY, state, [], [], [])
    expect(ctx.mood).toBe("great")
    expect(ctx.sleepHours).toBe(8)
  })
})
