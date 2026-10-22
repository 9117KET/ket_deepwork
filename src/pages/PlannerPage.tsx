/**
 * pages/PlannerPage.tsx
 *
 * Wrapper for the Day Planner: requires auth or guest; AppChrome + DayPlanner.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { DayPlanner } from "../components/planner/DayPlanner";
import { useAuth } from "../contexts/AuthContext";
import { isGuestSession, markGuestSession } from "../storage/guestSession";
import { LoginForm } from "../components/auth/LoginForm";
import { AccountMenu } from "../components/nav/AccountMenu";
import { AppChrome } from "../components/layout/AppChrome";

export function PlannerPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  /**
   * "Continue as guest" survives navigation within the session.
   *
   * It used to be plain component state, which was invisible while the planner
   * was the only route a guest could reach. Now that Review is its own route
   * and the phone's tab bar moves between the two, a guest tapping Today from
   * Review unmounted this page and landed back on the sign-in form having
   * already answered it. Session scope, not local: choosing to stay signed out
   * is a choice about this visit, not a durable account setting.
   */
  const [guest, setGuest] = useState(isGuestSession);
  const continueAsGuest = useCallback(() => {
    markGuestSession();
    setGuest(true);
  }, []);
  const [, startTransition] = useTransition();

  const isAuthenticated = Boolean(user);
  const showPlanner = isAuthenticated || guest;

  const userInitial = useMemo(() => {
    const email = user?.email ?? "";
    const firstChar = email.trim().charAt(0);
    return firstChar ? firstChar.toUpperCase() : "U";
  }, [user]);

  const handleSignOut = async () => {
    const error = await signOut();
    if (error) console.error("[auth] Failed to sign out", error);
  };

  if (loading) {
    return (
      <AppChrome>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </AppChrome>
    );
  }

  if (!showPlanner) {
    return (
      <AppChrome>
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4">
          <LoginForm onContinueAsGuest={() => startTransition(continueAsGuest)} />
        </div>
      </AppChrome>
    );
  }

  return (
    <AppChrome
      showCalendarLink={isAuthenticated}
      showChallengeLink={isAuthenticated}
      trailing={
        <AccountMenu
          dropUp
          userInitial={userInitial}
          userEmail={user?.email}
          items={[
            {
              kind: "action",
              key: "review",
              label: "Review",
              onSelect: () => navigate("/review"),
            },
            {
              kind: "action",
              key: "challenge",
              label: "Challenge",
              onSelect: () => navigate("/challenge"),
              hidden: !isAuthenticated,
            },
            {
              kind: "action",
              key: "calendar",
              label: "Calendar sync",
              onSelect: () => navigate("/calendar"),
              hidden: !isAuthenticated,
            },
            {
              kind: "separator",
              key: "sep-1",
              hidden: !isAuthenticated,
            },
            {
              kind: "action",
              key: "signout",
              label: "Sign out",
              onSelect: handleSignOut,
              hidden: !isAuthenticated,
              muted: true,
            },
          ]}
        />
      }
    >
      <div className="px-4 pt-4 pb-20 md:px-6 md:pt-5 md:pb-8">
        <DayPlanner />
      </div>
    </AppChrome>
  );
}
