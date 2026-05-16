/**
 * domain/tripChat.ts
 *
 * Pure functions for the mid-trip AI chat assistant.
 * Builds the system context from the trip data so Claude knows
 * where the user is, what their itinerary looks like, and can
 * answer contextual questions without re-explaining every time.
 */

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
  currentDay?: number
  budgetPreference: string
}

export interface DayActivity {
  time: string
  name: string
  type: string
  durationMinutes: number
}

export interface DayPlan {
  day: number
  theme: string
  activities: DayActivity[]
}

// ── System context builder ────────────────────────────────────────────────────

export function buildTripSystemPrompt(
  trip: TripContext,
  dailyPlan: DayPlan[],
  today: string,
): string {
  const currentDay = trip.startDate ? computeCurrentDay(trip.startDate, today) : null

  const itinerarySummary = dailyPlan.length > 0
    ? dailyPlan.map((d) => {
        const actSummary = d.activities.length > 0
          ? d.activities.map((a) => `  ${a.time} ${a.name} (${a.durationMinutes}min)`).join("\n")
          : "  (no activities scheduled)"
        return `Day ${d.day}${d.theme ? ` — ${d.theme}` : ""}:\n${actSummary}`
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

Answer questions concisely and practically. You know their itinerary so you can give context-aware suggestions ("near your Day 2 hotel area" rather than generic answers). Keep responses under 150 words unless the question requires detail.`
}

// ── Message list builder ──────────────────────────────────────────────────────

export function buildApiMessages(
  history: ChatMessage[],
  newMessage: string,
): ChatMessage[] {
  return [...history, { role: "user", content: newMessage }]
}

// ── Response trimming ─────────────────────────────────────────────────────────

export function trimResponse(text: string, maxWords = 200): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(" ") + "…"
}

// ── Day computation ───────────────────────────────────────────────────────────

export function computeCurrentDay(startIso: string, todayIso: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number)
  const [ty, tm, td] = todayIso.split("-").map(Number)
  const start = Date.UTC(sy!, sm! - 1, sd!)
  const today = Date.UTC(ty!, tm! - 1, td!)
  return Math.floor((today - start) / 86_400_000) + 1
}

// ── Suggested prompts ────────────────────────────────────────────────────────

export function getSuggestedPrompts(destination: string, currentDay: number | null): string[] {
  const city = destination.split(",")[0]?.trim() ?? destination
  const prompts = [
    `What's a good restaurant near me in ${city}?`,
    `What should I not miss on my last full day?`,
    `Any safety tips specific to ${city}?`,
    `Best way to get around ${city} cheaply?`,
  ]
  if (currentDay !== null && currentDay >= 1) {
    prompts.unshift(`I have 2 free hours on Day ${currentDay} — what do you suggest?`)
  }
  return prompts.slice(0, 4)
}
