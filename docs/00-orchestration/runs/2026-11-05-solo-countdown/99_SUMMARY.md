# Summary: solo challenges and the deadline countdown (2026-11-05)

*Branch:* `run/2026-11-05-solo-countdown`, head `6508e43`, seven commits ahead of `main` (three spec commits, three merges). Not pushed, not deployed.

## Built and approved

| Spec | What | Round | Merged |
|---|---|---|---|
| 01 `spec-01-solo-backend.md` | `challenges.solo` flag: set by `createChallenge({ solo: true })`, returned by every view and the admin row, cleared by `acceptInvite` in the same mutation that seats the partner. 9 tests in `convex/challengesSolo.test.ts`. | 1 | `4a46bc5` |
| 02 `spec-02-countdown-domain.md` | `src/domain/challengeCountdown.ts` (`countdownState`, `countdownLine`, `formatCountdown`, `formatCountdownCoarse`, `daysLeftHeadline`, `localDeadlineMs`), `src/hooks/useSecondTick.ts`. 21 tests, also green under New York and Kolkata time zones. | 1 | `625b839` |
| 03 `spec-03-client.md` | "Just me" on the create page; "Invite a partner", "Your season", "Just you" on every solo surface; the days-left headline and the `role="timer"` countdown on the dashboard; minute-precise countdown on the Today block; "Day 22 of 92 · 70 days left" in the list; "Solo" in the admin table; CLAUDE.md. | 1 | `6508e43` |

Merged head: tsc and lint clean, 371 unit tests, 180 convex tests, `vite build` clean, guest e2e 11 passed.

## What the user should know
- **Deploy order is backend first.** `createChallenge` gained an optional argument. From a real terminal (PowerShell blocks `npx.ps1`): `npx.cmd convex deploy`, answer `y`; then push the branch and merge to `main`. If the client ships first, only "Just me" creation fails until the backend follows; everything else degrades to today's behaviour.
- **Nothing in the browser was clicked while signed in.** e2e seeds guests only. The builder rendered the dashboard from fixtures at iPhone 14 width (screenshots in the session scratchpad: headline 32px numeral, timer under it, Today surface starts at about 269px of 664px). The first signed-in look is yours.
- **Inactivity and reminders apply to solo challenges unchanged**, as decided at intake: three missed days warn, four close.

## Open items (none block shipping)
- The partner mark says "Sam ✓ plan locked" (existing wording), not "locked in" as a spec example had it.
- A challenge past its end date that the sweep has not closed yet shows "Season over" and no timer. Correct, noted.
- `src/hooks/useWorkLog.test.ts` cannot load in a worktree without `.env` (`VITE_CONVEX_URL`). Pre-existing; builders set a dummy URL. Worth a small follow-up so suites pass anywhere.
- The CLAUDE.md route description for `/challenge/:id` still describes the header without the headline line.

## Agents and rounds
Three builders (Opus), one scout check (Sonnet), one round each. Worktrees `agent-a387d6114e0b000f6`, `agent-aabd517f1a35c65d1`, `agent-af6c9401b0b4ec83f` under `.claude/worktrees/` can be removed once the branch is pushed.

## Tuning notes for the skill
- Running the two non-UI specs (backend flag, pure domain) in parallel and the UI spec after both merged meant the UI builder type-checked against real code and needed no fix round.
- A `02_COMMON.md` that fixes the user-facing words let the scout check strings mechanically; the two strings outside it were both legitimate (a `<legend>`, a solo variant of an existing sentence).
