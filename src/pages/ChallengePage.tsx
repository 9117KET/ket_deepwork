/**
 * pages/ChallengePage.tsx
 *
 * /challenge — start or join one when you are in none; the dashboard when
 * you are. Signed-out visitors get the sign-in form: a challenge needs an
 * account on both sides, because the partner's view and the reminders both
 * hang off it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { AccountMenu } from "../components/nav/AccountMenu";
import { LoginForm } from "../components/auth/LoginForm";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { ChallengeCard } from "../components/challenge/ChallengeCard";
import { ChallengeCreateForm } from "../components/challenge/ChallengeCreateForm";
import { ChallengeDashboard } from "../components/challenge/ChallengeDashboard";
import { ChallengeJoinPanel } from "../components/challenge/ChallengeJoinPanel";
import { CheckinSheet } from "../components/challenge/CheckinSheet";
import { useAuth } from "../contexts/AuthContext";
import { buildChallengeSummary } from "../domain/challenge";
import { DEFAULT_HABIT_DEFINITIONS } from "../domain/types";
import { useChallenge } from "../hooks/useChallenge";
import { usePersistentState } from "../storage/localStorageState";

export function ChallengePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [appState, , isHydrating] = usePersistentState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const state = useChallenge(now);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const habits = appState.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS;
  const summary = useMemo(() => buildChallengeSummary(appState.days[state.myDate], habits), [appState.days, state.myDate, habits]);

  const userInitial = useMemo(() => {
    const firstChar = (user?.email ?? "").trim().charAt(0);
    return firstChar ? firstChar.toUpperCase() : "U";
  }, [user]);
  const handleSignOut = useCallback(async () => {
    const error = await signOut();
    if (error) console.error("[auth] Failed to sign out", error);
  }, [signOut]);

  const trailing = (
    <AccountMenu
      dropUp
      userInitial={userInitial}
      userEmail={user?.email}
      items={[
        { kind: "action", key: "planner", label: "Back to today", onSelect: () => navigate("/") },
        { kind: "action", key: "review", label: "Review", onSelect: () => navigate("/review") },
        { kind: "separator", key: "sep-1", hidden: !user },
        { kind: "action", key: "signout", label: "Sign out", onSelect: () => void handleSignOut(), muted: true, hidden: !user },
      ]}
    />
  );

  const tabBar = <MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />;

  if (loading) {
    return (
      <AppChrome showCalendarLink={Boolean(user)} showChallengeLink={Boolean(user)} trailing={trailing}>
        <div className="flex min-h-[50vh] items-center justify-center text-share-onSurfaceVariant">
          <p className="text-sm">Loading…</p>
        </div>
        {tabBar}
      </AppChrome>
    );
  }

  if (!user) {
    return (
      <AppChrome trailing={trailing}>
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 pb-24">
          <LoginForm title="Challenge a friend" subtitle="Sign in to start or join an accountability challenge." />
        </div>
        {tabBar}
      </AppChrome>
    );
  }

  const defaultDisplayName = (user.email ?? "").split("@")[0] || "Me";

  return (
    <AppChrome showCalendarLink showChallengeLink trailing={trailing}>
      <div className="mx-auto max-w-xl px-4 py-5 pb-28 md:py-8 md:pb-10">
        <header>
          <h1 className="font-shareHeadline text-lg font-black text-share-onBg">Challenge</h1>
          <p className="text-xs text-share-onSurfaceVariant">Two people, one season, a plan every morning and a check-in every night.</p>
        </header>
        <div className="mt-5">
          {state.status === "loading" || isHydrating ? (
            <p className="text-sm text-share-onSurfaceVariant">Loading…</p>
          ) : state.status === "none" ? (
            <div className="space-y-4">
              <ChallengeJoinPanel />
              <ChallengeCreateForm defaultDisplayName={defaultDisplayName} />
            </div>
          ) : (
            <div className="space-y-4">
              <ChallengeCard state={state} summary={summary} date={state.myDate} onOpenCheckin={() => setCheckinOpen(true)} compact />
              <ChallengeDashboard state={state} />
            </div>
          )}
        </div>
      </div>
      {checkinOpen && state.info && state.progress && (
        <CheckinSheet
          challengeName={state.info.challenge.name}
          donts={state.info.challenge.donts}
          displayName={state.info.me.displayName}
          progress={state.progress}
          date={state.myDate}
          summary={summary}
          existing={state.mine}
          onClose={() => setCheckinOpen(false)}
        />
      )}
      {tabBar}
    </AppChrome>
  );
}
