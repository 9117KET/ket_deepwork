"use node"

/**
 * convex/email.ts — the one place mail leaves from.
 *
 * Gmail SMTP with an app password, because there is no domain to verify
 * with a transactional provider yet. Every message is sent *from* the
 * configured Gmail account — to its owner and to the partner alike — and a
 * personal account caps at 500 recipients a day, which two people will never
 * approach. When a domain exists, swapping to Resend is a change to `send()`
 * and nothing else.
 *
 * Env (Convex dashboard, both deployments): GMAIL_SMTP_USER,
 * GMAIL_SMTP_APP_PASSWORD (16 characters, needs 2-Step Verification on the
 * Google account). Smoke-test with
 *   npx convex run email:sendTestEmail '{"to":"you@example.com"}'
 * before relying on reminders.
 */

import { internalAction } from "./_generated/server"
import { v } from "convex/values"
import nodemailer from "nodemailer"

interface Mail {
  to: string
  subject: string
  text: string
  html?: string
}

async function send(mail: Mail): Promise<void> {
  const user = process.env.GMAIL_SMTP_USER
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD
  if (!user || !pass) throw new Error("GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD must be set")
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10_000,
  })
  await transporter.sendMail({
    from: `Deepblock <${user}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.html ? { html: mail.html } : {}),
  })
}

export const sendEmail = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string(), html: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    await send(args)
    return null
  },
})

/** Proves the credentials and the outbound SMTP path from this deployment. */
export const sendTestEmail = internalAction({
  args: { to: v.string() },
  handler: async (_ctx, args) => {
    await send({
      to: args.to,
      subject: "Deepblock test email",
      text: `Sent ${new Date().toISOString()} from ${process.env.SITE_URL ?? "an unnamed deployment"}.`,
    })
    return null
  },
})
