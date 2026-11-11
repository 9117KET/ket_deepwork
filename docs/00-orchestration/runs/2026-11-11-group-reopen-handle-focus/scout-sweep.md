# Scout: defects and loose ends (Mode A, read-only, 2026-11-11)

Condensed by the supervisor. Findings 1, 2, 3 and 5 were re-read by the supervisor in the code
at `cae99e5` and stand.

| # | Severity | Finding | Where | Goes to |
|---|---|---|---|---|
| 1 | Medium | An away-block claim is filed on the day on screen when the block was last written, not the day it started. Start a block on Wednesday, page back to Tuesday, close the tab, let it land, claim: the minutes go to Tuesday. The live path already uses `blockDayIso` | `src/components/planner/DayPlanner.tsx:318` (`dayIso: selectedDay`); `src/components/timer/useDeepWorkTimer.ts:387-427` rewrites the stored `dayIso`; `src/hooks/useTaskHandlers.ts:611-638` files under `block.dayIso`; compare `:580`. The fallbacks at `useDeepWorkTimer.ts:390,403` are UTC dates | spec 06 |
| 2 | Medium | Cancel on "Add task above / below / Add subtask" still creates a task called "New task": `window.prompt(...) ?? "New task"` | `src/hooks/useTaskHandlers.ts:206,238,269-270` | spec 06 |
| 3 | Medium | The check-in reminder says "before midnight" whatever the deadline is (it may be 22:00) | `convex/reminders.ts:43,47` | spec 01 |
| 4 | Low-Medium | The timer hook lives in `DayPlanner`, mounted only on `/`. A block that ends while you are on `/challenge` or `/review` is not recorded; it becomes an away claim, dropped unasked after 12 hours | `DayPlanner.tsx:312`; `useDeepWorkTimer.ts:524-563`; `src/storage/activeBlock.ts:85` | proposal (a larger change) |
| 5 | Low-Medium | `updateSpan` lets the start move past a day that holds only marks (`dontsBroken`, `goalsKept`), which then drops out of the grid | `convex/challenges.ts:950-960` | spec 01 |
| 6 | Low | Stale Supabase and removed-feature text: `CLAUDE.md:579`; `.github/PULL_REQUEST_TEMPLATE.md:10,17-19`; `.claude/commands/debug-sync.md`, `deploy-functions.md`, `new-migration.md` (wholly Supabase), `new-page.md:40`, `new-task-section.md:42`; `docs/USER_GUIDE.md` (tour, time blocks, sharing, Supabase; no challenges or calendar); `docs/ROADMAP.md:55-56`; `docs/STITCH_PROMPT.md:14,20`; `eslint.config.js:11` | `CLAUDE.md` line and PR template: supervisor. The rest: proposal (deleting or rewriting the user's files) |
| 7 | Low | `e2e/crawl.spec.ts:29-45,91-97` still handles the removed DaySetup modal, tour and shutdown reminder | proposal |
| 8 | Low | "TEMP" debug code still wired in | `src/storage/localStorageState.ts:7-16` | proposal |
| 9 | Unconfirmed | Two tabs each run their own countdown and could both record the block; orphan subtasks drop out of the gauge (`src/domain/dayCompletion.ts:46-56`); "Call mom 2h 5" reads as 2h05 | proposal |

Checked and found enforced: span and deadline rules, today-only lock-in, today or yesterday for
check-in and marks, the ±1 day sync window, the 20-challenge cap, the `updateSpan` guards, no
`userId` in a partner view, no reminders for a warned member, busy guards on every challenge
button, no clickable `div`, focus rings present.

Not read in depth: `usePersistentState`, most of `localStorageState.ts`, `useTouchReorder`.
