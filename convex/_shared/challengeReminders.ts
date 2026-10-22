/**
 * convex/_shared/challengeReminders.ts
 *
 * When does a challenge member get a reminder email? Pure rules — no Convex,
 * no DOM — so the cron, the mutation that claims reminders and the client
 * (which needs a partner's local date) all agree on one definition.
 *
 * A reminder is owed when the member's *local* clock is past a deadline and
 * the day's row carries no stamp for it. Repeats are spaced and capped per
 * day, so a forgotten plan costs four emails, not forty. After 21:30 only the
 * check-in is chased: one email per slot, and what matters at night is the
 * check-in.
 */

import { tzOffsetMs } from "./calendarTime"

/** Plan reminders: from the plan deadline, every two hours, four at most. */
export const PLAN_REPEAT_MIN = 120
export const PLAN_MAX_PER_DAY = 4
/** Check-in reminders: from 21:30 local, every 90 minutes, two at most. */
export const CHECKIN_START = "21:30"
export const CHECKIN_REPEAT_MIN = 90
export const CHECKIN_MAX_PER_DAY = 2

export type ReminderKind = "plan" | "checkin"

export interface ReminderDayRow {
  planSetAt?: number
  checkinAt?: number
  remindersSent?: { plan: number; checkin: number; lastAt?: number }
}

export interface ReminderDecision {
  kind: ReminderKind
  localDate: string
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The ISO date and minutes-since-midnight that `nowMs` is in `timezone`. */
export function localDateAndMinutes(nowMs: number, timezone: string): { date: string; minutes: number } {
  const wall = new Date(nowMs + tzOffsetMs(new Date(nowMs), timezone))
  const date = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`
  return { date, minutes: wall.getUTCHours() * 60 + wall.getUTCMinutes() }
}

export function reminderDecision(args: {
  nowMs: number
  timezone: string
  planDeadline: string
  checkinDeadline: string
  startDate: string
  endDate: string
  dayRow: ReminderDayRow | null
}): ReminderDecision | null {
  const { date, minutes } = localDateAndMinutes(args.nowMs, args.timezone)
  if (date < args.startDate || date > args.endDate) return null

  const sent = args.dayRow?.remindersSent ?? { plan: 0, checkin: 0 }
  const sinceLastMin = sent.lastAt == null ? Number.POSITIVE_INFINITY : (args.nowMs - sent.lastAt) / 60_000

  const checkinStart = hhmmToMinutes(CHECKIN_START)
  const checkinDeadline = hhmmToMinutes(args.checkinDeadline)
  if (minutes >= checkinStart && minutes < checkinDeadline) {
    if (!args.dayRow?.checkinAt && sent.checkin < CHECKIN_MAX_PER_DAY && sinceLastMin >= CHECKIN_REPEAT_MIN) {
      return { kind: "checkin", localDate: date }
    }
    return null
  }

  const planDeadline = hhmmToMinutes(args.planDeadline)
  if (minutes >= planDeadline && minutes < checkinStart) {
    if (!args.dayRow?.planSetAt && sent.plan < PLAN_MAX_PER_DAY && sinceLastMin >= PLAN_REPEAT_MIN) {
      return { kind: "plan", localDate: date }
    }
  }
  return null
}
