# Spec 03: Challenge bug fixes from the audit

*Run:* `docs/00-orchestration/runs/2026-10-23-challenge-v2/` · *Builder:* builder (Opus) · *Worktree:* **no** —
runs in the main checkout on branch `challenge-v2` after specs 01 and 02 are merged ·
*Time box:* 90 minutes of agent work

## Goal
The confirmed defects from `scout-bug-audit.md` that neither spec 01 nor spec 02 covers are
fixed on the integrated code: rule violations reach the user as sentences in production, a
finished season stays readable, the partner's history has no hole across the date line, the
Review maths is right, the planner can only publish today, and the small join-page and
validation gaps are closed. Nothing else changes.

## Inputs (read all of these first)
- `scout-bug-audit.md` (this run): findings F1, F4, F5, F6, F7, F9, F11, F13, F14, F16. Skip
  F2/F3/F18 (done in spec 02), F8 (not a bug: `DayPlanner.tsx:617` returns a spinner while
  hydrating, before the card at :664 can render), F10/F12/F15/F17 (left open, see Out of scope).
  Line numbers in the audit for `ChallengeReviewSection.tsx` are wrong; the file is 90 lines
  and the relevant code is at :20-36 and :70.
- `report-01-round1.md`, `report-02-round1.md`: what the merged code now looks like.
- `convex/challenges.ts`, `convex/challengesInternal.ts`, `convex/_shared/challengeReminders.ts`
  (`CHECKIN_START`), `convex/tasks.ts:17,48,58` (the `ConvexError({ code, message })` shape
  already in use), `convex/_generated/ai/guidelines.md`.
- `src/services/challengeService.ts` (`challengeErrorMessage`), `src/hooks/useChallenge.ts`,
  `src/pages/ChallengePage.tsx`, `src/pages/ChallengeJoinPage.tsx`,
  `src/components/challenge/ChallengeDashboard.tsx`, `ChallengeReviewSection.tsx`,
  `ChallengeCreateForm.tsx`, `src/components/planner/DayPlanner.tsx:220-225, 660-666`.
- `convex/challenges.test.ts` and `convex/reminders.test.ts` for the harness (see
  `scout-code-map.md` Part C).

## Fixes (decided; do not reopen)

### F1 — errors as sentences
- In `convex/challenges.ts` every expected-state throw (validation, "already in a challenge",
  invite states, "outside the challenge", "Unknown don't", every nudge refusal, "no email on
  file", "You are not in a challenge") becomes `throw new ConvexError({ code: "challenge",
  message })` via one small helper `fail(message): never`. `requireUser`'s "Not authenticated"
  stays a plain `Error` (it is a programming state, not a user state).
- `challengeErrorMessage(e)` in `src/services/challengeService.ts`: if `e instanceof ConvexError`
  (from `convex/values`) return `e.data.message` when it is an object with a string `message`,
  or `String(e.data)`; otherwise keep the regex fallback, with the `s` flag so it crosses the
  newline before "Uncaught Error:"; still fall back to "Something went wrong".
- Unit test `src/services/challengeService.test.ts`: a `ConvexError` with object data, one with
  string data, a dev-shaped multi-line `Error`, a prod-shaped "Server Error" string → the
  fallback sentence.
- Existing convex tests that match on `rejects.toThrow(/…/i)` keep passing (a `ConvexError`'s
  `message` carries the data); update any that break with minimal edits.

### F6 — the finished season stays readable
- New helper `currentMembership(ctx, userId)`: the active membership if any, else the most
  recent membership whose challenge is `ended` (same `by_user` scan, `take(5)`), else null.
- **Reads** (`myChallenge`, `dayCards`, `history`) use `currentMembership`. **Writes**
  (`createChallenge`'s "already in" check, `acceptInvite`, `createInvite`, `leaveChallenge`,
  `syncDaySummary`, `lockInPlan`, `checkIn`, `nudgePartner`, `updateMyCommitments`) keep
  `activeMembership` / `requireMembership` unchanged.
- `useChallenge`: `ChallengeStatus` gains `"ended"` (when `info.challenge.status === "ended"`).
  `DayPlanner`'s `challengeActive` (`status === "active"`) therefore stays false for an ended
  season, so Today shows no card and syncs nothing. `ChallengePage` renders the dashboard for
  `"ended"` too, read-only: no invite box, no Leave button, no Edit on commitments, and a
  "Start a new challenge" button under the countdown that reveals the create / join forms
  (the server's "already in" check only sees active challenges, so creating works).
- `ChallengeReviewSection` keeps showing only for `"active"` (unchanged).
- Convex test: end the challenge (patch `status: "ended"` via `t.run`), `myChallenge` still
  returns it with `status: "ended"`, `history` still returns rows, `createChallenge` then
  succeeds and `myChallenge` returns the new one.

### F5 — partner history to the partner's yesterday
- `history` gains `partnerToDate: v.optional(v.string())` (defaults to `toDate`); the partner's
  rows are fetched up to it. `useChallengeHistory(enabled, untilIso, partnerUntilIso?)`.
  `ChallengeDashboard` passes `addDays(partnerDate, -1)`; `ChallengeReviewSection` passes the
  same `until` for both (unchanged behaviour there).
- Convex test: partner rows on a date equal to the viewer's today are returned when
  `partnerToDate` is that date and absent when it is not.

### F9 — Review maths
- `ChallengeReviewSection.tsx`: the streak counts back from `until` (`min(today-1, weekEnd)` is
  what `until` already is; pass `until` where `today` is passed at :36 — but when
  `includeToday` is true and today's rows are present, pass `today`); `elapsed` counts only
  `weekDates` that are `<= today` **and** inside `[startDate, endDate]`.
- Unit test for the two expressions if they are extracted into `src/domain/challenge.ts`
  (`reviewWeekElapsed(weekDates, today, span)`), which is the preferred shape.

### F11 — the planner publishes only today
- Server: `syncDaySummary` returns null unless `date` is within one day of the member's local
  today (`localDateAndMinutes(now, timezone).date`, using the timezone passed in the args when
  valid, else `me.timezone`). `lockInPlan` and `checkIn` `fail("You can only lock in today")` /
  `fail("You can only check in for today or yesterday")` outside the same window (lock-in:
  today only; check-in: today or yesterday).
- Client: `DayPlanner.tsx:225` passes `enabled: challengeActive && !isHydrating && isToday`
  (whatever the existing today check at :663 is called), so browsing another day sends nothing.
- Convex tests under fake timers: a sync for `today+3` writes no row; lock-in for yesterday is
  refused; check-in for yesterday succeeds; check-in for two days ago is refused.

### F4 and F7 — creation limits
- `createChallenge`: `MAX_SPAN_DAYS = 366`; longer → `fail("A challenge can run for at most a
  year")`. `HISTORY_CAP` becomes 400 so a full-length season fits with room.
- `checkinDeadline` must be after `CHECKIN_START` (21:30) → `fail("The check-in deadline must
  be after 21:30")`. Check `ChallengeCreateForm.tsx` offers no earlier value (constrain its
  input `min` or options if it does).
- Convex tests for both refusals and for a 366-day season accepted.

### F13, F14, F16 — small client fixes
- `ChallengePage.tsx:89` and `ChallengeJoinPage.tsx:182`: default display name sliced to 40.
- `ChallengeJoinPage`: wait for `mine.status !== "loading"` before showing the form; when the
  signed-in visitor is already a member of this invite's challenge show "You're in" with a link
  to `/challenge` (add `status: "member"` to `invitePreview`, which may read `ctx.auth`
  optionally — no auth required for the other states); clear the `sessionStorage` token when
  the preview is terminal (`notFound`, `used`, `expired`, `ended`, `full`, `member`), not only
  on success.
- `ChallengeReviewSection.tsx:20`: replace the frozen `useState(() => Date.now())` with the
  same minute tick `ChallengePage` uses for `useChallenge(now)` (reuse its hook; if it is
  inline, extract `useMinuteTick()` into `src/hooks/useMinuteTick.ts`).

### Docs
- `CLAUDE.md` "Accountability challenge": one sentence each on `ConvexError` for expected
  states, reads falling back to the last ended season, the 366-day cap, the publish-only-today
  rule, `history`'s two dates. Keep the section's voice.

## Deliverables (exact paths)
- `convex/challenges.ts`; `convex/challengeFixes.test.ts` (new, all the convex tests above —
  do not append to `challenges.test.ts` beyond minimal edits to assertions that break).
- `src/services/challengeService.ts` + `src/services/challengeService.test.ts` (new).
- `src/hooks/useChallenge.ts`, `src/hooks/useMinuteTick.ts` (if extracted),
  `src/pages/ChallengePage.tsx`, `src/pages/ChallengeJoinPage.tsx`,
  `src/components/challenge/ChallengeDashboard.tsx`, `ChallengeReviewSection.tsx`,
  `ChallengeCreateForm.tsx` (only if the deadline input needs constraining),
  `src/components/planner/DayPlanner.tsx` (one line), `src/domain/challenge.ts` + test
  (`reviewWeekElapsed`).
- `CLAUDE.md` as above.
- Commits on `challenge-v2`; nothing pushed.

## Acceptance criteria (each one checkable by a scout)
1. `grep -n "throw new Error" convex/challenges.ts` shows only `requireUser`.
2. `challengeErrorMessage` tests pass for the four shapes.
3. Ended season: `myChallenge` returns it; `/challenge` renders the dashboard read-only with
   "Start a new challenge"; `createChallenge` then succeeds.
4. `history` with `partnerToDate` returns the partner's row for the viewer's today.
5. `elapsed` excludes days outside the span; the streak for a past week is computed from that
   week's end, not from today.
6. Sync for a day outside today±1 writes nothing; lock-in for yesterday and check-in for two
   days ago are refused with sentences.
7. 367-day span and `checkinDeadline: "21:00"` are refused; 366 days accepted.
8. Join page: no form flash before `mine` has loaded; own accepted link → "You're in"; a
   terminal preview clears the stored token.
9. `npm run test:convex`, `npm test`, `npm run lint`, `npx tsc -b`, `npx vite build` pass;
   `npx playwright test e2e/mobile-panels.spec.ts e2e/mobile-responsive.spec.ts` passes.
10. No new features, no change to goals/donts or nudge behaviour beyond the error shape.

## Constraints
- Project rules from `CLAUDE.md` apply; read `convex/_generated/ai/guidelines.md` first.
- You work in the main checkout on `challenge-v2`; commit there. `npx convex codegen` only;
  never `convex dev` or `convex deploy`. Do not touch `.claude/worktrees/`.
- Copy: short, plain, no exclamation marks. 44px targets on the new button.

## Out of scope
- F10 (stale-device summary guard), F12 (freezing the Top 3 at lock-in), F15 (timezone refresh
  outside the span), F17 (reminder spacing across kinds), showing deadlines on the card (F7's
  second half). Listed for the human in the summary.

## Verification the builder must run
`npx convex codegen`, `npm run test:convex`, `npm test`, `npm run lint`, `npx tsc -b`,
`npx vite build`, then the two e2e files, one at a time on PowerShell.

## Report to
Return the report as your final message using `~/.claude/skills/orchestrate/templates/REPORT.md`;
the supervisor files it as `report-03-round1.md`. Include commit hashes.
