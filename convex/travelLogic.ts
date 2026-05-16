/**
 * convex/travelLogic.ts
 *
 * Pure logic functions used by convex/travel.ts actions and mutations.
 * Kept inside convex/ so Convex's bundler can resolve them without
 * crossing the src/ boundary.
 *
 * The equivalent functions in src/domain/ remain for frontend use and testing.
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

export interface HabitDefinition {
  id: string
  label: string
  stackAnchor?: string
}

export interface HabitAdvice {
  habitId: string
  label: string
  verdict: "keep" | "adapt" | "suspend"
  reason: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface TripContext {
  name: string
  destination: string
  purpose: string
  durationDays: number
  startDate?: string
  budgetPreference: string
}

export interface PreTripTaskSpec {
  title: string
  sectionId: "mustDo" | "highPriority" | "mediumPriority" | "lowPriority"
  daysBefore: number
}

export interface PlannedPreTripTask {
  id: string
  title: string
  sectionId: string
  date: string
  isDone: boolean
  isShallow: boolean
}

// ── Packing helpers ───────────────────────────────────────────────────────────

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

// ── Claude prompt builder ─────────────────────────────────────────────────────

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

export function buildClaudePrompt(
  input: TravelInput,
  countryInfo: CountryInfo | null,
  weather: WeatherData | null,
): string {
  let weatherBlock = "No weather data available for this destination."
  if (weather && weather.maxTemps.length > 0) {
    const avgMax = (weather.maxTemps.reduce((a, b) => a + b, 0) / weather.maxTemps.length).toFixed(1)
    const avgMin = (weather.minTemps.reduce((a, b) => a + b, 0) / weather.minTemps.length).toFixed(1)
    const maxPrecip = Math.max(...weather.precipProbabilities)
    weatherBlock = `7-day forecast: avg high ${avgMax}°C, avg low ${avgMin}°C, max precip probability ${maxPrecip}%. Daily highs: ${weather.maxTemps.map((t) => t.toFixed(0)).join(", ")}°C.`
  }

  let countryBlock = `Destination: ${input.destination} (country data unavailable).`
  if (countryInfo) {
    countryBlock = `Country: ${countryInfo.countryName} ${countryInfo.flagEmoji}
Capital: ${countryInfo.capital}
Currency: ${countryInfo.currency}
Languages: ${countryInfo.languages.join(", ")}
Timezone: ${countryInfo.timezone}`
  }

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

// ── Pre-trip tasks ────────────────────────────────────────────────────────────

export const DEFAULT_PREP_TASKS: PreTripTaskSpec[] = [
  { title: "Book flights", sectionId: "highPriority", daysBefore: 42 },
  { title: "Book accommodation", sectionId: "highPriority", daysBefore: 30 },
  { title: "Check visa requirements", sectionId: "highPriority", daysBefore: 30 },
  { title: "Get travel insurance", sectionId: "mediumPriority", daysBefore: 21 },
  { title: "Notify bank of travel dates", sectionId: "mediumPriority", daysBefore: 14 },
  { title: "Download offline maps", sectionId: "lowPriority", daysBefore: 7 },
  { title: "Exchange currency / set up travel card", sectionId: "mediumPriority", daysBefore: 7 },
  { title: "Set up Out Of Office email", sectionId: "lowPriority", daysBefore: 3 },
  { title: "Charge all devices and power banks", sectionId: "lowPriority", daysBefore: 1 },
  { title: "Pack bag", sectionId: "mustDo", daysBefore: 1 },
  { title: "Check in online (if applicable)", sectionId: "mustDo", daysBefore: 1 },
]

function subtractDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const d = new Date(Date.UTC(year!, month! - 1, day!))
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function clampDate(date: string, minDate: string): string {
  return date < minDate ? minDate : date
}

export function buildPreTripTasks(
  specs: PreTripTaskSpec[],
  tripStartDate: string,
  minDate: string,
): PlannedPreTripTask[] {
  return specs.map((spec, i) => ({
    id: `pretrip-${i}-${Date.now()}`,
    title: spec.title,
    sectionId: spec.sectionId,
    date: clampDate(subtractDays(tripStartDate, spec.daysBefore), minDate),
    isDone: false,
    isShallow: true,
  }))
}

export function buildPreTripTasksPrompt(
  destination: string,
  purpose: string,
  durationDays: number,
  lifeStage: string,
  startDate: string,
): string {
  return `You are a productivity assistant helping someone prepare for a trip.

TRIP DETAILS:
- Destination: ${destination}
- Purpose: ${purpose}
- Duration: ${durationDays} days
- Traveller profile: ${lifeStage}
- Departure date: ${startDate}

Generate a preparation task list for this specific trip. Return ONLY valid JSON — no markdown, no prose.

Rules:
- 8-14 tasks total, ordered by daysBefore descending (earliest first)
- daysBefore must be a positive integer (how many days before departure to do this)
- sectionId must be one of: "mustDo", "highPriority", "mediumPriority", "lowPriority"
- Tasks must be specific to the destination and purpose
- Include at least one task about productivity/deep work setup for the trip
- mustDo tasks only for day-before critical items

Return this exact JSON shape:
[
  { "title": "string", "sectionId": "highPriority", "daysBefore": 30 }
]`
}

export function parseAITaskSpecs(rawJson: string): PreTripTaskSpec[] {
  const cleaned = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim()
  const parsed = JSON.parse(cleaned) as unknown
  if (!Array.isArray(parsed)) throw new Error("Expected array from AI response")
  return parsed.filter((item): item is PreTripTaskSpec => {
    if (typeof item !== "object" || item === null) return false
    const obj = item as Record<string, unknown>
    return (
      typeof obj["title"] === "string" &&
      typeof obj["daysBefore"] === "number" &&
      (obj["daysBefore"] as number) > 0 &&
      ["mustDo", "highPriority", "mediumPriority", "lowPriority"].includes(obj["sectionId"] as string)
    )
  })
}

export function groupTasksByDate(tasks: PlannedPreTripTask[]): Record<string, PlannedPreTripTask[]> {
  const result: Record<string, PlannedPreTripTask[]> = {}
  for (const task of tasks) {
    if (!result[task.date]) result[task.date] = []
    result[task.date]!.push(task)
  }
  return result
}

// ── Habit advisor ─────────────────────────────────────────────────────────────

export function buildHabitAdvisorPrompt(
  habits: HabitDefinition[],
  destination: string,
  purpose: string,
  durationDays: number,
): string {
  const habitList = habits.map((h) => `- ${h.label}${h.stackAnchor ? ` (stacked after: ${h.stackAnchor})` : ""}`).join("\n")
  return `You are a productivity coach helping someone maintain their habits while traveling.

TRIP: ${destination}, ${durationDays} days, purpose: ${purpose}

CURRENT HABITS:
${habitList}

For each habit, decide whether to keep, adapt, or suspend it during this trip.
- "keep": habit is easy to continue as-is while traveling
- "adapt": habit is possible but needs modification for travel context
- "suspend": habit is not realistic during this trip (no guilt)

Return ONLY valid JSON — no markdown, no prose.

Return this exact JSON shape (one entry per habit, in the same order):
[
  {
    "habitId": "string",
    "label": "string",
    "verdict": "keep|adapt|suspend",
    "reason": "one sentence explanation"
  }
]`
}

export function parseHabitAdvice(rawJson: string, habits: HabitDefinition[]): HabitAdvice[] {
  const cleaned = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim()
  const parsed = JSON.parse(cleaned) as unknown
  if (!Array.isArray(parsed)) throw new Error("Expected array")
  const valid = parsed.filter((item): item is HabitAdvice => {
    if (typeof item !== "object" || item === null) return false
    const obj = item as Record<string, unknown>
    return (
      typeof obj["habitId"] === "string" &&
      typeof obj["label"] === "string" &&
      typeof obj["reason"] === "string" &&
      ["keep", "adapt", "suspend"].includes(obj["verdict"] as string)
    )
  })
  const byId = new Map(valid.map((a) => [a.habitId, a]))
  return habits.map((h) => byId.get(h.id) ?? { habitId: h.id, label: h.label, verdict: "keep" as const, reason: "Most habits can be adapted for travel." })
}

export function buildFallbackAdviceList(habits: HabitDefinition[]): HabitAdvice[] {
  return habits.map((h) => ({ habitId: h.id, label: h.label, verdict: "keep" as const, reason: "Most habits can be adapted for travel — check your schedule each day." }))
}

// ── Trip chat ─────────────────────────────────────────────────────────────────

export function buildTripSystemPrompt(
  trip: TripContext,
  dailyPlan: Array<{ day: number; theme: string; activities: Array<{ time: string; name: string; durationMinutes: number }> }>,
  today: string,
): string {
  const [sy, sm, sd] = (trip.startDate ?? "").split("-").map(Number)
  const [ty, tm, td] = today.split("-").map(Number)
  const currentDay = trip.startDate
    ? Math.floor((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(sy!, sm! - 1, sd!)) / 86_400_000) + 1
    : null

  const itinerarySummary = dailyPlan.length > 0
    ? dailyPlan.map((d) => {
        const acts = d.activities.length > 0
          ? d.activities.map((a) => `  ${a.time} ${a.name} (${a.durationMinutes}min)`).join("\n")
          : "  (no activities scheduled)"
        return `Day ${d.day}${d.theme ? ` — ${d.theme}` : ""}:\n${acts}`
      }).join("\n\n")
    : "No detailed itinerary available."

  const currentDayNote = currentDay !== null && currentDay >= 1 && currentDay <= trip.durationDays
    ? `\nCURRENT DAY: Day ${currentDay} of ${trip.durationDays} (today is ${today})`
    : ""

  return `You are a knowledgeable travel assistant for someone currently on a trip.

TRIP DETAILS:
- Trip: ${trip.name}
- Destination: ${trip.destination}
- Purpose: ${trip.purpose}
- Duration: ${trip.durationDays} days${trip.startDate ? ` (started ${trip.startDate})` : ""}
- Budget style: ${trip.budgetPreference}${currentDayNote}

ITINERARY:
${itinerarySummary}

Answer questions concisely and practically. Keep responses under 150 words unless the question requires detail.`
}

export function buildApiMessages(
  history: ChatMessage[],
  newMessage: string,
): ChatMessage[] {
  return [...history, { role: "user", content: newMessage }]
}
