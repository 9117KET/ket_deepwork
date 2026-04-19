/**
 * pages/SupportPage.tsx
 *
 * Support page for Life Planner.
 */

import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { MaterialIcon } from "../components/ui/MaterialIcon";

const FAQS = [
  {
    q: "My data is not syncing between devices.",
    a: "Make sure you are signed in with the same account on both devices. Data syncs automatically after sign-in. If the problem persists, try refreshing the page — the app will re-fetch from the server on load.",
  },
  {
    q: "I lost my tasks after clearing my browser data.",
    a: "Guest data lives only in your browser's localStorage. Signing in backs your data up to the cloud so it survives cache clears and is accessible from any device.",
  },
  {
    q: "How does the deep work timer work?",
    a: "The timer is in the sidebar on the right. Choose a preset duration (15, 25, 30, 45, 50, or 60 minutes), type a label for the session (e.g. 'German study'), and press Start. When the countdown reaches zero, the session is automatically saved to your day. A teal badge in the day header shows your total deep work minutes. Your weekly progress is tracked in the Deep Work scoreboard in the Tracking dashboard.",
  },
  {
    q: "What is the 'Mark as shallow' option on tasks?",
    a: "Right-click a task (or tap ⋮) and choose 'Mark as shallow'. Shallow work means logistical, non-cognitively demanding tasks — email, admin, errands. Marking them lets the app track how much of your day is spent on low-depth work. Once completed shallow tasks total 2 hours in a day, a warning banner appears above your sections reminding you to protect your deep work blocks.",
  },
  {
    q: "What is the depth philosophy setting?",
    a: "Depth philosophy (in the Tracking dashboard) lets you choose how you structure your deep work time. Rhythmic means a fixed daily block at the same time every day — the most sustainable approach for most people. Journalistic means inserting deep work whenever a gap appears. Bimodal means alternating multi-day deep-work periods with shallow periods. When Rhythmic is selected, a teal banner in the planner highlights your High Priority block window as a reminder to protect it.",
  },
  {
    q: "How do I set my weekly deep work goal?",
    a: "Open the Tracking dashboard (scroll down on the planner page). The 'Deep Work This Week' card shows a progress bar. Click the goal number (default: 20 h) to edit it inline. The goal syncs to your account and persists across devices.",
  },
  {
    q: "How does the habit checklist work?",
    a: "The habit checklist is in the right sidebar. Tap each habit to check it off for today. Each habit shows a 🔥 streak — the number of consecutive days it was completed. If you missed a habit yesterday but completed it the day before, it's flagged in amber with a ⚠ warning: the never-miss-twice alert. Completing it today clears the alert.",
  },
  {
    q: "How do I add, edit, or remove habits?",
    a: "Click 'Edit' in the habit checklist header. In the editor: type a new habit name and press Enter (or click Add) to create it. Click ✕ on any habit to delete it. Use ▲▼ to reorder. Each habit has an optional 'After...' field — a habit-stacking anchor (e.g. 'After waking up'). The anchor is shown below the habit name in the checklist as a trigger phrase. Click Save when done.",
  },
  {
    q: "What is the identity statement?",
    a: "The identity statement is the 'I am X' declaration at the top of the habit checklist (e.g. 'I am someone who does deep work every day'). Click it to edit. It's based on James Clear's principle that identity precedes behavior — you act in accordance with who you believe you are. The statement is shown every day and syncs to your account.",
  },
  {
    q: "Where can I see my full habit history?",
    a: "Scroll down on the planner page to open the Tracking dashboard. Below the block completion grid is the Habit Tracking table: each row is a habit, each column is a day in the selected month. A ✓ means the habit was completed that day; a · means it wasn't. The final column shows the current streak for each habit.",
  },
  {
    q: "How do I connect Google Calendar?",
    a: "Go to the Calendar page from the top navigation, then click 'Connect Google Calendar'. You will be redirected to Google to authorize access. After approving, you can select which calendar to sync.",
  },
  {
    q: "How do I revoke Google Calendar access?",
    a: "Visit your Google Account → Security → Third-party apps and remove the app. You can also disconnect from within the Calendar page.",
  },
  {
    q: "How do I share my planner with someone?",
    a: "Open the planner and click the Share button in the top bar. Choose view or edit permission and copy the generated link. Anyone with the link can access your planner with that permission.",
  },
  {
    q: "How do I delete my account and data?",
    a: "Email us at kinlotangiri911@gmail.com with your registered email address and we will permanently delete your account and all associated data within 30 days.",
  },
  {
    q: "The app is not loading correctly.",
    a: "Try a hard refresh (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac). If the issue continues, clearing site data in your browser settings usually resolves it.",
  },
];

export function SupportPage() {
  return (
    <AppChrome headerPositionClass="top-0" mobileActive="home" maxWidthClass="max-w-3xl">
      <div className="py-12 pb-32 md:pb-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-share-onSurfaceVariant hover:text-share-onSurface"
        >
          ← Back to Life Planner
        </Link>

        <h1 className="mb-2 font-shareHeadline text-4xl font-black text-share-onSurface">
          Support
        </h1>
        <p className="mb-10 text-base leading-relaxed text-share-onSurfaceVariant">
          Need help? Browse the common questions below or reach out directly.
        </p>

        {/* Contact card */}
        <div className="mb-12 flex flex-col gap-4 rounded-xl border border-share-primary/20 bg-share-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 font-bold text-share-onSurface">Email support</p>
            <p className="text-sm text-share-onSurfaceVariant">
              We typically respond within 1–2 business days.
            </p>
          </div>
          <a
            href="mailto:kinlotangir1@gmail.com"
            className="inline-flex items-center gap-2 rounded-lg bg-share-primary px-5 py-2.5 text-sm font-bold text-share-onPrimary transition-all hover:bg-share-primaryContainer"
          >
            <MaterialIcon name="mail" className="text-base" />
            kinlotangir1@gmail.com
          </a>
        </div>

        {/* FAQ */}
        <h2 className="mb-6 font-shareHeadline text-2xl font-bold text-share-onSurface">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-share-outlineVariant/20 bg-share-surfaceContainerLow"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-share-onSurface">
                {faq.q}
                <MaterialIcon
                  name="expand_more"
                  className="shrink-0 text-share-onSurfaceVariant transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-share-outlineVariant/10 px-5 py-4 text-sm leading-relaxed text-share-onSurfaceVariant">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        {/* Footer nudge */}
        <p className="mt-12 text-sm text-share-onSurfaceVariant">
          Still stuck?{" "}
          <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
            Send us an email
          </a>{" "}
          and we'll get back to you.
        </p>
      </div>
    </AppChrome>
  );
}
