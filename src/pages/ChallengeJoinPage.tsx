/**
 * pages/ChallengeJoinPage.tsx
 *
 * /challenge/join?invite=TOKEN — what the friend opens. The token is kept in
 * sessionStorage so it survives signing up, which sends the visitor through
 * the sign-in form once more. `?invite=` rather than `?code=`: Convex Auth
 * intercepts the latter (see main.tsx).
 *
 * Being in other challenges does not stand in the way: a person can be in
 * several at once. Joining opens the challenge's own dashboard.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppChrome } from "../components/layout/AppChrome";
import { LoginForm } from "../components/auth/LoginForm";
import { MobileTabBar } from "../components/planner/MobileTabBar";
import { ErrorLine } from "../components/ui/Notices";
import { textButtonClass } from "../components/ui/textButtonClass";
import { useAuth } from "../contexts/AuthContext";
import { acceptInvite, challengeErrorMessage } from "../services/challengeService";
import { ListEditor } from "../components/challenge/ListEditor";
import { formatShortDate } from "../domain/challenge";
import { rowsToTexts, withDraft, type CommitmentRow } from "../domain/challengeCommitments";
import { MAX_MEMBERS } from "../../convex/_shared/challengeGroup";

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

const FIELD =
  "min-h-11 w-full rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg sm:text-sm";
const PRIMARY =
  "touch-target mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-share-primary px-4 text-body font-bold text-share-onPrimary transition-colors hover:bg-share-primaryContainer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg focus-visible:ring-offset-2 focus-visible:ring-offset-share-bg disabled:opacity-60";

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
  // A preview that can never become a join (or already is one) ends the
  // token's life; otherwise it resurfaces on a bare /challenge/join later.
  const previewStatus = preview?.status;
  useEffect(() => {
    if (previewStatus && previewStatus !== "ok") storeToken(null);
  }, [previewStatus]);
  const [typedName, setTypedName] = useState<string | null>(null);
  // The server allows 40 characters; a long email prefix must not exceed it.
  const displayName = typedName ?? (user?.email?.split("@")[0] ?? "").slice(0, 40);
  const [goals, setGoals] = useState<CommitmentRow[]>([]);
  const [donts, setDonts] = useState<CommitmentRow[]>([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [dontDraft, setDontDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const challengeId = await acceptInvite(token, displayName, rowsToTexts(withDraft(goals, goalDraft)), rowsToTexts(withDraft(donts, dontDraft)));
      storeToken(null);
      navigate(`/challenge/${challengeId}`, { replace: true });
    } catch (err) {
      setError(challengeErrorMessage(err));
      setBusy(false);
    }
  };

  const column = "mx-auto w-full max-w-md";
  const back = textButtonClass("default", "-ml-3 mt-3");

  let body: ReactNode;
  if (!token) {
    body = (
      <div className={column}>
        <h1 className="font-shareHeadline text-title text-share-onBg">No invite here</h1>
        <p className="mt-2 text-body text-share-onSurfaceVariant">The link is missing its invite code. Ask whoever invited you to send it again.</p>
        <Link to="/challenge" className={back}>
          See your challenges
        </Link>
      </div>
    );
  } else if (preview === undefined || loading) {
    body = (
      <p className="text-center text-sm text-share-onSurfaceVariant" role="status">
        Checking the invite…
      </p>
    );
  } else if (preview.status === "member") {
    body = (
      <div className={column}>
        <h1 className="font-shareHeadline text-title text-share-onBg">{preview.challenge?.name ?? "Challenge"}</h1>
        <p className="mt-2 text-body text-share-onSurfaceVariant">You are already in this challenge.</p>
        <Link to={`/challenge/${preview.challengeId}`} className={back}>
          Open challenge
        </Link>
      </div>
    );
  } else if (preview.status !== "ok") {
    const reason = {
      notFound: "This invite link is not valid.",
      expired: "This invite has expired. Ask whoever invited you for a new link.",
      used: "This invite has already been used.",
      full: `This challenge is full (${preview.capacity ?? MAX_MEMBERS} members).`,
      ended: "This challenge has ended.",
    }[preview.status];
    body = (
      <div className={column}>
        <h1 className="font-shareHeadline text-title text-share-onBg">{preview.challenge?.name ?? "Invite"}</h1>
        <p className="mt-2 text-body text-share-onSurfaceVariant">{reason}</p>
        <Link to="/challenge" className={back}>
          See your challenges
        </Link>
      </div>
    );
  } else {
    const c = preview.challenge!;
    const header = (
      <div className="mb-6">
        <p className="text-sm text-share-onSurfaceVariant">{preview.inviterName ? `${preview.inviterName} invited you to` : "You are invited to"}</p>
        <h1 className="mt-1 font-shareHeadline text-title text-share-onBg">{c.name}</h1>
        <p className="mt-1 text-sm text-share-onSurfaceVariant">
          {formatShortDate(c.startDate)} to {formatShortDate(c.endDate)}
        </p>
        {(preview.inviterGoals.length > 0 || preview.inviterDonts.length > 0) && (
          <div className="mt-4 space-y-3 border-y border-share-hairline py-3">
            {preview.inviterGoals.length > 0 && (
              <div>
                <h2 className="text-caption text-share-onSurfaceVariant">{preview.inviterName ? `${preview.inviterName}’s goals` : "Their goals"}</h2>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-share-onSurface marker:text-share-onSurfaceDim">
                  {preview.inviterGoals.map((g, i) => (
                    <li key={i} className="break-words">
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.inviterDonts.length > 0 && (
              <div>
                <h2 className="text-caption text-share-onSurfaceVariant">{preview.inviterName ? `${preview.inviterName}’s don’ts` : "Their don’ts"}</h2>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-share-onSurface marker:text-share-onSurfaceDim">
                  {preview.inviterDonts.map((d, i) => (
                    <li key={i} className="break-words">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
    if (!user) {
      body = (
        <div className={column}>
          {header}
          <LoginForm title="Join the challenge" subtitle="Create an account or sign in. You will come straight back here." />
        </div>
      );
    } else {
      body = (
        <form onSubmit={(e) => void join(e)} className={column}>
          {header}
          <label htmlFor="join-name" className="block text-sm font-semibold text-share-onSurface">
            Your name, as the others see it
          </label>
          <input
            id="join-name"
            name="display-name"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setTypedName(e.target.value)}
            maxLength={40}
            required
            className={`${FIELD} mt-1.5`}
          />
          <p className="mt-6 text-sm text-share-onSurfaceVariant">Your goals and don&rsquo;ts are optional. You can change them any time on the challenge.</p>
          <div className="mt-3">
            <p className="text-sm font-semibold text-share-onSurface">Your goals</p>
            <ListEditor items={goals} onChange={setGoals} placeholder="What you are aiming at…" label="Add a goal" idPrefix="join-goal" onDraftChange={setGoalDraft} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-share-onSurface">Your don&rsquo;ts</p>
            <ListEditor items={donts} onChange={setDonts} placeholder="No doomscrolling past 30 min…" label="Add a don’t" idPrefix="join-dont" onDraftChange={setDontDraft} />
          </div>
          {error && <ErrorLine className="mt-3" message={error} />}
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? "Joining…" : "Join challenge"}
          </button>
        </form>
      );
    }
  }

  return (
    <AppChrome showCalendarLink={Boolean(user)} showChallengeLink={Boolean(user)}>
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 pb-24 pt-8 md:pb-8">{body}</div>
      <MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
    </AppChrome>
  );
}
