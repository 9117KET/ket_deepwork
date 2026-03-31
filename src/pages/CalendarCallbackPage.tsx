/**
 * pages/CalendarCallbackPage.tsx
 *
 * OAuth callback landing page.
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { completeGoogleOAuth } from "../services/calendarSyncService";
import { AppChrome } from "../components/layout/AppChrome";

export function CalendarCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "error">(() => {
    const params = new URLSearchParams(location.search);
    return params.get("error") || !params.get("code") ? "error" : "working";
  });
  const [message, setMessage] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get("error");
    if (error) return error;
    if (!params.get("code")) return "Missing OAuth code.";
    return "";
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) return;

    (async () => {
      try {
        await completeGoogleOAuth(code);
        setStatus("ok");
        setMessage("Google Calendar connected.");
        setTimeout(() => navigate("/calendar"), 800);
      } catch (e) {
        setStatus("error");
        setMessage((e as Error).message ?? "Failed to connect.");
      }
    })();
  }, [location.search, navigate]);

  return (
    <AppChrome
      headerPositionClass="top-0"
      mobileActive="planner"
      maxWidthClass="max-w-xl"
      showCalendarLink
    >
      <h1 className="font-shareHeadline text-2xl font-black text-share-onSurface">Calendar connection</h1>
      <p className="mt-2 text-share-onSurfaceVariant">
        {status === "working"
          ? "Finalizing connection…"
          : status === "ok"
            ? message
            : `Failed: ${message}`}
      </p>
      <div className="mt-6">
        <Link
          to="/calendar"
          className="text-sm font-bold text-share-primary hover:text-share-primaryContainer"
        >
          Go to Calendar sync
        </Link>
      </div>
    </AppChrome>
  );
}
