/**
 * pages/PlannerPage.tsx
 *
 * Wrapper for the Day Planner: requires auth or guest; renders header, DayPlanner, and modals.
 * Includes nav links to Home, Travel, and Finance.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DayPlanner } from "../components/planner/DayPlanner";
import { HelpModal } from "../components/HelpModal";
import { OnboardingTour } from "../components/OnboardingTour";
import { getTourCompleted } from "../utils/tourStorage";
import { useAuth } from "../contexts/AuthContext";
import { LoginForm } from "../components/auth/LoginForm";
import { ShareModal } from "../components/sharing/ShareModal";
import { AccountMenu } from "../components/nav/AccountMenu";

export function PlannerPage() {
  const { user, loading, signOut } = useAuth();
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
      <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading your workspace...</p>
      </div>
    );
  }

  if (!showPlanner) {
    return <LoginForm onContinueAsGuest={() => setGuest(true)} />;
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Life Planner
              </h1>
              <p className="text-sm text-slate-400">Daily focus hub.</p>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                to="/"
                className="rounded px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Home
              </Link>
              <Link
                to="/travel"
                className="rounded px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Travel
              </Link>
              <Link
                to="/finance"
                className="rounded px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Finance
              </Link>
            </nav>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="flex items-center gap-3">
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
            </div>
          </div>
        </header>
        <DayPlanner />
      </div>
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
    </div>
  );
}
