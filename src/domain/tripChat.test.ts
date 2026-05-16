import { describe, it, expect } from "vitest"
import {
  buildTripSystemPrompt,
  buildApiMessages,
  trimResponse,
  computeCurrentDay,
  getSuggestedPrompts,
} from "./tripChat"
import type { TripContext, DayPlan } from "./tripChat"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TRIP: TripContext = {
  name: "Summer in Japan",
  destination: "Tokyo, Japan",
  purpose: "leisure and culture",
  durationDays: 7,
  startDate: "2026-07-15",
  budgetPreference: "moderate",
}

const DAILY_PLAN: DayPlan[] = [
  {
    day: 1,
    theme: "Arrival",
    activities: [
      { time: "14:00", name: "Hotel check-in", type: "logistics", durationMinutes: 30 },
      { time: "18:00", name: "Shinjuku exploration", type: "sightseeing", durationMinutes: 120 },
    ],
  },
  {
    day: 2,
    theme: "Culture",
    activities: [
      { time: "09:00", name: "Senso-ji Temple", type: "sightseeing", durationMinutes: 120 },
    ],
  },
]

// ── buildTripSystemPrompt ────────────────────────────────────────────────────

describe("buildTripSystemPrompt", () => {
  const today = "2026-07-16"
  const prompt = buildTripSystemPrompt(TRIP, DAILY_PLAN, today)

  it("includes trip name", () => {
    expect(prompt).toContain("Summer in Japan")
  })

  it("includes destination", () => {
    expect(prompt).toContain("Tokyo, Japan")
  })

  it("includes purpose", () => {
    expect(prompt).toContain("leisure and culture")
  })

  it("includes budget preference", () => {
    expect(prompt).toContain("moderate")
  })

  it("includes start date", () => {
    expect(prompt).toContain("2026-07-15")
  })

  it("includes itinerary summary", () => {
    expect(prompt).toContain("Senso-ji Temple")
    expect(prompt).toContain("Hotel check-in")
  })

  it("includes day themes", () => {
    expect(prompt).toContain("Arrival")
    expect(prompt).toContain("Culture")
  })

  it("includes current day indicator", () => {
    expect(prompt).toContain("Day 2")
    expect(prompt).toContain(today)
  })

  it("handles no itinerary gracefully", () => {
    const p = buildTripSystemPrompt(TRIP, [], today)
    expect(p).toContain("No detailed itinerary available")
  })

  it("handles no start date without crashing", () => {
    const tripNoDate = { ...TRIP, startDate: undefined }
    expect(() => buildTripSystemPrompt(tripNoDate, [], today)).not.toThrow()
  })

  it("does not include current day note when outside trip dates", () => {
    const p = buildTripSystemPrompt(TRIP, [], "2026-01-01")
    expect(p).not.toContain("CURRENT DAY")
  })
})

// ── buildApiMessages ─────────────────────────────────────────────────────────

describe("buildApiMessages", () => {
  it("appends user message to history", () => {
    const history = [
      { role: "user" as const, content: "First message" },
      { role: "assistant" as const, content: "First reply" },
    ]
    const messages = buildApiMessages(history, "Second message")
    expect(messages.length).toBe(3)
    expect(messages[2]!.role).toBe("user")
    expect(messages[2]!.content).toBe("Second message")
  })

  it("works with empty history", () => {
    const messages = buildApiMessages([], "Hello")
    expect(messages.length).toBe(1)
    expect(messages[0]!.content).toBe("Hello")
  })

  it("does not mutate original history", () => {
    const history = [{ role: "user" as const, content: "Old" }]
    buildApiMessages(history, "New")
    expect(history.length).toBe(1)
  })
})

// ── trimResponse ─────────────────────────────────────────────────────────────

describe("trimResponse", () => {
  it("returns text unchanged if under word limit", () => {
    const short = "Hello world, this is a short reply."
    expect(trimResponse(short, 200)).toBe(short)
  })

  it("trims text exceeding word limit", () => {
    const words = Array(250).fill("word")
    const long = words.join(" ")
    const trimmed = trimResponse(long, 200)
    expect(trimmed.split(/\s+/).length).toBeLessThanOrEqual(201)
    expect(trimmed.endsWith("…")).toBe(true)
  })

  it("trims leading and trailing whitespace", () => {
    expect(trimResponse("  hello  ", 200)).toBe("hello")
  })

  it("handles empty string", () => {
    expect(trimResponse("", 200)).toBe("")
  })
})

// ── computeCurrentDay ────────────────────────────────────────────────────────

describe("computeCurrentDay", () => {
  it("returns 1 on the start date", () => {
    expect(computeCurrentDay("2026-07-15", "2026-07-15")).toBe(1)
  })

  it("returns 2 on the second day", () => {
    expect(computeCurrentDay("2026-07-15", "2026-07-16")).toBe(2)
  })

  it("returns 7 on the last day of a 7-day trip", () => {
    expect(computeCurrentDay("2026-07-15", "2026-07-21")).toBe(7)
  })

  it("returns 0 or negative before trip starts", () => {
    expect(computeCurrentDay("2026-07-15", "2026-07-14")).toBeLessThan(1)
  })

  it("handles month boundary", () => {
    expect(computeCurrentDay("2026-07-30", "2026-08-02")).toBe(4)
  })
})

// ── getSuggestedPrompts ───────────────────────────────────────────────────────

describe("getSuggestedPrompts", () => {
  it("returns 4 prompts", () => {
    expect(getSuggestedPrompts("Tokyo, Japan", null).length).toBe(4)
  })

  it("includes destination city in prompts", () => {
    const prompts = getSuggestedPrompts("Tokyo, Japan", null)
    expect(prompts.some((p) => p.includes("Tokyo"))).toBe(true)
  })

  it("includes current day prompt when currentDay provided", () => {
    const prompts = getSuggestedPrompts("Tokyo, Japan", 3)
    expect(prompts.some((p) => p.includes("Day 3"))).toBe(true)
  })

  it("does not include day prompt when currentDay is null", () => {
    const prompts = getSuggestedPrompts("Tokyo, Japan", null)
    expect(prompts.some((p) => p.includes("Day"))).toBe(false)
  })

  it("uses city part only from 'City, Country' format", () => {
    const prompts = getSuggestedPrompts("Paris, France", null)
    expect(prompts.some((p) => p.includes("Paris"))).toBe(true)
  })
})
