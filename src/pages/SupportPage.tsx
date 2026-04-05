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
    q: "How do I connect Google Calendar?",
    a: "Go to the Calendar page from the top navigation, then click 'Connect Google Calendar'. You will be redirected to Google to authorize access. After approving, you can select which calendar to sync.",
  },
  {
    q: "How do I revoke Google Calendar access?",
    a: "Visit your Google Account → Security → Third-party apps and remove Life Planner. You can also disconnect from within the Calendar page in the app.",
  },
  {
    q: "How do I share my planner with someone?",
    a: "Open the planner and click the Share button in the top bar. Choose view or edit permission and copy the generated link. Anyone with the link can access your planner with that permission.",
  },
  {
    q: "How do I delete my account and data?",
    a: "Email us at kinlotangir1@gmail.com with your registered email address and we will permanently delete your account and all associated data within 30 days.",
  },
  {
    q: "The app is not loading correctly.",
    a: "Try a hard refresh (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac). If the issue continues, clearing site data for lifeplanner.app in your browser settings usually resolves it.",
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
