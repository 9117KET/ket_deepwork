/**
 * convex/reminders.ts — the sweep the cron runs every 15 minutes.
 *
 * Claim first, send second. `claimDueReminders` records every reminder it
 * hands back before this action tries to deliver one, so a send that fails
 * costs one email and a crash mid-loop never doubles any. The rules for who
 * is due live in `_shared/challengeReminders.ts`.
 */

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import type { DueReminder } from "./challengesInternal"

export function reminderEmail(r: DueReminder, siteUrl: string): { subject: string; text: string } {
  const link = `${siteUrl}/challenge`
  if (r.kind === "plan") {
    return {
      subject: `Lock in today's plan — ${r.challengeName}`,
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
  return {
    subject: `Check in before midnight — ${r.challengeName}`,
    text: [
      `Hi ${r.displayName},`,
      ``,
      `The day is nearly over and you have not checked in for ${r.localDate}. Say how it went, own up to any don'ts, and your partner will see it.`,
      ``,
      link,
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
        console.error("[reminders] could not send", r.kind, "reminder for", r.localDate, e)
      }
    }
    return { due: due.length, sent }
  },
})
