import { describe, it, expect } from "vitest"
import {
  buildHabitAdvisorPrompt,
  parseHabitAdvice,
  buildFallbackAdvice,
  buildFallbackAdviceList,
  countVerdicts,
} from "./habitAdvisor"
import type { HabitDefinition } from "./habitAdvisor"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HABITS: HabitDefinition[] = [
  { id: "habit-gym", label: "Gym" },
  { id: "habit-journal", label: "Morning journal", stackAnchor: "After coffee" },
  { id: "habit-pray", label: "Pray" },
  { id: "habit-no-phone", label: "No phone before 9am" },
]

// ── buildHabitAdvisorPrompt ───────────────────────────────────────────────────

describe("buildHabitAdvisorPrompt", () => {
  const prompt = buildHabitAdvisorPrompt(HABITS, "Tokyo, Japan", "leisure", 7)

  it("includes destination", () => {
    expect(prompt).toContain("Tokyo, Japan")
  })

  it("includes trip purpose", () => {
    expect(prompt).toContain("leisure")
  })

  it("includes duration", () => {
    expect(prompt).toContain("7")
  })

  it("includes all habit labels", () => {
    for (const h of HABITS) {
      expect(prompt).toContain(h.label)
    }
  })

  it("includes stack anchors for habits that have them", () => {
    expect(prompt).toContain("After coffee")
  })

  it("instructs Claude to return JSON only", () => {
    expect(prompt).toContain("valid JSON")
  })

  it("specifies all three verdict values", () => {
    expect(prompt).toContain("keep")
    expect(prompt).toContain("adapt")
    expect(prompt).toContain("suspend")
  })

  it("specifies required JSON shape fields", () => {
    expect(prompt).toContain("habitId")
    expect(prompt).toContain("verdict")
    expect(prompt).toContain("reason")
  })

  it("returns empty string section gracefully for zero habits", () => {
    const p = buildHabitAdvisorPrompt([], "Paris", "work", 5)
    expect(p).toContain("Paris")
  })
})

// ── parseHabitAdvice ──────────────────────────────────────────────────────────

describe("parseHabitAdvice", () => {
  const validJson = JSON.stringify([
    { habitId: "habit-gym", label: "Gym", verdict: "adapt", reason: "Use hotel gym instead" },
    { habitId: "habit-journal", label: "Morning journal", verdict: "keep", reason: "Easy to maintain" },
    { habitId: "habit-pray", label: "Pray", verdict: "keep", reason: "No equipment needed" },
    { habitId: "habit-no-phone", label: "No phone before 9am", verdict: "suspend", reason: "Need maps in the morning" },
  ])

  it("parses valid JSON correctly", () => {
    const advice = parseHabitAdvice(validJson, HABITS)
    expect(advice.length).toBe(4)
  })

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + validJson + "\n```"
    const advice = parseHabitAdvice(fenced, HABITS)
    expect(advice.length).toBe(4)
  })

  it("preserves verdict values", () => {
    const advice = parseHabitAdvice(validJson, HABITS)
    expect(advice.find((a) => a.habitId === "habit-gym")?.verdict).toBe("adapt")
    expect(advice.find((a) => a.habitId === "habit-no-phone")?.verdict).toBe("suspend")
  })

  it("fills in fallback for habits missing from AI response", () => {
    const partial = JSON.stringify([
      { habitId: "habit-gym", label: "Gym", verdict: "adapt", reason: "Use hotel gym" },
    ])
    const advice = parseHabitAdvice(partial, HABITS)
    expect(advice.length).toBe(4)
    const missing = advice.find((a) => a.habitId === "habit-journal")
    expect(missing).toBeDefined()
    expect(missing!.verdict).toBe("keep")
  })

  it("returns one result per habit, in habit order", () => {
    const advice = parseHabitAdvice(validJson, HABITS)
    for (let i = 0; i < HABITS.length; i++) {
      expect(advice[i]!.habitId).toBe(HABITS[i]!.id)
    }
  })

  it("filters out items with invalid verdict", () => {
    const json = JSON.stringify([
      { habitId: "habit-gym", label: "Gym", verdict: "maybe", reason: "Not valid" },
      { habitId: "habit-journal", label: "Morning journal", verdict: "keep", reason: "Fine" },
    ])
    const advice = parseHabitAdvice(json, HABITS)
    const gym = advice.find((a) => a.habitId === "habit-gym")
    expect(gym!.verdict).toBe("keep")
  })

  it("throws on invalid JSON", () => {
    expect(() => parseHabitAdvice("not json", HABITS)).toThrow()
  })

  it("throws on non-array JSON", () => {
    expect(() => parseHabitAdvice('{"key":"val"}', HABITS)).toThrow()
  })
})

// ── buildFallbackAdvice ───────────────────────────────────────────────────────

describe("buildFallbackAdvice", () => {
  it("preserves habitId and label", () => {
    const advice = buildFallbackAdvice(HABITS[0]!, "keep")
    expect(advice.habitId).toBe("habit-gym")
    expect(advice.label).toBe("Gym")
  })

  it("uses provided verdict", () => {
    expect(buildFallbackAdvice(HABITS[0]!, "suspend").verdict).toBe("suspend")
    expect(buildFallbackAdvice(HABITS[0]!, "adapt").verdict).toBe("adapt")
  })

  it("includes a non-empty reason", () => {
    const advice = buildFallbackAdvice(HABITS[0]!, "keep")
    expect(advice.reason.length).toBeGreaterThan(0)
  })
})

// ── buildFallbackAdviceList ───────────────────────────────────────────────────

describe("buildFallbackAdviceList", () => {
  it("returns one advice per habit", () => {
    const list = buildFallbackAdviceList(HABITS)
    expect(list.length).toBe(HABITS.length)
  })

  it("defaults all to keep", () => {
    const list = buildFallbackAdviceList(HABITS)
    expect(list.every((a) => a.verdict === "keep")).toBe(true)
  })

  it("returns empty array for empty habits", () => {
    expect(buildFallbackAdviceList([])).toEqual([])
  })
})

// ── countVerdicts ─────────────────────────────────────────────────────────────

describe("countVerdicts", () => {
  it("counts all verdicts correctly", () => {
    const advice = [
      { habitId: "a", label: "A", verdict: "keep" as const, reason: "" },
      { habitId: "b", label: "B", verdict: "keep" as const, reason: "" },
      { habitId: "c", label: "C", verdict: "adapt" as const, reason: "" },
      { habitId: "d", label: "D", verdict: "suspend" as const, reason: "" },
    ]
    const counts = countVerdicts(advice)
    expect(counts.keep).toBe(2)
    expect(counts.adapt).toBe(1)
    expect(counts.suspend).toBe(1)
  })

  it("returns zeros for empty list", () => {
    const counts = countVerdicts([])
    expect(counts.keep).toBe(0)
    expect(counts.adapt).toBe(0)
    expect(counts.suspend).toBe(0)
  })
})
