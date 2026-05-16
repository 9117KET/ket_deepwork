import { describe, it, expect } from "vitest"
import {
  inferPackingCategory,
  buildPackingItems,
  buildWeatherBlock,
  buildCountryBlock,
  buildClaudePrompt,
  formatDayDate,
  buildEmptyDays,
  deriveTripStatus,
} from "./travelPlanLogic"
import type { CountryInfo, WeatherData, TravelInput } from "./travelPlanLogic"

// ── Fixtures ─────────────────────────────────────────────────────────────────

const COUNTRY_JP: CountryInfo = {
  countryName: "Japan",
  capital: "Tokyo",
  currency: "Japanese Yen (JPY, ¥)",
  languages: ["Japanese"],
  timezone: "Asia/Tokyo",
  flagEmoji: "🇯🇵",
}

const WEATHER_MILD: WeatherData = {
  maxTemps: [22, 23, 21, 24, 25, 22, 23],
  minTemps: [15, 14, 16, 15, 16, 14, 15],
  precipProbabilities: [10, 20, 15, 5, 0, 30, 25],
}

const WEATHER_HOT: WeatherData = {
  maxTemps: [35, 36, 34, 37, 35, 36, 35],
  minTemps: [27, 28, 26, 28, 27, 28, 27],
  precipProbabilities: [80, 90, 70, 85, 75, 60, 80],
}

const BASE_INPUT: TravelInput = {
  origin: "Berlin, Germany",
  destination: "Tokyo, Japan",
  purpose: "leisure and culture",
  durationDays: 7,
  lifeStage: "professional",
  budgetPreference: "moderate",
  accommodationPreference: "affordable",
}

// ── inferPackingCategory ─────────────────────────────────────────────────────

describe("inferPackingCategory", () => {
  it("classifies document items", () => {
    expect(inferPackingCategory("Passport")).toBe("Documents")
    expect(inferPackingCategory("Travel insurance")).toBe("Documents")
    expect(inferPackingCategory("Flight ticket")).toBe("Documents")
    expect(inferPackingCategory("Hotel booking confirmation")).toBe("Documents")
    expect(inferPackingCategory("Visa documents")).toBe("Documents")
    expect(inferPackingCategory("ID card")).toBe("Documents")
  })

  it("classifies electronics items", () => {
    expect(inferPackingCategory("Phone charger")).toBe("Electronics")
    expect(inferPackingCategory("Laptop")).toBe("Electronics")
    expect(inferPackingCategory("USB cable")).toBe("Electronics")
    expect(inferPackingCategory("Power bank")).toBe("Electronics")
    expect(inferPackingCategory("Travel adaptor")).toBe("Electronics")
    expect(inferPackingCategory("Earphones")).toBe("Electronics")
    expect(inferPackingCategory("Camera")).toBe("Electronics")
  })

  it("classifies clothing items", () => {
    expect(inferPackingCategory("T-shirt")).toBe("Clothing")
    expect(inferPackingCategory("Comfortable walking shoes")).toBe("Clothing")
    expect(inferPackingCategory("Light jacket")).toBe("Clothing")
    expect(inferPackingCategory("Underwear x5")).toBe("Clothing")
    expect(inferPackingCategory("Warm sweater")).toBe("Clothing")
    expect(inferPackingCategory("Swimsuit")).toBe("Clothing")
  })

  it("classifies toiletries items", () => {
    expect(inferPackingCategory("Toothbrush")).toBe("Toiletries")
    expect(inferPackingCategory("Sunscreen SPF50")).toBe("Toiletries")
    expect(inferPackingCategory("Shampoo")).toBe("Toiletries")
    expect(inferPackingCategory("Deodorant")).toBe("Toiletries")
    expect(inferPackingCategory("Prescription medication")).toBe("Toiletries")
    expect(inferPackingCategory("First aid kit")).toBe("Toiletries")
  })

  it("classifies gear items", () => {
    expect(inferPackingCategory("Reusable water bottle")).toBe("Gear")
    expect(inferPackingCategory("Day backpack")).toBe("Gear")
    expect(inferPackingCategory("Travel umbrella")).toBe("Gear")
    expect(inferPackingCategory("Luggage lock")).toBe("Gear")
  })

  it("falls back to Other for unrecognised items", () => {
    expect(inferPackingCategory("Snacks for the flight")).toBe("Other")
    expect(inferPackingCategory("Local currency cash")).toBe("Other")
    expect(inferPackingCategory("Travel pillow")).toBe("Other")
  })

  it("is case-insensitive", () => {
    expect(inferPackingCategory("PASSPORT")).toBe("Documents")
    expect(inferPackingCategory("LAPTOP")).toBe("Electronics")
    expect(inferPackingCategory("TOOTHBRUSH")).toBe("Toiletries")
  })
})

// ── buildPackingItems ────────────────────────────────────────────────────────

describe("buildPackingItems", () => {
  it("assigns sequential ids", () => {
    const items = buildPackingItems(["Passport", "Laptop"])
    expect(items[0]!.id).toBe("packing-0")
    expect(items[1]!.id).toBe("packing-1")
  })

  it("all items start unchecked", () => {
    const items = buildPackingItems(["Passport", "Laptop", "Sunscreen"])
    expect(items.every((i) => i.checked === false)).toBe(true)
  })

  it("sets category via inferPackingCategory", () => {
    const items = buildPackingItems(["Passport", "Laptop", "Sunscreen"])
    expect(items[0]!.category).toBe("Documents")
    expect(items[1]!.category).toBe("Electronics")
    expect(items[2]!.category).toBe("Toiletries")
  })

  it("preserves original text", () => {
    const items = buildPackingItems(["Travel insurance documents", "Noise-cancelling headphones"])
    expect(items[0]!.text).toBe("Travel insurance documents")
    expect(items[1]!.text).toBe("Noise-cancelling headphones")
  })

  it("returns empty array for empty input", () => {
    expect(buildPackingItems([])).toEqual([])
  })
})

// ── buildWeatherBlock ────────────────────────────────────────────────────────

describe("buildWeatherBlock", () => {
  it("returns fallback message when weather is null", () => {
    const result = buildWeatherBlock(null)
    expect(result).toContain("No weather data")
  })

  it("returns fallback when maxTemps array is empty", () => {
    const result = buildWeatherBlock({ maxTemps: [], minTemps: [], precipProbabilities: [] })
    expect(result).toContain("No weather data")
  })

  it("includes avg high and low temperatures", () => {
    const result = buildWeatherBlock(WEATHER_MILD)
    expect(result).toContain("avg high")
    expect(result).toContain("avg low")
    expect(result).toContain("°C")
  })

  it("calculates correct average high for mild weather", () => {
    const result = buildWeatherBlock(WEATHER_MILD)
    const avgHigh = (22 + 23 + 21 + 24 + 25 + 22 + 23) / 7
    expect(result).toContain(avgHigh.toFixed(1))
  })

  it("includes max precipitation probability", () => {
    const result = buildWeatherBlock(WEATHER_HOT)
    expect(result).toContain("90%")
  })

  it("lists daily highs", () => {
    const result = buildWeatherBlock(WEATHER_MILD)
    expect(result).toContain("Daily highs:")
  })
})

// ── buildCountryBlock ────────────────────────────────────────────────────────

describe("buildCountryBlock", () => {
  it("returns fallback when countryInfo is null", () => {
    const result = buildCountryBlock("Tokyo, Japan", null)
    expect(result).toContain("Tokyo, Japan")
    expect(result).toContain("country data unavailable")
  })

  it("includes country name and flag", () => {
    const result = buildCountryBlock("Tokyo, Japan", COUNTRY_JP)
    expect(result).toContain("Japan")
    expect(result).toContain("🇯🇵")
  })

  it("includes capital, currency, languages, timezone", () => {
    const result = buildCountryBlock("Tokyo, Japan", COUNTRY_JP)
    expect(result).toContain("Tokyo")
    expect(result).toContain("Japanese Yen")
    expect(result).toContain("Japanese")
    expect(result).toContain("Asia/Tokyo")
  })
})

// ── buildClaudePrompt ────────────────────────────────────────────────────────

describe("buildClaudePrompt", () => {
  it("includes the destination in the prompt", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, COUNTRY_JP, WEATHER_MILD)
    expect(prompt).toContain("Tokyo, Japan")
  })

  it("includes the trip purpose", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, COUNTRY_JP, WEATHER_MILD)
    expect(prompt).toContain("leisure and culture")
  })

  it("includes the correct duration with plural days", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, COUNTRY_JP, WEATHER_MILD)
    expect(prompt).toContain("7 days")
  })

  it("uses singular 'day' for 1-day trips", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, durationDays: 1 }, null, null)
    expect(prompt).toContain("1 day")
    expect(prompt).not.toContain("1 days")
  })

  it("includes life stage description", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("working professional")
  })

  it("maps student life stage correctly", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, lifeStage: "student" }, null, null)
    expect(prompt).toContain("student")
  })

  it("maps unemployed life stage correctly", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, lifeStage: "unemployed" }, null, null)
    expect(prompt).toContain("unemployed")
  })

  it("includes budget preference description", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("mid-range hotels")
  })

  it("includes comfort budget description for comfort preference", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, budgetPreference: "comfort" }, null, null)
    expect(prompt).toContain("quality hotels")
  })

  it("includes accommodation preference description", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("3-star hotels")
  })

  it("includes start date when provided", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, startDate: "2026-07-15" }, null, null)
    expect(prompt).toContain("2026-07-15")
  })

  it("includes fallback text when no start date", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("not specified")
  })

  it("includes special circumstances when provided", () => {
    const prompt = buildClaudePrompt({ ...BASE_INPUT, benefits: "Eurail pass holder" }, null, null)
    expect(prompt).toContain("Eurail pass holder")
  })

  it("omits special circumstances line when not provided", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).not.toContain("Special circumstances")
  })

  it("instructs Claude to return only JSON", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("Return ONLY valid JSON")
  })

  it("specifies all required output fields", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    const requiredFields = [
      "packingList", "accommodationRecommendation", "placesToVisit",
      "thingsToDo", "gettingAround", "contingencies", "summary",
      "weatherSummary", "currencyInfo", "visaInfo", "budgetBreakdown", "dailyPlan",
    ]
    for (const field of requiredFields) {
      expect(prompt).toContain(field)
    }
  })

  it("uses local currency name from countryInfo when available", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, COUNTRY_JP, WEATHER_MILD)
    expect(prompt).toContain("Japanese Yen")
  })

  it("falls back to 'local currency' when no countryInfo", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, null)
    expect(prompt).toContain("local currency")
  })

  it("includes weather data in prompt when provided", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, null, WEATHER_MILD)
    expect(prompt).toContain("7-day forecast")
  })

  it("includes country block in prompt when provided", () => {
    const prompt = buildClaudePrompt(BASE_INPUT, COUNTRY_JP, null)
    expect(prompt).toContain("Japan 🇯🇵")
  })
})

// ── formatDayDate ────────────────────────────────────────────────────────────

describe("formatDayDate", () => {
  it("formats day 0 offset as the start date", () => {
    const result = formatDayDate("2026-07-15", 0)
    expect(result).toContain("15")
    expect(result).toContain("Jul")
  })

  it("increments date by offset correctly", () => {
    const day1 = formatDayDate("2026-07-15", 0)
    const day2 = formatDayDate("2026-07-15", 1)
    expect(day1).not.toBe(day2)
    expect(day2).toContain("16")
  })

  it("handles month boundary correctly", () => {
    const result = formatDayDate("2026-07-31", 1)
    expect(result).toContain("1")
    expect(result).toContain("Aug")
  })

  it("includes weekday in output", () => {
    const result = formatDayDate("2026-07-15", 0)
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    expect(weekdays.some((d) => result.includes(d))).toBe(true)
  })
})

// ── buildEmptyDays ───────────────────────────────────────────────────────────

describe("buildEmptyDays", () => {
  it("creates correct number of days", () => {
    expect(buildEmptyDays(5).length).toBe(5)
    expect(buildEmptyDays(1).length).toBe(1)
    expect(buildEmptyDays(14).length).toBe(14)
  })

  it("numbers days starting from 1", () => {
    const days = buildEmptyDays(3)
    expect(days[0]!.day).toBe(1)
    expect(days[1]!.day).toBe(2)
    expect(days[2]!.day).toBe(3)
  })

  it("all days start with empty activities", () => {
    const days = buildEmptyDays(4)
    expect(days.every((d) => d.activities.length === 0)).toBe(true)
  })

  it("all days start with empty theme", () => {
    const days = buildEmptyDays(3)
    expect(days.every((d) => d.theme === "")).toBe(true)
  })

  it("attaches dateLabel when startDate is provided", () => {
    const days = buildEmptyDays(3, "2026-07-15")
    expect(days.every((d) => d.dateLabel !== undefined)).toBe(true)
  })

  it("omits dateLabel when no startDate", () => {
    const days = buildEmptyDays(3)
    expect(days.every((d) => d.dateLabel === undefined)).toBe(true)
  })

  it("dateLabels increment by one day", () => {
    const days = buildEmptyDays(3, "2026-07-15")
    expect(days[0]!.dateLabel).toContain("15")
    expect(days[1]!.dateLabel).toContain("16")
    expect(days[2]!.dateLabel).toContain("17")
  })
})

// ── deriveTripStatus ─────────────────────────────────────────────────────────

describe("deriveTripStatus", () => {
  const TODAY = new Date().toISOString().slice(0, 10)
  const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const LAST_WEEK = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

  it("returns 'planning' when no startDate", () => {
    expect(deriveTripStatus(undefined, undefined)).toBe("planning")
  })

  it("returns 'planning' for a future start date", () => {
    expect(deriveTripStatus(TOMORROW, undefined)).toBe("planning")
  })

  it("returns 'active' when today is on or after start but before end", () => {
    expect(deriveTripStatus(YESTERDAY, TOMORROW)).toBe("active")
  })

  it("returns 'active' when start date is today and no end date", () => {
    expect(deriveTripStatus(TODAY, undefined)).toBe("active")
  })

  it("returns 'completed' when end date is in the past", () => {
    expect(deriveTripStatus(LAST_WEEK, YESTERDAY)).toBe("completed")
  })

  it("returns 'active' when start is past but no end date", () => {
    expect(deriveTripStatus(YESTERDAY, undefined)).toBe("active")
  })
})
