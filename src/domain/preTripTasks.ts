/**
 * domain/preTripTasks.ts
 *
 * Pure functions for generating pre-trip preparation tasks.
 * These tasks inject into the main Deepblock planner on the appropriate dates.
 */

export type TaskSectionId =
  | "mustDo"
  | "highPriority"
  | "mediumPriority"
  | "lowPriority"

export interface PreTripTaskSpec {
  title: string
  sectionId: TaskSectionId
  daysBefore: number
}

export interface PlannedPreTripTask {
  id: string
  title: string
  sectionId: TaskSectionId
  date: string
  isDone: boolean
  isShallow: boolean
}

// ── Default task template ────────────────────────────────────────────────────

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

// ── Date arithmetic ──────────────────────────────────────────────────────────

export function subtractDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const d = new Date(Date.UTC(year!, month! - 1, day!))
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export function clampDate(date: string, minDate: string): string {
  return date < minDate ? minDate : date
}

// ── Task assembly ────────────────────────────────────────────────────────────

export function buildPreTripTasks(
  specs: PreTripTaskSpec[],
  tripStartDate: string,
  minDate: string,
): PlannedPreTripTask[] {
  return specs.map((spec, i) => {
    const targetDate = subtractDays(tripStartDate, spec.daysBefore)
    const clampedDate = clampDate(targetDate, minDate)
    return {
      id: `pretrip-${i}-${Date.now()}`,
      title: spec.title,
      sectionId: spec.sectionId,
      date: clampedDate,
      isDone: false,
      isShallow: true,
    }
  })
}

// ── Claude prompt for AI-customised tasks ────────────────────────────────────

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
- Tasks must be specific to the destination and purpose (e.g. visa requirements for the country, transport cards, cultural prep)
- Include at least one task about productivity/deep work setup for the trip
- mustDo tasks only for day-before critical items

Return this exact JSON shape:
[
  { "title": "string", "sectionId": "highPriority", "daysBefore": 30 }
]`
}

// ── Parse AI response ────────────────────────────────────────────────────────

export function parseAITaskSpecs(rawJson: string): PreTripTaskSpec[] {
  const cleaned = rawJson
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()

  const parsed = JSON.parse(cleaned) as unknown

  if (!Array.isArray(parsed)) throw new Error("Expected array from AI response")

  return parsed.filter((item): item is PreTripTaskSpec => {
    if (typeof item !== "object" || item === null) return false
    const obj = item as Record<string, unknown>
    return (
      typeof obj["title"] === "string" &&
      typeof obj["daysBefore"] === "number" &&
      obj["daysBefore"] > 0 &&
      ["mustDo", "highPriority", "mediumPriority", "lowPriority"].includes(obj["sectionId"] as string)
    )
  })
}

// ── Group tasks by date ──────────────────────────────────────────────────────

export function groupTasksByDate(tasks: PlannedPreTripTask[]): Record<string, PlannedPreTripTask[]> {
  const result: Record<string, PlannedPreTripTask[]> = {}
  for (const task of tasks) {
    if (!result[task.date]) result[task.date] = []
    result[task.date]!.push(task)
  }
  return result
}
