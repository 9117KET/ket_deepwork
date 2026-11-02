/**
 * convex/reminders.ts — the sweep the cron runs every 15 minutes.
 *
 * Claim first, send second. `claimDueReminders` records every reminder it
 * hands back before this action tries to deliver one, so a send that fails
 * costs one email and a crash mid-loop never doubles any. The rules for who
 * is due live in `_shared/challengeReminders.ts` (plan, check-in) and
 * `_shared/challengeInactivity.ts` (warning, closed).
 */

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import type { DueReminder } from "./challengesInternal"
import { CLOSE_AFTER_DAYS, WARN_AFTER_DAYS } from "./_shared/challengeInactivity"

export function reminderEmail(r: DueReminder, siteUrl: string): { subject: string; text: string } {
  const link = `${siteUrl}/challenge/${r.challengeId}`
  const names = (r.challengeNames.length > 0 ? r.challengeNames : [r.challengeName]).join(", ")
  if (r.kind === "plan") {
    return {
      subject: `Lock in today's plan — ${names}`,
      text: [
        `Hi ${r.displayName},`,
        ``,
        `Your plan for ${r.localDate} is not locked in yet. Put today's Top 3 in the planner, then tap "Lock in today's plan".`,
        ``,
        link,
        ``,
        `These reminders stop the moment you lock in.`,
      ].join("\n"),
    }
  }
  if (r.kind === "checkin") {
    return {
      subject: `Check in before midnight — ${names}`,
      text: [
        `Hi ${r.displayName},`,
        ``,
        `The day is nearly over and you have not checked in for ${r.localDate}. Say how it went, own up to any don'ts, and your partner will see it.`,
        ``,
        link,
      ].join("\n"),
    }
  }
  const about = r.aboutName ?? "Your partner"
  if (r.kind === "warning") {
    // The quiet member is addressed directly, in the greeting's own sentence.
    const lines = r.toInactive
      ? [
          `Hi ${r.displayName}, you have not locked in a plan or checked in for ${WARN_AFTER_DAYS} days in "${r.challengeName}". If you lock in or check in today, it stays open.`,
        ]
      : [
          `Hi ${r.displayName},`,
          ``,
          `${about} has not locked in a plan or checked in for ${WARN_AFTER_DAYS} days in "${r.challengeName}". If that stays the same through tomorrow, the challenge closes on its own and the reminders stop. One lock-in or check-in keeps it open.`,
        ]
    return {
      subject: `Three days without a lock-in or check-in — ${r.challengeName}`,
      text: [...lines, ``, link].join("\n"),
    }
  }
  return {
    subject: `${r.challengeName} has closed`,
    text: [
      `Hi ${r.displayName},`,
      ``,
      `"${r.challengeName}" closed after ${CLOSE_AFTER_DAYS} days without a lock-in or check-in from ${about}. The season stays readable at ${link}. You can start a new one any time.`,
    ].join("\n"),
  }
}

export const sweep = internalAction({
  args: {},
  handler: async (ctx): Promise<{ due: number; sent: number }> => {
    const due: DueReminder[] = await ctx.runMutation(internal.challengesInternal.claimDueReminders, { nowMs: Date.now() })
    const siteUrl = process.env.SITE_URL ?? ""
    let sent = 0
    for (const r of due) {
      try {
        await ctx.runAction(internal.email.sendEmail, { to: r.to, ...reminderEmail(r, siteUrl) })
        sent++
      } catch (e) {
        console.error("[reminders] could not send", r.kind, "email for", r.localDate, e)
      }
    }
    return { due: due.length, sent }
  },
})
