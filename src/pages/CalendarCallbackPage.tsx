/**
 * pages/CalendarCallbackPage.tsx
 *
 * Where Google sends the user back after the calendar consent screen.
 *
 * Two things have to be true before the code is exchanged, or the exchange
 * runs as an anonymous caller and fails with "Not authenticated":
 *  - sign-in has been restored (the token comes back asynchronously on load);
 *  - the code is exchanged once. Google's codes are single-use, and React's
 *    StrictMode runs effects twice in development, so a second exchange
 *    would fail and could overwrite a success with an error.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { checkOAuthState, completeGoogleOAuth } from "../services/calendarSyncService";
import { AppChrome } from "../components/layout/AppChrome";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { useAuth } from "../contexts/AuthContext";

export function CalendarCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const exchanged = useRef(false);

  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const googleError = params.get("error");

  // The CSRF check needs nobody signed in, so a forged callback fails at once.
  const csrfError = useMemo(() => {
    if (!code || googleError) return null;
    try {
      checkOAuthState(new URLSearchParams(location.search).get("state") ?? undefined);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [code, googleError, location.search]);

  const [result, setResult] = useState<{ status: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!code || googleError || csrfError || loading || !user || exchanged.current) return;
    exchanged.current = true;
    const returnedState = new URLSearchParams(location.search).get("state") ?? undefined;
    completeGoogleOAuth(code, returnedState).then(
      () => {
        setResult({ status: "ok", message: "Google Calendar connected." });
        setTimeout(() => navigate("/calendar"), 800);
      },
      (e: Error) => setResult({ status: "error", message: e.message ?? "Failed to connect." }),
    );
  }, [code, googleError, csrfError, loading, user, location.search, navigate]);

  const text = googleError
    ? `Failed: ${googleError}`
    : !code
      ? "Failed: Missing OAuth code."
      : csrfError
        ? `Failed: ${csrfError}`
        : !loading && !user
          ? "Failed: you are signed out. Sign in, then connect the calendar again."
          : result
            ? result.status === "ok"
              ? result.message
              : `Failed: ${result.message}`
            : "Finalizing connection…";

  return (
    <AppChrome showCalendarLink>
      <div className="mx-auto max-w-xl px-4 py-6 md:px-8 pb-28 md:pb-10">
        <h1 className="font-shareHeadline text-2xl font-black text-share-onSurface">Calendar connection</h1>
        <p className="mt-2 text-share-onSurfaceVariant">{text}</p>
        <div className="mt-6">
          <Link
            to="/calendar"
            className="text-sm font-bold text-share-primary hover:text-share-primaryContainer"
          >
            Go to Calendar
          </Link>
        </div>
      </div>
      <MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
    </AppChrome>
  );
}
