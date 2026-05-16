import { describe, it, expect } from "vitest"
import {
  DEFAULT_PREP_TASKS,
  subtractDays,
  clampDate,
  buildPreTripTasks,
  buildPreTripTasksPrompt,
  parseAITaskSpecs,
  groupTasksByDate,
} from "./preTripTasks"
import type { PreTripTaskSpec } from "./preTripTasks"

// ── DEFAULT_PREP_TASKS ───────────────────────────────────────────────────────

describe("DEFAULT_PREP_TASKS", () => {
  it("contains at least 8 tasks", () => {
    expect(DEFAULT_PREP_TASKS.length).toBeGreaterThanOrEqual(8)
  })

  it("all tasks have required fields", () => {
    for (const task of DEFAULT_PREP_TASKS) {
      expect(typeof task.title).toBe("string")
      expect(task.title.length).toBeGreaterThan(0)
      expect(typeof task.daysBefore).toBe("number")
      expect(task.daysBefore).toBeGreaterThan(0)
      expect(["mustDo", "highPriority", "mediumPriority", "lowPriority"]).toContain(task.sectionId)
    }
  })

  it("includes a packing task", () => {
    expect(DEFAULT_PREP_TASKS.some((t) => t.title.toLowerCase().includes("pack"))).toBe(true)
  })

  it("includes a task with long lead time (>= 30 days)", () => {
    expect(DEFAULT_PREP_TASKS.some((t) => t.daysBefore >= 30)).toBe(true)
  })

  it("includes a day-before task (daysBefore = 1)", () => {
    expect(DEFAULT_PREP_TASKS.some((t) => t.daysBefore === 1)).toBe(true)
  })
})

// ── subtractDays ─────────────────────────────────────────────────────────────

describe("subtractDays", () => {
  it("subtracts days correctly", () => {
    expect(subtractDays("2026-07-15", 5)).toBe("2026-07-10")
  })

  it("handles month boundary", () => {
    expect(subtractDays("2026-07-03", 5)).toBe("2026-06-28")
  })

  it("handles year boundary", () => {
    expect(subtractDays("2026-01-03", 5)).toBe("2025-12-29")
  })

  it("subtracting 0 returns same date", () => {
    expect(subtractDays("2026-07-15", 0)).toBe("2026-07-15")
  })

  it("handles large subtraction (42 days)", () => {
    expect(subtractDays("2026-09-15", 42)).toBe("2026-08-04")
  })
})

// ── clampDate ────────────────────────────────────────────────────────────────

describe("clampDate", () => {
  it("returns date when it is after minDate", () => {
    expect(clampDate("2026-07-15", "2026-07-01")).toBe("2026-07-15")
  })

  it("returns date when it equals minDate", () => {
    expect(clampDate("2026-07-15", "2026-07-15")).toBe("2026-07-15")
  })

  it("returns minDate when date is before minDate", () => {
    expect(clampDate("2026-05-01", "2026-07-01")).toBe("2026-07-01")
  })
})

// ── buildPreTripTasks ────────────────────────────────────────────────────────

describe("buildPreTripTasks", () => {
  const START = "2026-09-15"
  const TODAY = "2026-07-01"

  it("creates one task per spec", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    expect(tasks.length).toBe(DEFAULT_PREP_TASKS.length)
  })

  it("all tasks have isDone = false", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    expect(tasks.every((t) => t.isDone === false)).toBe(true)
  })

  it("all tasks have isShallow = true (prep tasks are logistical)", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    expect(tasks.every((t) => t.isShallow === true)).toBe(true)
  })

  it("task dates are before or on the trip start date", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    for (const task of tasks) {
      expect(task.date <= START).toBe(true)
    }
  })

  it("task dates are on or after minDate", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    for (const task of tasks) {
      expect(task.date >= TODAY).toBe(true)
    }
  })

  it("preserves task title and sectionId from spec", () => {
    const spec: PreTripTaskSpec = { title: "Apply for visa", sectionId: "highPriority", daysBefore: 30 }
    const tasks = buildPreTripTasks([spec], START, TODAY)
    expect(tasks[0]!.title).toBe("Apply for visa")
    expect(tasks[0]!.sectionId).toBe("highPriority")
  })

  it("calculates date correctly (30 days before 2026-09-15 = 2026-08-16)", () => {
    const spec: PreTripTaskSpec = { title: "Book hotel", sectionId: "highPriority", daysBefore: 30 }
    const tasks = buildPreTripTasks([spec], "2026-09-15", "2026-01-01")
    expect(tasks[0]!.date).toBe("2026-08-16")
  })

  it("clamps dates that fall before today to today", () => {
    const spec: PreTripTaskSpec = { title: "Old task", sectionId: "lowPriority", daysBefore: 365 }
    const tasks = buildPreTripTasks([spec], "2026-09-15", TODAY)
    expect(tasks[0]!.date).toBe(TODAY)
  })

  it("assigns unique ids to each task", () => {
    const tasks = buildPreTripTasks(DEFAULT_PREP_TASKS, START, TODAY)
    const ids = tasks.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ── buildPreTripTasksPrompt ──────────────────────────────────────────────────

describe("buildPreTripTasksPrompt", () => {
  const prompt = buildPreTripTasksPrompt("Tokyo, Japan", "leisure and culture", 7, "professional", "2026-09-15")

  it("includes destination", () => {
    expect(prompt).toContain("Tokyo, Japan")
  })

  it("includes purpose", () => {
    expect(prompt).toContain("leisure and culture")
  })

  it("includes duration", () => {
    expect(prompt).toContain("7")
  })

  it("includes life stage", () => {
    expect(prompt).toContain("professional")
  })

  it("includes start date", () => {
    expect(prompt).toContain("2026-09-15")
  })

  it("instructs Claude to return JSON only", () => {
    expect(prompt).toContain("valid JSON")
  })

  it("specifies the required JSON shape", () => {
    expect(prompt).toContain("title")
    expect(prompt).toContain("sectionId")
    expect(prompt).toContain("daysBefore")
  })

  it("lists valid sectionId values", () => {
    expect(prompt).toContain("highPriority")
    expect(prompt).toContain("mediumPriority")
    expect(prompt).toContain("lowPriority")
    expect(prompt).toContain("mustDo")
  })
})

// ── parseAITaskSpecs ─────────────────────────────────────────────────────────

describe("parseAITaskSpecs", () => {
  it("parses valid JSON array", () => {
    const json = JSON.stringify([
      { title: "Book flights", sectionId: "highPriority", daysBefore: 30 },
      { title: "Pack bag", sectionId: "mustDo", daysBefore: 1 },
    ])
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(2)
    expect(result[0]!.title).toBe("Book flights")
  })

  it("strips markdown code fences", () => {
    const json = "```json\n[{\"title\":\"Book flights\",\"sectionId\":\"highPriority\",\"daysBefore\":30}]\n```"
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(1)
  })

  it("filters out items with invalid sectionId", () => {
    const json = JSON.stringify([
      { title: "Valid task", sectionId: "highPriority", daysBefore: 10 },
      { title: "Invalid section", sectionId: "wrongSection", daysBefore: 10 },
    ])
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(1)
    expect(result[0]!.title).toBe("Valid task")
  })

  it("filters out items with daysBefore <= 0", () => {
    const json = JSON.stringify([
      { title: "Valid task", sectionId: "highPriority", daysBefore: 10 },
      { title: "Zero days", sectionId: "highPriority", daysBefore: 0 },
      { title: "Negative days", sectionId: "highPriority", daysBefore: -5 },
    ])
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(1)
  })

  it("filters out non-object items", () => {
    const json = JSON.stringify([
      { title: "Valid", sectionId: "highPriority", daysBefore: 10 },
      null,
      "string",
      42,
    ])
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(1)
  })

  it("throws for non-array JSON", () => {
    expect(() => parseAITaskSpecs('{"title":"not an array"}')).toThrow()
  })

  it("throws for invalid JSON", () => {
    expect(() => parseAITaskSpecs("not json at all")).toThrow()
  })

  it("accepts all valid sectionId values", () => {
    const json = JSON.stringify([
      { title: "A", sectionId: "mustDo", daysBefore: 1 },
      { title: "B", sectionId: "highPriority", daysBefore: 7 },
      { title: "C", sectionId: "mediumPriority", daysBefore: 14 },
      { title: "D", sectionId: "lowPriority", daysBefore: 21 },
    ])
    const result = parseAITaskSpecs(json)
    expect(result.length).toBe(4)
  })
})

// ── groupTasksByDate ─────────────────────────────────────────────────────────

describe("groupTasksByDate", () => {
  it("returns empty object for empty tasks", () => {
    expect(groupTasksByDate([])).toEqual({})
  })

  it("groups tasks by their date field", () => {
    const tasks = [
      { id: "1", title: "A", sectionId: "highPriority" as const, date: "2026-07-01", isDone: false, isShallow: true },
      { id: "2", title: "B", sectionId: "highPriority" as const, date: "2026-07-01", isDone: false, isShallow: true },
      { id: "3", title: "C", sectionId: "lowPriority" as const, date: "2026-07-10", isDone: false, isShallow: true },
    ]
    const grouped = groupTasksByDate(tasks)
    expect(Object.keys(grouped).length).toBe(2)
    expect(grouped["2026-07-01"]!.length).toBe(2)
    expect(grouped["2026-07-10"]!.length).toBe(1)
  })

  it("preserves task data within groups", () => {
    const task = { id: "1", title: "Test task", sectionId: "mustDo" as const, date: "2026-07-15", isDone: false, isShallow: true }
    const grouped = groupTasksByDate([task])
    expect(grouped["2026-07-15"]![0]!.title).toBe("Test task")
  })

  it("number of unique dates equals number of keys", () => {
    const dates = ["2026-07-01", "2026-07-05", "2026-07-10", "2026-07-15"]
    const tasks = dates.map((date, i) => ({
      id: String(i), title: `Task ${i}`, sectionId: "lowPriority" as const,
      date, isDone: false, isShallow: true,
    }))
    const grouped = groupTasksByDate(tasks)
    expect(Object.keys(grouped).length).toBe(4)
  })
})
