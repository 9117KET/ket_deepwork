/**
 * pages/PrivacyPage.tsx
 *
 * Privacy Policy. Also the privacy URL on the Google OAuth consent screen,
 * which is why it describes exactly what is done with calendar data.
 */

import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";

export function PrivacyPage() {
  return (
    <AppChrome hideSidebar>
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 pb-32 md:pb-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-share-onSurfaceVariant hover:text-share-onSurface"
        >
          ← Back to Deepblock
        </Link>

        <h1 className="mb-2 font-shareHeadline text-4xl font-black text-share-onSurface">
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm text-share-onSurfaceVariant">
          Last updated: October 2026 &nbsp;·&nbsp; Deepblock by KET Foundation / Kinlo Ephriam Tangiri
        </p>

        <div className="space-y-10 text-share-onSurfaceVariant [&_h2]:mb-3 [&_h2]:font-shareHeadline [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-share-onSurface [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:list-disc">

          <section>
            <h2>1. Who we are</h2>
            <p>
              Deepblock is operated by <strong className="text-share-onSurface">Kinlo Ephriam Tangiri (KET Foundation)</strong>, based in Germany. If you have any questions about this policy, contact us at{" "}
              <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
                kinlotangir1@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2>2. What data we collect</h2>
            <p>We collect only what is necessary to provide the service:</p>
            <ul>
              <li><strong className="text-share-onSurface">Account data</strong> — email address and hashed password, stored via Convex Auth.</li>
              <li><strong className="text-share-onSurface">Planner data</strong> — tasks, deep work sessions, sleep hours, wake/sleep times, mood entries, and habit completions you enter into the app.</li>
              <li><strong className="text-share-onSurface">Settings</strong> — habit definitions, focus block length, weekly goal, and streak history.</li>
              <li><strong className="text-share-onSurface">Google Calendar tokens</strong> — if you connect Google Calendar, OAuth tokens are stored server-side in our database and are never exposed to the browser. They are encrypted at rest and used only as described in "Google user data" below.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-share-onSurface">not</strong> collect payment information, device identifiers, advertising IDs, or browsing history.
            </p>
          </section>

          <section>
            <h2>3. How we use your data</h2>
            <ul>
              <li>To sync your planner across devices when you are signed in.</li>
              <li>To display your tasks, habits, sleep, and deep work history.</li>
              <li>To show your calendar, schedule tasks into it, and keep your tasks in step with Google Tasks, if you connect Google Calendar.</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your data with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2>Google user data</h2>
            <p>If you connect Google Calendar, Deepblock uses that access only to:</p>
            <ul>
              <li><strong className="text-share-onSurface">Read</strong> the events of the calendar you chose (your primary calendar unless you pick another) to show them beside your tasks. Events are not stored on our servers; the app keeps a short-lived copy on your device so it loads quickly.</li>
              <li><strong className="text-share-onSurface">Read free/busy</strong> times when you ask it to find a slot for a task.</li>
              <li><strong className="text-share-onSurface">Create, move or delete</strong> an event when you schedule, reschedule or unschedule a task, with a reminder.</li>
              <li><strong className="text-share-onSurface">Create one calendar</strong> named &ldquo;Deepblock log&rdquo; and add an event for each focus block you finish on the timer.</li>
              <li><strong className="text-share-onSurface">Create, update and delete Google Tasks</strong> in a task list named &ldquo;Deepblock&rdquo;: one per planner task, due on its day, with its title and done state kept the same in both directions. Deleting a task in the planner removes it from that list; deleting it in Google only stops the mirroring. No other task list is read or changed.</li>
            </ul>
            <p className="mt-3">
              Deepblock&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-share-primary underline" target="_blank" rel="noreferrer">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Google user data is never sold, used for advertising, or shared with anyone else. Disconnecting in the app revokes the access token at Google and deletes it from our database.
            </p>
          </section>

          <section>
            <h2>4. Data storage and security</h2>
            <p>
              Your data is stored in a Convex database. Server-side authorization ensures each user can only access their own data. Data in transit is encrypted via TLS. Google Calendar tokens are stored server-side and never transmitted to your browser.
            </p>
          </section>

          <section>
            <h2>5. Data retention</h2>
            <p>
              Your data is retained for as long as your account exists. If you delete your account, all associated planner data, settings, and tokens are permanently deleted via cascading database rules. You may request deletion at any time by emailing{" "}
              <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
                kinlotangir1@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2>6. Your rights (GDPR)</h2>
            <p>As a user based in or accessing the service from the EU, you have the right to:</p>
            <ul>
              <li><strong className="text-share-onSurface">Access</strong> — request a copy of the data we hold about you.</li>
              <li><strong className="text-share-onSurface">Rectification</strong> — correct inaccurate data.</li>
              <li><strong className="text-share-onSurface">Erasure</strong> — request deletion of your data ("right to be forgotten").</li>
              <li><strong className="text-share-onSurface">Portability</strong> — receive your data in a structured, machine-readable format.</li>
              <li><strong className="text-share-onSurface">Objection</strong> — object to processing based on legitimate interests.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
                kinlotangir1@gmail.com
              </a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2>7. Cookies and local storage</h2>
            <p>
              Deepblock uses browser <strong className="text-share-onSurface">localStorage</strong> to cache your planner state locally so the app works offline and loads instantly. No third-party cookies or tracking scripts are used.
            </p>
          </section>

          <section>
            <h2>8. Third-party services</h2>
            <ul>
              <li><strong className="text-share-onSurface">Convex</strong> — database, authentication, and real-time sync. <a href="https://www.convex.dev/privacy" className="text-share-primary underline" target="_blank" rel="noreferrer">Convex Privacy Policy</a>.</li>
              <li><strong className="text-share-onSurface">Google</strong> — only if you connect Google Calendar. <a href="https://policies.google.com/privacy" className="text-share-primary underline" target="_blank" rel="noreferrer">Google Privacy Policy</a>.</li>
            </ul>
          </section>

          <section>
            <h2>9. Changes to this policy</h2>
            <p>
              We may update this policy as the app evolves. Material changes will be communicated via the app or by email. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>
              Questions or requests:{" "}
              <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
                kinlotangir1@gmail.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </AppChrome>
  );
}
