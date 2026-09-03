/**
 * pages/PlannerPage.tsx
 *
 * Wrapper for the Day Planner: requires auth or guest; AppChrome + DayPlanner + modals.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { DayPlanner } from "../components/planner/DayPlanner";
import { HelpModal } from "../components/HelpModal";
import { OnboardingTour } from "../components/OnboardingTour";
import { getTourCompleted } from "../utils/tourStorage";
import { useAuth } from "../contexts/AuthContext";
import { isGuestSession, markGuestSession } from "../storage/guestSession";
import { LoginForm } from "../components/auth/LoginForm";
import { ShareModal } from "../components/sharing/ShareModal";
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);

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

  // Both used to scroll to elements rendered under the day. Those live at
  // /planner/review now, so these navigate instead of hunting for an id.
  const handleOpenDashboard = useCallback(() => navigate("/planner/review"), [navigate]);
  const handleOpenTracking = useCallback(() => navigate("/planner/review"), [navigate]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted && !getTourCompleted()) setTourActive(true);
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <AppChrome mobileActive="planner" showMobileNav={false}>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </AppChrome>
    );
  }

  if (!showPlanner) {
    return (
      <AppChrome mobileActive="planner" showMobileNav={false}>
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4">
          <LoginForm onContinueAsGuest={() => startTransition(continueAsGuest)} />
        </div>
      </AppChrome>
    );
  }

  return (
    <>
      <AppChrome
        mobileActive="planner"
        showMobileNav={false}
        showCalendarLink={isAuthenticated}
        showHelp
        onHelpClick={() => setHelpOpen(true)}
        trailing={
          <AccountMenu
            dropUp
            userInitial={userInitial}
            userEmail={user?.email}
            items={[
              {
                kind: "action",
                key: "help",
                label: "Help & tips",
                onSelect: () => setHelpOpen(true),
              },
              { kind: "separator", key: "sep-1" },
              {
                kind: "action",
                key: "progress",
                label: "Progress dashboard",
                onSelect: handleOpenDashboard,
              },
              {
                kind: "action",
                key: "monthly",
                label: "Monthly tracker",
                onSelect: handleOpenTracking,
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
                key: "sep-2",
                hidden: !isAuthenticated,
              },
              {
                kind: "action",
                key: "share",
                label: "Share…",
                onSelect: () => setShareOpen(true),
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
          <DayPlanner stickyTopClass="top-0" />
        </div>
      </AppChrome>
      <HelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setHelpOpen(false);
          setTourActive(true);
        }}
      />
      <OnboardingTour
        isActive={tourActive}
        onComplete={() => setTourActive(false)}
      />
      {isAuthenticated && user && (
        <ShareModal
          userId={user.id}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
