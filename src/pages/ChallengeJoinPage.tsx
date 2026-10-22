/**
 * pages/ChallengeJoinPage.tsx
 *
 * /challenge/join?invite=TOKEN — what the friend opens. The token is kept in
 * sessionStorage so it survives signing up, which sends the visitor through
 * the sign-in form once more. `?invite=` rather than `?code=`: Convex Auth
 * intercepts the latter (see main.tsx).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppChrome } from "../components/layout/AppChrome";
import { LoginForm } from "../components/auth/LoginForm";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { useAuth } from "../contexts/AuthContext";
import { useChallenge } from "../hooks/useChallenge";
import { acceptInvite, challengeErrorMessage } from "../services/challengeService";

const INVITE_KEY = "deepblock_challenge_invite";

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(INVITE_KEY, token);
    else window.sessionStorage.removeItem(INVITE_KEY);
  } catch {
    // Storage blocked: the token in the URL still works for this visit.
  }
}

export function ChallengeJoinPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("invite")?.trim() || readStoredToken(), [searchParams]);
  useEffect(() => {
    const fromUrl = searchParams.get("invite")?.trim();
    if (fromUrl) storeToken(fromUrl);
  }, [searchParams]);

  const preview = useQuery(api.challenges.invitePreview, token ? { token } : "skip");
  const mine = useChallenge();
  const [typedName, setTypedName] = useState<string | null>(null);
  const displayName = typedName ?? (user?.email?.split("@")[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token, displayName);
      storeToken(null);
      navigate("/challenge", { replace: true });
    } catch (err) {
      setError(challengeErrorMessage(err));
      setBusy(false);
    }
  };

  const card = "mx-auto w-full max-w-md rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainer p-5";

  let body: React.ReactNode;
  if (!token) {
    body = (
      <div className={card}>
        <h1 className="font-shareHeadline text-lg font-black text-share-onBg">No invite here</h1>
        <p className="mt-1 text-sm text-share-onSurfaceVariant">The link is missing its invite code. Ask your partner to send it again.</p>
        <Link to="/challenge" className="mt-3 inline-block text-sm font-semibold text-share-primary hover:underline">
          Go to Challenge
        </Link>
      </div>
    );
  } else if (preview === undefined || loading) {
    body = <p className="text-center text-sm text-share-onSurfaceVariant">Checking the invite…</p>;
  } else if (preview.status !== "ok") {
    const reason = {
      notFound: "This invite link is not valid.",
      expired: "This invite has expired. Ask your partner for a new link.",
      used: "This invite has already been used.",
      full: "This challenge already has two members.",
      ended: "This challenge has ended.",
    }[preview.status];
    body = (
      <div className={card}>
        <h1 className="font-shareHeadline text-lg font-black text-share-onBg">{preview.challenge?.name ?? "Invite"}</h1>
        <p className="mt-1 text-sm text-share-onSurfaceVariant">{reason}</p>
        <Link to="/challenge" className="mt-3 inline-block text-sm font-semibold text-share-primary hover:underline">
          Go to Challenge
        </Link>
      </div>
    );
  } else {
    const header = (
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-share-onSurfaceVariant">
          {preview.inviterName ? `${preview.inviterName} invited you` : "You are invited"}
        </p>
        <h1 className="mt-1 font-shareHeadline text-xl font-black text-share-onBg">{preview.challenge!.name}</h1>
        <p className="mt-0.5 text-xs text-share-onSurfaceVariant">
          {preview.challenge!.startDate} → {preview.challenge!.endDate}
        </p>
      </div>
    );
    if (!user) {
      body = (
        <div className="mx-auto w-full max-w-md">
          {header}
          <LoginForm title="Join the challenge" subtitle="Create an account or sign in. You will come straight back here." />
        </div>
      );
    } else if (mine.status === "active") {
      body = (
        <div className={card}>
          {header}
          <p className="text-sm text-share-onSurfaceVariant">You are already in a challenge. Leave it first if you want to join this one.</p>
          <Link to="/challenge" className="mt-3 inline-block text-sm font-semibold text-share-primary hover:underline">
            Open my challenge
          </Link>
        </div>
      );
    } else {
      body = (
        <form onSubmit={(e) => void join(e)} className={card}>
          {header}
          <label htmlFor="join-name" className="block text-xs font-medium text-share-onSurfaceVariant">
            Your name, as your partner sees it
          </label>
          <input
            id="join-name"
            value={displayName}
            onChange={(e) => setTypedName(e.target.value)}
            maxLength={40}
            required
            className="mt-1 w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 py-2 text-sm text-share-onSurface focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
          />
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="touch-target mt-4 w-full rounded-lg bg-share-primary px-3 py-2 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer disabled:opacity-60">
            {busy ? "Joining…" : `Join as ${user.email ?? "me"}`}
          </button>
        </form>
      );
    }
  }

  return (
    <AppChrome showCalendarLink={Boolean(user)} showChallengeLink={Boolean(user)}>
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 pt-8 pb-24 md:pb-8">{body}</div>
      <MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
    </AppChrome>
  );
}
