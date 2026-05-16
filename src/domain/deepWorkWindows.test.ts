import { describe, it, expect } from "vitest"
import {
  parseTimeToMinutes,
  minutesToTime,
  detectTransportLegs,
  detectFreeMorning,
  detectFreeDay,
  findDeepWorkWindows,
  buildDeepWorkActivity,
} from "./deepWorkWindows"
import type { DayPlan } from "./deepWorkWindows"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    day: 1,
    theme: "Arrival",
    activities: [],
    ...overrides,
  }
}

const FLIGHT_DAY: DayPlan = {
  day: 1,
  theme: "Travel day",
  activities: [
    { time: "06:00", name: "Airport transfer", type: "transport", durationMinutes: 60 },
    { time: "08:00", name: "Flight Berlin to Tokyo", type: "transport", durationMinutes: 720 },
    { time: "22:00", name: "Hotel check-in", type: "logistics", durationMinutes: 30 },
  ],
}

const SIGHTSEEING_DAY: DayPlan = {
  day: 2,
  theme: "Culture",
  activities: [
    { time: "09:00", name: "Senso-ji Temple", type: "sightseeing", durationMinutes: 120 },
    { time: "13:00", name: "Lunch", type: "food", durationMinutes: 60 },
    { time: "15:00", name: "Akihabara", type: "leisure", durationMinutes: 180 },
  ],
}

const LATE_START_DAY: DayPlan = {
  day: 3,
  theme: "Shopping",
  activities: [
    { time: "11:00", name: "Harajuku", type: "sightseeing", durationMinutes: 120 },
    { time: "15:00", name: "Dinner prep", type: "food", durationMinutes: 90 },
  ],
}

const EARLY_START_DAY: DayPlan = {
  day: 4,
  theme: "Full day tour",
  activities: [
    { time: "07:30", name: "Guided tour", type: "sightseeing", durationMinutes: 480 },
  ],
}

const REST_DAY: DayPlan = {
  day: 5,
  theme: "Rest and relaxation",
  activities: [
    { time: "12:00", name: "Brunch", type: "food", durationMinutes: 60 },
  ],
}

const FREE_DAY: DayPlan = {
  day: 6,
  theme: "Free day",
  activities: [],
}

// ── parseTimeToMinutes ────────────────────────────────────────────────────────

describe("parseTimeToMinutes", () => {
  it("parses midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0)
  })

  it("parses noon", () => {
    expect(parseTimeToMinutes("12:00")).toBe(720)
  })

  it("parses time with minutes", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570)
  })

  it("parses end of day", () => {
    expect(parseTimeToMinutes("23:59")).toBe(1439)
  })

  it("handles missing minutes gracefully", () => {
    expect(parseTimeToMinutes("09")).toBe(540)
  })

  it("returns 0 for invalid format", () => {
    expect(parseTimeToMinutes("invalid")).toBe(0)
  })
})

// ── minutesToTime ─────────────────────────────────────────────────────────────

describe("minutesToTime", () => {
  it("converts 0 to 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00")
  })

  it("converts 720 to 12:00", () => {
    expect(minutesToTime(720)).toBe("12:00")
  })

  it("pads single-digit hours and minutes", () => {
    expect(minutesToTime(65)).toBe("01:05")
  })

  it("handles 23:59", () => {
    expect(minutesToTime(1439)).toBe("23:59")
  })

  it("wraps around at 24h", () => {
    expect(minutesToTime(1440)).toBe("00:00")
  })
})

// ── detectTransportLegs ───────────────────────────────────────────────────────

describe("detectTransportLegs", () => {
  it("detects a long flight as a transport leg window", () => {
    const windows = detectTransportLegs(FLIGHT_DAY)
    expect(windows.length).toBe(1)
    expect(windows[0]!.kind).toBe("transport_leg")
    expect(windows[0]!.day).toBe(1)
  })

  it("ignores short transport activities (<3h)", () => {
    const day = makeDay({
      activities: [{ time: "08:00", name: "Bus to station", type: "transport", durationMinutes: 30 }],
    })
    expect(detectTransportLegs(day)).toHaveLength(0)
  })

  it("detects exactly 3h transport as a window", () => {
    const day = makeDay({
      activities: [{ time: "08:00", name: "Train ride", type: "transport", durationMinutes: 180 }],
    })
    expect(detectTransportLegs(day)).toHaveLength(1)
  })

  it("returns estimated minutes at 70% of activity duration", () => {
    const day = makeDay({
      activities: [{ time: "08:00", name: "Long train", type: "transport", durationMinutes: 300 }],
    })
    const windows = detectTransportLegs(day)
    expect(windows[0]!.estimatedMinutes).toBe(210)
  })

  it("detects by activity name containing transport keyword", () => {
    const day = makeDay({
      activities: [{ time: "08:00", name: "Flight to Paris", type: "leisure", durationMinutes: 240 }],
    })
    expect(detectTransportLegs(day)).toHaveLength(1)
  })

  it("returns empty array for day with no transport", () => {
    expect(detectTransportLegs(SIGHTSEEING_DAY)).toHaveLength(0)
  })

  it("stores correct activityIndex", () => {
    const windows = detectTransportLegs(FLIGHT_DAY)
    expect(windows[0]!.activityIndex).toBe(1)
  })
})

// ── detectFreeMorning ─────────────────────────────────────────────────────────

describe("detectFreeMorning", () => {
  it("detects late-starting day as free morning", () => {
    const window = detectFreeMorning(LATE_START_DAY)
    expect(window).not.toBeNull()
    expect(window!.kind).toBe("free_morning")
    expect(window!.day).toBe(3)
  })

  it("returns null for early-starting day", () => {
    expect(detectFreeMorning(EARLY_START_DAY)).toBeNull()
  })

  it("detects free morning for day starting exactly at 10:00 (3h window)", () => {
    const day = makeDay({
      activities: [{ time: "10:00", name: "Tour", type: "sightseeing", durationMinutes: 120 }],
    })
    expect(detectFreeMorning(day)).not.toBeNull()
  })

  it("returns null for day starting at 09:00 (under 2h free)", () => {
    const day = makeDay({
      activities: [{ time: "09:00", name: "Early tour", type: "sightseeing", durationMinutes: 120 }],
    })
    expect(detectFreeMorning(day)).toBeNull()
  })

  it("returns null for empty activities", () => {
    expect(detectFreeMorning(makeDay({ activities: [] }))).toBeNull()
  })

  it("caps estimated minutes at 180", () => {
    const day = makeDay({
      activities: [{ time: "23:00", name: "Late dinner", type: "food", durationMinutes: 90 }],
    })
    const window = detectFreeMorning(day)
    expect(window!.estimatedMinutes).toBeLessThanOrEqual(180)
  })

  it("uses earliest activity when multiple exist", () => {
    const day = makeDay({
      activities: [
        { time: "14:00", name: "Afternoon visit", type: "sightseeing", durationMinutes: 120 },
        { time: "11:00", name: "Late brunch", type: "food", durationMinutes: 60 },
      ],
    })
    const window = detectFreeMorning(day)
    expect(window).not.toBeNull()
    expect(window!.reason).toContain("11:00")
  })
})

// ── detectFreeDay ────────────────────────────────────────────────────────────

describe("detectFreeDay", () => {
  it("detects rest theme as free day", () => {
    const window = detectFreeDay(REST_DAY)
    expect(window).not.toBeNull()
    expect(window!.kind).toBe("free_day")
  })

  it("detects free day theme", () => {
    expect(detectFreeDay(FREE_DAY)).not.toBeNull()
  })

  it("detects day with only logistics activities as free day", () => {
    const day = makeDay({
      theme: "Check out",
      activities: [{ time: "10:00", name: "Check out hotel", type: "logistics", durationMinutes: 30 }],
    })
    expect(detectFreeDay(day)).not.toBeNull()
  })

  it("returns null for normal sightseeing day", () => {
    expect(detectFreeDay(SIGHTSEEING_DAY)).toBeNull()
  })

  it("returns null for day with multiple activities including sightseeing", () => {
    expect(detectFreeDay(LATE_START_DAY)).toBeNull()
  })

  it("detects relaxation keyword in theme", () => {
    const day = makeDay({ theme: "Relaxation by the beach", activities: [] })
    expect(detectFreeDay(day)).not.toBeNull()
  })
})

// ── findDeepWorkWindows ───────────────────────────────────────────────────────

describe("findDeepWorkWindows", () => {
  it("returns empty array for empty plan", () => {
    expect(findDeepWorkWindows([])).toEqual([])
  })

  it("returns empty array for normal busy days", () => {
    expect(findDeepWorkWindows([SIGHTSEEING_DAY, EARLY_START_DAY])).toHaveLength(0)
  })

  it("detects all window types across multiple days", () => {
    const windows = findDeepWorkWindows([FLIGHT_DAY, LATE_START_DAY, REST_DAY])
    const kinds = windows.map((w) => w.kind)
    expect(kinds).toContain("transport_leg")
    expect(kinds).toContain("free_morning")
    expect(kinds).toContain("free_day")
  })

  it("can return multiple windows for the same day", () => {
    const windows = findDeepWorkWindows([FLIGHT_DAY, LATE_START_DAY])
    const flightDayWindows = windows.filter((w) => w.day === 1)
    expect(flightDayWindows.length).toBeGreaterThanOrEqual(1)
  })

  it("each window has correct day reference", () => {
    const windows = findDeepWorkWindows([REST_DAY])
    expect(windows.every((w) => w.day === REST_DAY.day)).toBe(true)
  })
})

// ── buildDeepWorkActivity ─────────────────────────────────────────────────────

describe("buildDeepWorkActivity", () => {
  const window = findDeepWorkWindows([FLIGHT_DAY])[0]!

  it("creates activity with type deep_work", () => {
    const act = buildDeepWorkActivity(window)
    expect(act.type).toBe("deep_work")
  })

  it("uses provided label", () => {
    const act = buildDeepWorkActivity(window, "Writing session")
    expect(act.name).toBe("Writing session")
  })

  it("defaults label to 'Deep work block'", () => {
    const act = buildDeepWorkActivity(window)
    expect(act.name).toBe("Deep work block")
  })

  it("matches estimated minutes from window", () => {
    const act = buildDeepWorkActivity(window)
    expect(act.durationMinutes).toBe(window.estimatedMinutes)
  })

  it("sets morning start time for free_morning windows", () => {
    const morning = detectFreeMorning(LATE_START_DAY)!
    const act = buildDeepWorkActivity(morning)
    expect(act.time).toBe("07:00")
  })

  it("uses window reason as notes", () => {
    const act = buildDeepWorkActivity(window)
    expect(act.notes).toBe(window.reason)
  })
})
