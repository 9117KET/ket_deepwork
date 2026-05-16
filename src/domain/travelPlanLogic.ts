/**
 * domain/travelPlanLogic.ts
 *
 * Pure functions for travel plan generation:
 * - packing category inference
 * - Claude prompt building
 * - day date labelling
 *
 * No framework or Convex dependencies so these can be unit-tested directly.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TravelInput {
  origin: string
  destination: string
  purpose: string
  durationDays: number
  lifeStage: string
  budgetPreference: string
  accommodationPreference: string
  benefits?: string
  startDate?: string
}

export interface CountryInfo {
  countryName: string
  capital: string
  currency: string
  languages: string[]
  timezone: string
  flagEmoji: string
}

export interface WeatherData {
  maxTemps: number[]
  minTemps: number[]
  precipProbabilities: number[]
}

export interface PackingItem {
  id: string
  text: string
  checked: boolean
  category: string
}

// ── Packing category inference ───────────────────────────────────────────────

export function inferPackingCategory(item: string): string {
  const lower = item.toLowerCase()
  if (/passport|visa|id card|insurance|ticket|booking|itinerary|document|card|permit/.test(lower)) return "Documents"
  if (/phone|charger|laptop|tablet|cable|adaptor|adapter|camera|battery|earphones|headphones|power bank|usb/.test(lower)) return "Electronics"
  if (/shirt|trouser|jeans|jacket|coat|underwear|socks|shoes|dress|clothes|outfit|wear|sweater|hoodie|scarf|hat|cap|swimsuit|swim|t-shirt/.test(lower)) return "Clothing"
  if (/toiletries|toothbrush|toothpaste|shampoo|conditioner|sunscreen|soap|deodorant|razor|medication|medicine|vitamins|first aid|bandage/.test(lower)) return "Toiletries"
  if (/water bottle|backpack|day bag|luggage|suitcase|bag|lock|padlock|umbrella|rain/.test(lower)) return "Gear"
  return "Other"
}

export function buildPackingItems(rawList: string[]): PackingItem[] {
  return rawList.map((text, i) => ({
    id: `packing-${i}`,
    text,
    checked: false,
    category: inferPackingCategory(text),
  }))
}

// ── Claude prompt builder ────────────────────────────────────────────────────

const LIFE_STAGE_DESC: Record<string, string> = {
  student: "a student (tight budget, prioritises experiences, has flexible time)",
  professional: "a working professional (moderate-to-higher budget, values efficiency and comfort)",
  unemployed: "currently unemployed (very budget-conscious, has flexible time, needs lowest-cost options)",
}

const BUDGET_DESC: Record<string, string> = {
  budget: "budget traveller — hostels, street food, free attractions, public transit only",
  moderate: "moderate budget — mid-range hotels, local restaurants, a mix of paid and free activities",
  comfort: "comfort traveller — quality hotels, curated dining, private transfers acceptable",
}

const ACC_DESC: Record<string, string> = {
  cheap: "cheapest possible accommodation (hostels, capsule hotels, guesthouses)",
  affordable: "affordable mid-range accommodation (3-star hotels, well-reviewed B&Bs)",
  comfort: "comfortable accommodation (4-star hotels, boutique stays, serviced apartments)",
}

export function buildWeatherBlock(weather: WeatherData | null): string {
  if (!weather || weather.maxTemps.length === 0) {
    return "No weather data available for this destination."
  }
  const avgMax = (weather.maxTemps.reduce((a, b) => a + b, 0) / weather.maxTemps.length).toFixed(1)
  const avgMin = (weather.minTemps.reduce((a, b) => a + b, 0) / weather.minTemps.length).toFixed(1)
  const maxPrecip = Math.max(...weather.precipProbabilities)
  return `7-day forecast: avg high ${avgMax}°C, avg low ${avgMin}°C, max precip probability ${maxPrecip}%. Daily highs: ${weather.maxTemps.map((t) => t.toFixed(0)).join(", ")}°C.`
}

export function buildCountryBlock(destination: string, countryInfo: CountryInfo | null): string {
  if (!countryInfo) return `Destination: ${destination} (country data unavailable).`
  return `Country: ${countryInfo.countryName} ${countryInfo.flagEmoji}
Capital: ${countryInfo.capital}
Currency: ${countryInfo.currency}
Languages: ${countryInfo.languages.join(", ")}
Timezone: ${countryInfo.timezone}`
}

export function buildClaudePrompt(
  input: TravelInput,
  countryInfo: CountryInfo | null,
  weather: WeatherData | null,
): string {
  const weatherBlock = buildWeatherBlock(weather)
  const countryBlock = buildCountryBlock(input.destination, countryInfo)
  const currencyName = countryInfo?.currency ?? "local currency"
  const startDateLine = input.startDate
    ? `Trip start date: ${input.startDate}`
    : "Trip start date: not specified — plan for general/typical conditions"

  return `You are an expert travel planner. Return ONLY valid JSON — no markdown, no prose, no code fences.

TRIP CONTEXT:
- Traveller: ${LIFE_STAGE_DESC[input.lifeStage] ?? input.lifeStage}
- Budget: ${BUDGET_DESC[input.budgetPreference] ?? input.budgetPreference}
- Accommodation: ${ACC_DESC[input.accommodationPreference] ?? input.accommodationPreference}
- Origin: ${input.origin || "not specified"}
- Destination: ${input.destination}
- Purpose: ${input.purpose}
- Duration: ${input.durationDays} day${input.durationDays !== 1 ? "s" : ""}
- ${startDateLine}${input.benefits ? `\n- Special circumstances: ${input.benefits}` : ""}

DESTINATION DATA:
${countryBlock}

WEATHER:
${weatherBlock}

Generate a comprehensive travel plan. Rules:
- packingList: 10-15 specific items, weather-appropriate
- placesToVisit: 5-7 real named locations with why they suit this traveller
- thingsToDo: 4-6 concrete actionable tips, at least one weather-aware, at least one cost-saving
- gettingAround: specific transport options with realistic costs in ${currencyName}
- contingencies: local emergency number, safety notes, common scams if any
- accommodationRecommendation: 1-2 specific districts/neighbourhoods
- summary: 2-3 punchy sentences
- weatherSummary: 1-2 practical sentences on what to wear/plan around
- currencyInfo: currency, payment culture (cash vs card), ATM availability, money tips
- visaInfo: brief entry requirements, note that official verification is recommended
- budgetBreakdown: realistic daily cost estimate in ${currencyName} AND USD, broken into accommodation/food/transport/activities
- dailyPlan: one entry per day of the trip

Return this EXACT JSON shape:
{
  "packingList": ["string"],
  "accommodationRecommendation": "string",
  "placesToVisit": [{ "name": "string", "description": "string" }],
  "thingsToDo": ["string"],
  "gettingAround": "string",
  "contingencies": "string",
  "summary": "string",
  "weatherSummary": "string",
  "currencyInfo": "string",
  "visaInfo": "string",
  "budgetBreakdown": "string",
  "dailyPlan": [
    {
      "day": 1,
      "theme": "string",
      "activities": [
        { "time": "09:00", "name": "string", "type": "logistics|sightseeing|food|transport|leisure|deep_work", "durationMinutes": 60, "notes": "string" }
      ]
    }
  ]
}`
}

// ── Itinerary day helpers ────────────────────────────────────────────────────

export function formatDayDate(startIso: string, offset: number): string {
  const d = new Date(startIso + "T00:00:00")
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })
}

export function buildEmptyDays(durationDays: number, startDate?: string): Array<{
  day: number
  theme: string
  activities: never[]
  dateLabel?: string
}> {
  return Array.from({ length: durationDays }, (_, i) => ({
    day: i + 1,
    theme: "",
    activities: [],
    dateLabel: startDate ? formatDayDate(startDate, i) : undefined,
  }))
}

// ── Trip status helpers ──────────────────────────────────────────────────────

export type TripStatus = "planning" | "active" | "completed"

export function deriveTripStatus(startDate: string | undefined, endDate: string | undefined): TripStatus {
  if (!startDate) return "planning"
  const today = new Date().toISOString().slice(0, 10)
  if (today < startDate) return "planning"
  if (endDate && today > endDate) return "completed"
  return "active"
}
