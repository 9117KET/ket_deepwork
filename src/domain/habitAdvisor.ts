/**
 * domain/habitAdvisor.ts
 *
 * Pure functions for the habit continuation advisor:
 * - prompt building
 * - response parsing
 * - fallback logic
 */

export interface HabitDefinition {
  id: string
  label: string
  stackAnchor?: string
}

export type HabitVerdict = "keep" | "adapt" | "suspend"

export interface HabitAdvice {
  habitId: string
  label: string
  verdict: HabitVerdict
  reason: string
}

// ── Prompt builder ────────────────────────────────────────────────────────────

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

// ── Response parsing ──────────────────────────────────────────────────────────

export function parseHabitAdvice(rawJson: string, habits: HabitDefinition[]): HabitAdvice[] {
  const cleaned = rawJson
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()

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

  // Re-key by habitId to handle any ordering/missing from AI
  const byId = new Map(valid.map((a) => [a.habitId, a]))

  return habits.map((h) => {
    const ai = byId.get(h.id)
    if (ai) return ai
    return buildFallbackAdvice(h, "keep")
  })
}

// ── Fallback (no AI / parse failure) ─────────────────────────────────────────

export function buildFallbackAdvice(habit: HabitDefinition, verdict: HabitVerdict): HabitAdvice {
  const fallbackReasons: Record<HabitVerdict, string> = {
    keep: "Most habits can be adapted for travel — check your schedule each day.",
    adapt: "Travel may require adjusting timing or location for this habit.",
    suspend: "This habit may be difficult to maintain during travel.",
  }
  return {
    habitId: habit.id,
    label: habit.label,
    verdict,
    reason: fallbackReasons[verdict],
  }
}

export function buildFallbackAdviceList(habits: HabitDefinition[]): HabitAdvice[] {
  return habits.map((h) => buildFallbackAdvice(h, "keep"))
}

// ── Verdict stats ─────────────────────────────────────────────────────────────

export function countVerdicts(advice: HabitAdvice[]): Record<HabitVerdict, number> {
  const counts: Record<HabitVerdict, number> = { keep: 0, adapt: 0, suspend: 0 }
  for (const a of advice) {
    counts[a.verdict]++
  }
  return counts
}
