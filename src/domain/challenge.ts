/**
 * domain/challenge.ts
 *
 * Pure logic for the two-person accountability challenge: what a partner is
 * shown of a day, where today sits in the span, the line that gets pasted
 * into WhatsApp, and the week's tallies for Review. No React, no Convex.
 *
 * The summary is the whole privacy model. The partner never reads planner
 * rows; they read this object, built here from the day and sent as-is. A
 * task marked private is counted so the day's shape is honest, but never
 * titled.
 */

import type { DayState, HabitDefinition } from './types'
import { computeDailyDeepWorkMinutes } from './stats'

export interface ChallengeSummary {
  top3: { title: string; isDone: boolean }[]
  tasksDone: number
  tasksTotal: number
  privateCount: number
  deepWorkMinutes: number
  habitsDone: number
  habitsTotal: number
}

export interface ChallengeSpan {
  startDate: string
  endDate: string
}

export interface ChallengeProgress {
  /** 1-based, clamped into the span. */
  dayNumber: number
  totalDays: number
  /** Days after today that are still in the span. */
  daysLeft: number
  phase: 'upcoming' | 'active' | 'ended'
}

/** The fields the grids and tallies need; both the own row and the partner view satisfy it. */
export interface ChallengeDayLike {
  date: string
  planSetAt?: number | null
  checkinAt?: number | null
  dontsBroken?: string[]
}

const DAY_MS = 86_400_000

function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

function isoOfUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function buildChallengeSummary(day: DayState | undefined, habitDefinitions: HabitDefinition[]): ChallengeSummary {
  const roots = (day?.tasks ?? []).filter((t) => !t.parentId)
  const top3 = roots.filter((t) => t.sectionId === 'mustDo')
  const rest = roots.filter((t) => t.sectionId !== 'mustDo')
  const restVisible = rest.filter((t) => !t.isPrivate)
  const habitsDone = habitDefinitions.filter((h) => day?.habitCompletions?.[h.id] === true).length
  return {
    top3: top3.filter((t) => !t.isPrivate).map((t) => ({ title: t.title, isDone: t.isDone })),
    tasksDone: restVisible.filter((t) => t.isDone).length,
    tasksTotal: restVisible.length,
    privateCount: roots.filter((t) => t.isPrivate).length,
    deepWorkMinutes: computeDailyDeepWorkMinutes(day),
    habitsDone,
    habitsTotal: habitDefinitions.length,
  }
}

/** Day arithmetic in UTC so a DST change can never make a 92-day span count 91 or 93. */
export function challengeProgress(span: ChallengeSpan, todayIso: string): ChallengeProgress {
  const totalDays = Math.max(1, Math.round((utcDay(span.endDate) - utcDay(span.startDate)) / DAY_MS) + 1)
  const offset = Math.round((utcDay(todayIso) - utcDay(span.startDate)) / DAY_MS)
  const phase = offset < 0 ? 'upcoming' : offset >= totalDays ? 'ended' : 'active'
  const dayNumber = Math.min(Math.max(offset + 1, 1), totalDays)
  const daysLeft = phase === 'upcoming' ? totalDays : phase === 'ended' ? 0 : totalDays - dayNumber
  return { dayNumber, totalDays, daysLeft, phase }
}

/** Every ISO date in the span, first to last. */
export function challengeDates(span: ChallengeSpan): string[] {
  const out: string[] = []
  const end = utcDay(span.endDate)
  for (let ms = utcDay(span.startDate); ms <= end; ms += DAY_MS) out.push(isoOfUtc(ms))
  return out
}

export type DayCellState = 'both' | 'plan' | 'checkin' | 'none' | 'future'

export function dayCellState(row: ChallengeDayLike | undefined, date: string, todayIso: string): DayCellState {
  if (date > todayIso) return 'future'
  const plan = Boolean(row?.planSetAt)
  const checkin = Boolean(row?.checkinAt)
  if (plan && checkin) return 'both'
  if (plan) return 'plan'
  if (checkin) return 'checkin'
  return 'none'
}

/** A stamp's time of day, in the viewer's locale. */
export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

export function formatDeepMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** The line a member pastes into the chat. WhatsApp is the ping; this app is the record. */
export function buildShareText(args: {
  kind: 'plan' | 'checkin'
  displayName: string
  progress: ChallengeProgress
  summary: ChallengeSummary
  note?: string | null
  dontsBroken?: string[]
}): string {
  const { kind, displayName, progress, summary } = args
  const head =
    kind === 'plan'
      ? `Plan locked — Day ${progress.dayNumber}/${progress.totalDays} (${progress.daysLeft} left)`
      : `Checked in — Day ${progress.dayNumber}/${progress.totalDays} (${progress.daysLeft} left)`
  const lines = [head]
  if (summary.top3.length > 0) {
    lines.push(`Top 3: ${summary.top3.map((t) => `${t.isDone ? '✅' : '⬜'} ${t.title}`).join(' · ')}`)
  }
  const extras: string[] = []
  if (summary.tasksTotal > 0) {
    extras.push(kind === 'plan' ? `+${summary.tasksTotal} more` : `+${summary.tasksDone}/${summary.tasksTotal} more`)
  }
  if (summary.privateCount > 0) extras.push(`${summary.privateCount} private`)
  if (extras.length > 0) lines.push(extras.join(', '))
  if (kind === 'checkin') {
    const facts: string[] = []
    if (summary.deepWorkMinutes > 0) facts.push(`Deep work ${formatDeepMinutes(summary.deepWorkMinutes)}`)
    if (summary.habitsTotal > 0) facts.push(`Habits ${summary.habitsDone}/${summary.habitsTotal}`)
    if (facts.length > 0) lines.push(facts.join(' · '))
    if (args.dontsBroken && args.dontsBroken.length > 0) lines.push(`Broke: ${args.dontsBroken.join(', ')}`)
    const note = args.note?.trim()
    if (note) lines.push(note)
  }
  lines.push(`— ${displayName}`)
  return lines.join('\n')
}

/** A pasted invite link, or a bare token, becomes a token. Anything else is null. */
export function extractInviteToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const token = url.searchParams.get('invite')
    return token && token.trim() ? token.trim() : null
  } catch {
    return /^[A-Za-z0-9-]{8,}$/.test(trimmed) ? trimmed : null
  }
}

function byDate(rows: ChallengeDayLike[]): Map<string, ChallengeDayLike> {
  return new Map(rows.map((r) => [r.date, r]))
}

/** Days in `dates` on which both members locked in a plan. */
export function bothLockedDays(mine: ChallengeDayLike[], partner: ChallengeDayLike[], dates: string[]): number {
  const a = byDate(mine)
  const b = byDate(partner)
  return dates.filter((d) => a.get(d)?.planSetAt && b.get(d)?.planSetAt).length
}

/**
 * Consecutive days, ending at `untilIso`, on which both members both locked
 * in and checked in. An unfinished `untilIso` (today, usually) is skipped
 * rather than counted as a break.
 */
export function jointStreak(
  mine: ChallengeDayLike[],
  partner: ChallengeDayLike[],
  untilIso: string,
  startDate: string,
): number {
  const a = byDate(mine)
  const b = byDate(partner)
  const complete = (d: string) => {
    const x = a.get(d)
    const y = b.get(d)
    return Boolean(x?.planSetAt && x?.checkinAt && y?.planSetAt && y?.checkinAt)
  }
  let ms = utcDay(untilIso)
  if (!complete(isoOfUtc(ms))) ms -= DAY_MS
  let streak = 0
  while (isoOfUtc(ms) >= startDate && complete(isoOfUtc(ms))) {
    streak++
    ms -= DAY_MS
  }
  return streak
}
