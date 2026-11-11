# Summary: groups, reopen, drag handle left, Focus exit, sweep fixes, CI (2026-11-11)

Integration: worktree `.claude/worktrees/int-2026-11-11`, branch
`run/2026-11-11-group-reopen-handle-focus` from `origin/main` (`cae99e5`), all staged, **not
committed**. Supervisor: Fable until the user switched to Opus 5.5 mid-run; the user then said
"All findings adjusted and fixed" and the loop continued on Opus (recorded in
`reviews-round1.md`).

## What was built and approved

| Spec | What | Rounds |
|---|---|---|
| CI | E2E seeds the local date (8 tests failed whenever local and UTC dates differed); `ci.yml` on Node 22 runs unit, Convex and Playwright tests with a placeholder Convex URL (`https://ci-placeholder.invalid`); the two calendar tests that sign in to the dev deployment skip there; PR template rewritten for Convex | supervisor |
| 01 | Backend: up to 8 members; soft leave (rows kept, rejoin restores everything); creator hand-over; quiet member drops out alone in a group of 3+; `reopenChallenge` (creator only, new end date when passed, closed days count for nobody, inactivity from the day after the reopen); per-member nudges; invite links from former members are dead; check-in reminder names the real deadline; `updateSpan` guards marks and closed spans, 366-day cap from the reopen day | 3 + scout check |
| 02 | Client: every challenge screen for 2 to 8 people, Reopen sheet, "Reopened 11 Nov", per-member Nudge, invite with seats left, season grid with a member picker for groups and a "closed" shape, leave/delete/check-in copy, "With others" | 1 |
| 04 | Drag handle first on phone rows (desktop already was), `PhoneHandleSpacer` keeps titles aligned | 1 |
| 05 | "Exit focus" button on desktop Focus and the phone Focus tab; "Back to focus" in the sidebar | 1 |
| 06 | Away-block minutes filed on the day the block started; a block keeps its task when the planner is paged away (and the sidebar names it); Cancel on "Add task above/below/subtask" adds nothing | 3 |
| supervisor | "Hide from partner" → "Hide from challenge"; stale Supabase sentence in CLAUDE.md; CLAUDE.md paragraph on leaving Focus | |

## Checks on the integrated head (CI conditions, `--retries=0`)

lint clean · `npx tsc -b` and Convex tsc exit 0 · unit 30 files, 443 passed · Convex 19 files,
245 passed · build ok (674 kB, 194 kB gzip) · e2e 221 passed, 2 skipped (calendar sign-in).

## Open

- **Deploy is two-sided, backend first:** `npx convex deploy` (prod), then merge the PR. The
  live client keeps working against the new backend (spec 01 criterion 4 replays all 21 client
  calls), except one sentence: its leave sheet tells a creator that leaving "ends it for both",
  which is no longer true. Keep the gap between the two short.
- **No signed-in browser pass.** The e2e suite is guest-only; the dashboard is covered by a
  fixture harness (`e2e/harness/`). After the backend deploy, a two-account pass on dev: group
  nudge, reopen flipping both screens, a member leaving and returning.
- Known limits (in CLAUDE.md): one warning at a time; a reopen checks only the creator's
  20-challenge cap; former rows count in the 50-row membership window; delete removes up to 8
  people's days; `reopenedDate` is on the reopener's clock.
- Not fixed (proposals): a block ending while you are on `/challenge` or `/review` is only
  recorded as a claim (timer lives in `DayPlanner`); two tabs could each record one block;
  stale `docs/USER_GUIDE.md` and `.claude/commands/` (Supabase); leftover DaySetup/tour
  helpers in `e2e/crawl.spec.ts`; TEMP debug code in `src/storage/localStorageState.ts`.
- `main` is not protected: requiring the CI check before merge is a GitHub setting for the
  user.
- The orphaned Vite server on port 5173 (from a stuck run, started without a Convex URL) must
  be closed before running `npm run test:e2e` locally.
- Worktrees to clean after merge: `int-2026-11-11`, `agent-aaa38aae92f409347`,
  `agent-a9a3ca32a1d014067`, `agent-af425186a49e922f2`, `agent-a9f04f0243b9baaad`,
  `agent-aed430214f5c83c88`. The main tree still has the CI change uncommitted on
  `chore/ci-tests-and-e2e-dates`; it is included in the run branch, so that branch can be
  discarded.

## Agents

Scouts: 4 research, 1 check. Builders: 5 (01 three rounds, 06 three rounds, 02, 04, 05 one).
