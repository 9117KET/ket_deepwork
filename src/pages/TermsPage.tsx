/**
 * pages/TermsPage.tsx
 *
 * Terms of Service for Life Planner.
 */

import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";

export function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mb-10 text-sm text-share-onSurfaceVariant">
          Last updated: April 2026 &nbsp;·&nbsp; Life Planner by KET Foundation / Kinlo Ephriam Tangiri
        </p>

        <div className="space-y-10 text-share-onSurfaceVariant [&_h2]:mb-3 [&_h2]:font-shareHeadline [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-share-onSurface [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:list-disc">

          <section>
            <h2>1. Acceptance</h2>
            <p>
              By using Life Planner ("the Service"), you agree to these Terms of Service. The Service is operated by <strong className="text-share-onSurface">Kinlo Ephriam Tangiri (KET Foundation)</strong>, Germany. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of service</h2>
            <p>
              Life Planner is a productivity web application that provides a day planner, deep work timer, habit and sleep tracker, travel planner, financial planner, and optional Google Calendar sync. Guest use (without an account) stores data locally in your browser. Signed-in use additionally syncs data to our servers.
            </p>
          </section>

          <section>
            <h2>3. Eligibility</h2>
            <p>
              You must be at least 16 years old to create an account (13 if outside the EU). By registering, you confirm you meet this requirement.
            </p>
          </section>

          <section>
            <h2>4. Your account</h2>
            <ul>
              <li>You are responsible for keeping your login credentials secure.</li>
              <li>You must not share your account with others or use another person's account.</li>
              <li>You must provide a valid email address when registering.</li>
              <li>You may delete your account at any time by contacting us at <a href="mailto:kinlotangir1@gmail.com" className="text-share-primary underline">kinlotangir1@gmail.com</a>.</li>
            </ul>
          </section>

          <section>
            <h2>5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to other users' data.</li>
              <li>Reverse-engineer, scrape, or abuse the API.</li>
              <li>Upload content that is illegal, harmful, or infringes third-party rights.</li>
              <li>Use the share feature to distribute malicious or misleading content.</li>
            </ul>
          </section>

          <section>
            <h2>6. Your data</h2>
            <p>
              You own the data you enter into Life Planner. We do not claim any rights over your tasks, notes, or personal entries. See our <Link to="/privacy" className="text-share-primary underline">Privacy Policy</Link> for details on how we store and handle your data.
            </p>
          </section>

          <section>
            <h2>7. Google Calendar integration</h2>
            <p>
              If you connect Google Calendar, you authorize Life Planner to read and write events on your behalf using Google's OAuth 2.0 flow. You may revoke this access at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-share-primary underline">Google Account settings</a>. We store OAuth tokens server-side solely to perform sync operations you initiate.
            </p>
          </section>

          <section>
            <h2>8. Sharing</h2>
            <p>
              When you share your planner via a link, anyone with that link can view or edit your planner (depending on the permission you set). You are responsible for managing your share links. Revoke access at any time from within the app.
            </p>
          </section>

          <section>
            <h2>9. Availability and changes</h2>
            <p>
              We aim to keep Life Planner available but do not guarantee uninterrupted service. We may modify, suspend, or discontinue features at any time. We will give reasonable notice for significant changes where possible.
            </p>
          </section>

          <section>
            <h2>10. Disclaimer of warranties</h2>
            <p>
              The Service is provided "as is" without warranty of any kind. We do not warrant that the Service will be error-free, secure, or always available. Use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2>11. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by German law, Kinlo Ephriam Tangiri / KET Foundation shall not be liable for indirect, incidental, or consequential damages arising from your use of the Service, including loss of data. Our total liability shall not exceed €100.
            </p>
          </section>

          <section>
            <h2>12. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Germany. Disputes shall be subject to the exclusive jurisdiction of the courts in Germany, unless mandatory consumer protection laws in your country of residence provide otherwise.
            </p>
          </section>

          <section>
            <h2>13. Changes to these terms</h2>
            <p>
              We may update these Terms. We will notify you of material changes via the app or email. Continued use after the effective date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2>14. Contact</h2>
            <p>
              Questions about these Terms:{" "}
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
