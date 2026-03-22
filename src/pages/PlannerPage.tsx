/**
 * pages/PlannerPage.tsx
 *
 * Wrapper for the Day Planner: requires auth or guest; AppChrome + DayPlanner + modals.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DayPlanner } from "../components/planner/DayPlanner";
import { HelpModal } from "../components/HelpModal";
import { OnboardingTour } from "../components/OnboardingTour";
import { getTourCompleted } from "../utils/tourStorage";
import { useAuth } from "../contexts/AuthContext";
import { LoginForm } from "../components/auth/LoginForm";
import { ShareModal } from "../components/sharing/ShareModal";
import { AccountMenu } from "../components/nav/AccountMenu";
import { AppChrome } from "../components/layout/AppChrome";

export function PlannerPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [guest, setGuest] = useState(false);
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

  const handleOpenDashboard = useCallback(() => {
    const el = document.getElementById("progress-dashboard");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleOpenTracking = useCallback(() => {
    const el = document.getElementById("tracking-dashboard");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (!getTourCompleted()) setTourActive(true);
    });
  }, []);

  if (loading) {
    return (
      <AppChrome headerPositionClass="top-0" mobileActive="planner" showMobileNav={false}>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </AppChrome>
    );
  }

  if (!showPlanner) {
    return (
      <AppChrome headerPositionClass="top-0" mobileActive="planner" showMobileNav={false}>
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
          <LoginForm onContinueAsGuest={() => setGuest(true)} />
        </div>
      </AppChrome>
    );
  }

  return (
    <>
      <AppChrome
        headerPositionClass="top-0"
        mobileActive="planner"
        maxWidthClass="max-w-[1600px]"
        showCalendarLink={isAuthenticated}
        showHelp
        onHelpClick={() => setHelpOpen(true)}
        trailing={
          <AccountMenu
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
        <DayPlanner stickyTopClass="top-16" />
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
