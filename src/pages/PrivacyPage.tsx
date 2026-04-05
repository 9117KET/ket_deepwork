/**
 * pages/PrivacyPage.tsx
 *
 * Privacy Policy for Life Planner.
 */

import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";

export function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm text-share-onSurfaceVariant">
          Last updated: April 2026 &nbsp;·&nbsp; Life Planner by KET Foundation / Kinlo Ephriam Tangiri
        </p>

        <div className="space-y-10 text-share-onSurfaceVariant [&_h2]:mb-3 [&_h2]:font-shareHeadline [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-share-onSurface [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:list-disc">

          <section>
            <h2>1. Who we are</h2>
            <p>
              Life Planner is operated by <strong className="text-share-onSurface">Kinlo Ephriam Tangiri (KET Foundation)</strong>, based in Germany. If you have any questions about this policy, contact us at{" "}
              <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">
                kinlotangir1@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2>2. What data we collect</h2>
            <p>We collect only what is necessary to provide the service:</p>
            <ul>
              <li><strong className="text-share-onSurface">Account data</strong> — email address and hashed password, stored via Supabase Auth.</li>
              <li><strong className="text-share-onSurface">Planner data</strong> — tasks, deep work sessions, sleep hours, wake/sleep times, mood entries, and habit completions you enter into the app.</li>
              <li><strong className="text-share-onSurface">Settings</strong> — habit definitions, month titles, block duration preferences, and streak history.</li>
              <li><strong className="text-share-onSurface">Google Calendar tokens</strong> — if you connect Google Calendar, OAuth tokens are stored server-side in our database and are never exposed to the browser. We use them solely to read and write calendar events on your behalf.</li>
              <li><strong className="text-share-onSurface">Share tokens</strong> — if you share your planner, a token and permission level (view/edit) are stored to allow access.</li>
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
              <li>To enable Google Calendar sync when you choose to connect it.</li>
              <li>To allow you to share your planner with others via a link.</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your data with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2>4. Data storage and security</h2>
            <p>
              Your data is stored in a Supabase (PostgreSQL) database hosted on infrastructure in the EU. Row-level security (RLS) policies ensure each user can only access their own data. Data in transit is encrypted via TLS. Google Calendar tokens are stored server-side and never transmitted to your browser.
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
              Life Planner uses browser <strong className="text-share-onSurface">localStorage</strong> to cache your planner state locally so the app works offline and loads instantly. No third-party cookies or tracking scripts are used.
            </p>
          </section>

          <section>
            <h2>8. Third-party services</h2>
            <ul>
              <li><strong className="text-share-onSurface">Supabase</strong> — database, authentication, and real-time sync. <a href="https://supabase.com/privacy" className="text-share-primary underline" target="_blank" rel="noreferrer">Supabase Privacy Policy</a>.</li>
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
