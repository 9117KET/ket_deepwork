import type { SideQuestDef, DayState } from './types'
import { addDays } from './dateUtils'

const CATEGORIES = ['fun', 'serious', 'technical'] as const

// FNV-1a hash for deterministic tiebreaking
function seededRandom(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function computeBaseScores(
  defs: SideQuestDef[],
  getCompletions: (date: string) => Record<string, boolean>,
  date: string,
): Map<string, number> {
  const scores = new Map<string, number>()
  const yesterday = addDays(date, -1)
  const dayBefore = addDays(date, -2)

  for (const def of defs) {
    let score = 0

    if (getCompletions(yesterday)[def.id]) score -= 10
    if (getCompletions(dayBefore)[def.id]) score -= 5

    // Bonus for quests not completed recently (up to 7 days)
    let daysSince = 0
    for (let i = 1; i <= 14; i++) {
      if (getCompletions(addDays(date, -i))[def.id]) break
      daysSince++
    }
    score += Math.min(daysSince, 7)

    // Deterministic tiebreaker
    score += seededRandom(def.id + date) * 2

    scores.set(def.id, score)
  }

  return scores
}

/**
 * Deterministically picks 3 side quests for `date` - one per category.
 * Uses completion history to rotate selections and boost skipped quests.
 */
export function getDailyQuestSelection(
  defs: SideQuestDef[],
  days: Record<string, DayState | undefined>,
  date: string,
): string[] {
  if (defs.length === 0) return []

  const getCompletions = (d: string): Record<string, boolean> =>
    days[d]?.sideQuestCompletions ?? {}

  const yesterday = addDays(date, -1)

  // Compute yesterday's base selection (no skip boost to avoid recursion)
  const yesterdayBaseScores = computeBaseScores(defs, getCompletions, yesterday)
  const yesterdaySelected = new Set<string>()
  for (const cat of CATEGORIES) {
    const catDefs = defs.filter(d => (d.category ?? 'fun') === cat)
    if (catDefs.length === 0) continue
    const best = catDefs.reduce((a, b) =>
      (yesterdayBaseScores.get(a.id) ?? 0) >= (yesterdayBaseScores.get(b.id) ?? 0) ? a : b,
    )
    yesterdaySelected.add(best.id)
  }

  const yesterdayCompletions = getCompletions(yesterday)
  const todayBaseScores = computeBaseScores(defs, getCompletions, date)
  const selected: string[] = []

  for (const cat of CATEGORIES) {
    const catDefs = defs.filter(d => (d.category ?? 'fun') === cat)
    if (catDefs.length === 0) continue

    const scored = catDefs.map(def => {
      let score = todayBaseScores.get(def.id) ?? 0
      // Boost quests that were shown yesterday but not completed
      if (yesterdaySelected.has(def.id) && !yesterdayCompletions[def.id]) {
        score += 4
      }
      return { id: def.id, score }
    })

    scored.sort((a, b) => b.score - a.score)
    if (scored[0]) selected.push(scored[0].id)
  }

  return selected
}

export interface SideQuestRank {
  rank: string
  xpToNext: number | null
}

export function getSideQuestRank(xp: number): SideQuestRank {
  if (xp < 5) return { rank: 'Curious', xpToNext: 5 - xp }
  if (xp < 15) return { rank: 'Explorer', xpToNext: 15 - xp }
  if (xp < 30) return { rank: 'Adventurer', xpToNext: 30 - xp }
  if (xp < 50) return { rank: 'Champion', xpToNext: 50 - xp }
  return { rank: 'Legendary', xpToNext: null }
}
