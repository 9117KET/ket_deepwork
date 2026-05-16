import { describe, it, expect } from "vitest"
import {
  getDayColor,
  isValidCoordinate,
  buildMapPinsFromDailyPlan,
  buildMapPinsFromPlaces,
  buildDayPolylines,
  computeBounds,
  buildNominatimUrl,
  parseNominatimResults,
  getPinLabel,
} from "./travelMap"
import type { DayPlanWithCoords, MapPin, PlaceWithCoords } from "./travelMap"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePin(overrides: Partial<MapPin> = {}): MapPin {
  return {
    id: "pin-1",
    name: "Test Place",
    lat: 35.6762,
    lon: 139.6503,
    day: 1,
    activityIndex: 0,
    type: "sightseeing",
    ...overrides,
  }
}

const DAY1_PLAN: DayPlanWithCoords = {
  day: 1,
  theme: "Arrival",
  activities: [
    { time: "10:00", name: "Shinjuku Station", type: "transport", durationMinutes: 30, lat: 35.6905, lon: 139.7007 },
    { time: "14:00", name: "Shinjuku Gyoen", type: "sightseeing", durationMinutes: 120, lat: 35.6851, lon: 139.7100 },
    { time: "19:00", name: "Omoide Yokocho", type: "food", durationMinutes: 90, lat: 35.6937, lon: 139.6987 },
  ],
}

const DAY2_PLAN: DayPlanWithCoords = {
  day: 2,
  theme: "Culture",
  activities: [
    { time: "09:00", name: "Senso-ji Temple", type: "sightseeing", durationMinutes: 120, lat: 35.7148, lon: 139.7967 },
    { time: "13:00", name: "Akihabara", type: "leisure", durationMinutes: 180, lat: 35.7022, lon: 139.7741 },
  ],
}

const DAY_WITH_MISSING_COORDS: DayPlanWithCoords = {
  day: 3,
  theme: "Shopping",
  activities: [
    { time: "10:00", name: "Named place no coords", type: "sightseeing", durationMinutes: 60 },
    { time: "14:00", name: "Harajuku", type: "leisure", durationMinutes: 120, lat: 35.6699, lon: 139.7024 },
  ],
}

// ── getDayColor ───────────────────────────────────────────────────────────────

describe("getDayColor", () => {
  it("returns a hex color string for day 1", () => {
    const color = getDayColor(1)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("returns different colors for different days", () => {
    const day1 = getDayColor(1)
    const day2 = getDayColor(2)
    const day3 = getDayColor(3)
    expect(day1).not.toBe(day2)
    expect(day2).not.toBe(day3)
  })

  it("wraps around after 10 days", () => {
    expect(getDayColor(1)).toBe(getDayColor(11))
    expect(getDayColor(2)).toBe(getDayColor(12))
  })

  it("handles day 0 without throwing", () => {
    expect(() => getDayColor(0)).not.toThrow()
  })
})

// ── isValidCoordinate ────────────────────────────────────────────────────────

describe("isValidCoordinate", () => {
  it("accepts valid lat/lon", () => {
    expect(isValidCoordinate(35.6762, 139.6503)).toBe(true)
    expect(isValidCoordinate(0, 0)).toBe(true)
    expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true)
  })

  it("rejects lat out of range", () => {
    expect(isValidCoordinate(91, 0)).toBe(false)
    expect(isValidCoordinate(-91, 0)).toBe(false)
  })

  it("rejects lon out of range", () => {
    expect(isValidCoordinate(0, 181)).toBe(false)
    expect(isValidCoordinate(0, -181)).toBe(false)
  })

  it("accepts boundary values", () => {
    expect(isValidCoordinate(90, 180)).toBe(true)
    expect(isValidCoordinate(-90, -180)).toBe(true)
  })

  it("rejects non-number types", () => {
    expect(isValidCoordinate("35.6", 139.6)).toBe(false)
    expect(isValidCoordinate(35.6, "139.6")).toBe(false)
    expect(isValidCoordinate(null, 0)).toBe(false)
    expect(isValidCoordinate(undefined, 0)).toBe(false)
  })

  it("rejects NaN", () => {
    expect(isValidCoordinate(NaN, 0)).toBe(false)
    expect(isValidCoordinate(0, NaN)).toBe(false)
  })
})

// ── buildMapPinsFromDailyPlan ─────────────────────────────────────────────────

describe("buildMapPinsFromDailyPlan", () => {
  it("returns empty array for empty dailyPlan", () => {
    expect(buildMapPinsFromDailyPlan([])).toEqual([])
  })

  it("builds one pin per activity with valid coordinates", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN])
    expect(pins.length).toBe(3)
  })

  it("skips activities without coordinates", () => {
    const pins = buildMapPinsFromDailyPlan([DAY_WITH_MISSING_COORDS])
    expect(pins.length).toBe(1)
    expect(pins[0]!.name).toBe("Harajuku")
  })

  it("assigns correct day number to pins", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN, DAY2_PLAN])
    const day1Pins = pins.filter((p) => p.day === 1)
    const day2Pins = pins.filter((p) => p.day === 2)
    expect(day1Pins.length).toBe(3)
    expect(day2Pins.length).toBe(2)
  })

  it("preserves activity coordinates correctly", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN])
    expect(pins[0]!.lat).toBeCloseTo(35.6905)
    expect(pins[0]!.lon).toBeCloseTo(139.7007)
  })

  it("preserves activity name and type", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN])
    expect(pins[0]!.name).toBe("Shinjuku Station")
    expect(pins[0]!.type).toBe("transport")
  })

  it("assigns sequential activityIndex within each day", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN])
    expect(pins[0]!.activityIndex).toBe(0)
    expect(pins[1]!.activityIndex).toBe(1)
    expect(pins[2]!.activityIndex).toBe(2)
  })

  it("generates unique ids using day and activity index", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN, DAY2_PLAN])
    const ids = pins.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ── buildMapPinsFromPlaces ────────────────────────────────────────────────────

describe("buildMapPinsFromPlaces", () => {
  const places: PlaceWithCoords[] = [
    { name: "Tokyo Tower", lat: 35.6586, lon: 139.7454, description: "Iconic tower" },
    { name: "Unknown place" },
    { name: "Shibuya Crossing", lat: 35.6595, lon: 139.7004 },
  ]

  it("filters out places without coordinates", () => {
    const pins = buildMapPinsFromPlaces(places)
    expect(pins.length).toBe(2)
  })

  it("preserves name and description", () => {
    const pins = buildMapPinsFromPlaces(places)
    expect(pins[0]!.name).toBe("Tokyo Tower")
    expect(pins[0]!.notes).toBe("Iconic tower")
  })

  it("uses startDayNumber parameter", () => {
    const pins = buildMapPinsFromPlaces(places, 3)
    expect(pins.every((p) => p.day === 3)).toBe(true)
  })

  it("defaults to day 1 when no startDayNumber given", () => {
    const pins = buildMapPinsFromPlaces(places)
    expect(pins.every((p) => p.day === 1)).toBe(true)
  })

  it("returns empty array for empty input", () => {
    expect(buildMapPinsFromPlaces([])).toEqual([])
  })
})

// ── buildDayPolylines ────────────────────────────────────────────────────────

describe("buildDayPolylines", () => {
  it("returns empty array for no pins", () => {
    expect(buildDayPolylines([])).toEqual([])
  })

  it("creates one polyline per unique day", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN, DAY2_PLAN])
    const polylines = buildDayPolylines(pins)
    expect(polylines.length).toBe(2)
  })

  it("each polyline has coords matching pin count for that day", () => {
    const pins = buildMapPinsFromDailyPlan([DAY1_PLAN, DAY2_PLAN])
    const polylines = buildDayPolylines(pins)
    const day1Line = polylines.find((p) => p.day === 1)
    const day2Line = polylines.find((p) => p.day === 2)
    expect(day1Line!.coords.length).toBe(3)
    expect(day2Line!.coords.length).toBe(2)
  })

  it("each coord is a [lat, lon] tuple", () => {
    const pins = [makePin({ lat: 35.6762, lon: 139.6503 })]
    const polylines = buildDayPolylines(pins)
    const coord = polylines[0]!.coords[0]!
    expect(coord[0]).toBeCloseTo(35.6762)
    expect(coord[1]).toBeCloseTo(139.6503)
  })

  it("assigns the correct color for each day", () => {
    const pins = [makePin({ day: 1 }), makePin({ id: "pin-2", day: 2 })]
    const polylines = buildDayPolylines(pins)
    const day1 = polylines.find((p) => p.day === 1)!
    const day2 = polylines.find((p) => p.day === 2)!
    expect(day1.color).toBe(getDayColor(1))
    expect(day2.color).toBe(getDayColor(2))
    expect(day1.color).not.toBe(day2.color)
  })
})

// ── computeBounds ────────────────────────────────────────────────────────────

describe("computeBounds", () => {
  it("returns null for empty pins", () => {
    expect(computeBounds([])).toBeNull()
  })

  it("returns same lat/lon for single pin", () => {
    const pin = makePin({ lat: 35.6762, lon: 139.6503 })
    const bounds = computeBounds([pin])
    expect(bounds!.minLat).toBeCloseTo(35.6762)
    expect(bounds!.maxLat).toBeCloseTo(35.6762)
    expect(bounds!.minLon).toBeCloseTo(139.6503)
    expect(bounds!.maxLon).toBeCloseTo(139.6503)
  })

  it("computes correct min/max for multiple pins", () => {
    const pins = [
      makePin({ id: "a", lat: 35.6762, lon: 139.6503 }),
      makePin({ id: "b", lat: 35.7148, lon: 139.7967 }),
      makePin({ id: "c", lat: 35.6586, lon: 139.7454 }),
    ]
    const bounds = computeBounds(pins)
    expect(bounds!.minLat).toBeCloseTo(35.6586)
    expect(bounds!.maxLat).toBeCloseTo(35.7148)
    expect(bounds!.minLon).toBeCloseTo(139.6503)
    expect(bounds!.maxLon).toBeCloseTo(139.7967)
  })
})

// ── buildNominatimUrl ────────────────────────────────────────────────────────

describe("buildNominatimUrl", () => {
  it("includes the query encoded in the URL", () => {
    const url = buildNominatimUrl("Shinjuku Station")
    expect(url).toContain("Shinjuku")
    expect(url).toContain("format=json")
  })

  it("URL-encodes spaces and special characters", () => {
    const url = buildNominatimUrl("Café de Flore, Paris")
    expect(url).not.toContain(" ")
  })

  it("appends countryHint when provided", () => {
    const url = buildNominatimUrl("Shinjuku", "Japan")
    expect(url).toContain("Japan")
  })

  it("points to the Nominatim API", () => {
    const url = buildNominatimUrl("Tokyo Tower")
    expect(url).toContain("nominatim.openstreetmap.org")
  })

  it("requests JSON format", () => {
    const url = buildNominatimUrl("Tokyo Tower")
    expect(url).toContain("format=json")
  })
})

// ── parseNominatimResults ────────────────────────────────────────────────────

describe("parseNominatimResults", () => {
  const mockData = [
    { lat: "35.6762", lon: "139.6503", display_name: "Tokyo, Japan", place_id: 1001 },
    { lat: "35.7148", lon: "139.7967", display_name: "Asakusa, Tokyo, Japan", place_id: 1002 },
  ]

  it("parses valid Nominatim response", () => {
    const results = parseNominatimResults(mockData)
    expect(results.length).toBe(2)
  })

  it("converts lat/lon strings to numbers", () => {
    const results = parseNominatimResults(mockData)
    expect(typeof results[0]!.lat).toBe("number")
    expect(typeof results[0]!.lon).toBe("number")
    expect(results[0]!.lat).toBeCloseTo(35.6762)
  })

  it("preserves display_name as label", () => {
    const results = parseNominatimResults(mockData)
    expect(results[0]!.label).toBe("Tokyo, Japan")
  })

  it("returns empty array for non-array input", () => {
    expect(parseNominatimResults(null)).toEqual([])
    expect(parseNominatimResults({})).toEqual([])
    expect(parseNominatimResults("string")).toEqual([])
  })

  it("filters out items with missing lat/lon", () => {
    const data = [
      { lat: "35.6762", lon: "139.6503", display_name: "Valid", place_id: 1 },
      { display_name: "No coords", place_id: 2 },
    ]
    const results = parseNominatimResults(data)
    expect(results.length).toBe(1)
  })

  it("filters out results with out-of-range coordinates", () => {
    const data = [
      { lat: "999", lon: "139.6503", display_name: "Bad lat", place_id: 1 },
      { lat: "35.6762", lon: "139.6503", display_name: "Good", place_id: 2 },
    ]
    const results = parseNominatimResults(data)
    expect(results.length).toBe(1)
    expect(results[0]!.label).toBe("Good")
  })

  it("returns empty array for empty array input", () => {
    expect(parseNominatimResults([])).toEqual([])
  })
})

// ── getPinLabel ───────────────────────────────────────────────────────────────

describe("getPinLabel", () => {
  const pins: MapPin[] = [
    makePin({ id: "d1-a0", day: 1, activityIndex: 0 }),
    makePin({ id: "d1-a1", day: 1, activityIndex: 1 }),
    makePin({ id: "d1-a2", day: 1, activityIndex: 2 }),
    makePin({ id: "d2-a0", day: 2, activityIndex: 0 }),
    makePin({ id: "d2-a1", day: 2, activityIndex: 1 }),
  ]

  it("first pin in day gets label 1", () => {
    expect(getPinLabel(pins, pins[0]!)).toBe(1)
    expect(getPinLabel(pins, pins[3]!)).toBe(1)
  })

  it("second pin in day gets label 2", () => {
    expect(getPinLabel(pins, pins[1]!)).toBe(2)
    expect(getPinLabel(pins, pins[4]!)).toBe(2)
  })

  it("third pin in day gets label 3", () => {
    expect(getPinLabel(pins, pins[2]!)).toBe(3)
  })

  it("resets counter per day", () => {
    const day1Label1 = getPinLabel(pins, pins[0]!)
    const day2Label1 = getPinLabel(pins, pins[3]!)
    expect(day1Label1).toBe(day2Label1)
  })
})
