# Summary: challenge v2 (2026-10-23)

*Run:* `docs/00-orchestration/runs/2026-10-23-challenge-v2/` · *Supervisor:* Fable · *Head:* `challenge-v2` @ 5ff4b87 (local branch; not pushed, not merged to `main`, not deployed)

## What was built and approved

**Spec 01 — goals and don'ts are per member and editable** (2 rounds; check clean)
Each member's lists live on their own `challengeMembers` row. You set yours when you create or join, and change them any time from **Edit** on the challenge page (`CommitmentsSheet`). Your partner reads them in a second column and cannot change them. The join page shows the inviter's lists and offers the joiner their own. A removed don't is archived, never deleted, so a confession that named it still reads right in the season's record; an edited don't keeps its id. Challenges created before this change need no migration: the creator's old lists resolve from the challenge row. Round 2 fixed a trap the builder found: text typed into an "Add" box but not yet added was dropped on Save.

**Spec 02 — nudges capped and spaced, button carries the state** (1 round; check clean)
The "error on the second nudge" was a once-a-day rule thrown as a raw error. Now: up to **3 nudges per local day, at least an hour apart**, enforced on the server, with the button reading `Nudge` / `2 left today` / `Nudge again in 42 min` / `Nudged 3/3 today`, and hidden once the partner has done what they owe. Evening is judged on the partner's clock on both sides. A nudge outside the season is refused. Rules are one pure module (`convex/_shared/challengeNudges.ts`) shared by server and card.

**Spec 03 — bug fixes from the audit** (1 round; check clean)
- Every rule refusal is a `ConvexError`, so production shows the sentence instead of "Server Error" (F1).
- A finished season stays readable on `/challenge` with a "Start a new challenge" button, instead of vanishing on the next cron sweep (F6).
- The partner's history has no hole when they are a day ahead (F5).
- Review's joint streak for a past week and its "x/elapsed" denominator are right (F9).
- The planner publishes only today (±1 day) to the partner; lock-in is today only, check-in today or yesterday (F11).
- A season is at most 366 days; the check-in deadline must be after 21:30 (F4, F7).
- Join page: no form flash, "You're in" on your own link, stale tokens cleared; display-name default capped; Review's partner date ticks (F13, F14, F16).

**Verified on the final head** (supervisor): 139 convex tests, 304 unit tests, lint, `tsc -b`, `vite build`; builders ran the two `/challenge` e2e files (32 passed). Three independent scout checks found no defect.

## Paths
- Run records: this folder (`scout-*.md`, `spec-0{1,2,3}-*.md`, `report-*`, `review-*`, `check-*`).
- Code: `convex/challenges.ts`, `convex/schema.ts`, `convex/_shared/{challengeValidators,challengeNudges}.ts`, `src/domain/{challenge,challengeCommitments}.ts`, `src/components/challenge/{ListEditor,CommitmentsSheet,ChallengeDashboard,ChallengeCard,…}.tsx`, `src/pages/{ChallengePage,ChallengeJoinPage}.tsx`, `src/hooks/{useChallenge,useMinuteTick}.ts`, `src/services/challengeService.ts`, `CLAUDE.md`, `src/pages/PrivacyPage.tsx`.
- New tests: `convex/challengeCommitments.test.ts`, `convex/challengeNudges.test.ts`, `convex/_shared/challengeNudges.test.ts`, `convex/challengeFixes.test.ts`, `src/domain/challengeCommitments.test.ts`, `src/services/challengeService.test.ts`.

## Decisions needed from you
1. **Ship order.** This is a two-sided deploy in three places (`me.donts`, the `nudgePartner` result, `history.partnerToDate`): run `npx convex deploy` **before** merging `challenge-v2` to `main` (Vercel). The schema changes are additive, so the new backend serves the old client safely in between.
2. **Merge** `challenge-v2` → `main` (PR or fast-forward) when you are happy; nothing was pushed by the loop.
3. Nudge "sent" means queued; if SMTP fails the allowance is still spent (audit F3). Accept, or ask for a refund-on-failure later.

## Still open (by decision, not built)
- F10 stale-device summary can overwrite a newer one (no client timestamp guard on `challengeDays.summary`).
- F12 the Top 3 can still change after "Plan locked"; an empty plan can be locked.
- F15 timezone refresh only happens through the planner and only in-range.
- F17 a plan reminder after 20:00 can delay the first check-in reminder by up to 30 min.
- Deadlines are reminder triggers only and are not shown on the card.
- `lockInPlan`/`checkIn` judge "today" on the stored timezone; the planner refreshes it on the first edit, which precedes a lock-in.
- No signed-in e2e exists for the challenge UI (seeding is guest-only); the dashboard, sheet, join states and card states are covered by convex/unit tests and code reads.
- Audit F8 (lock-in during hydration) was refuted: `DayPlanner` renders a spinner while hydrating.

## Agents and rounds
Scouts: bug-audit, code-map, check-01, check-02, check-03 (5). Builders: 01 (2 rounds, worktree), 02 (1 round, worktree), 03 (1 round, main tree). No RESPEC. Worktrees removed after this summary; branches `worktree-agent-ae2b7026e3f8da523` and `worktree-agent-ab3b7b0e44fb5f226` are merged into `challenge-v2`.
