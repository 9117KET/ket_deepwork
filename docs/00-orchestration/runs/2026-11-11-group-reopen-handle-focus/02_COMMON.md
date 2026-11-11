# Common rules for every builder in this run

Main tree: `C:\Users\kinlo\code\personal\ket_deepwork` (do not edit it; read the run folder
and the gitignored `.env` from there). Run folder:
`C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-11-group-reopen-handle-focus\`.
Your worktree does not contain the run folder; read specs and scout files by the absolute path.

## Setup in your worktree

1. `npm ci` in the worktree root.
2. Copy `.env` (and `.env.local` if it exists) from the main tree into the worktree. Without
   `VITE_CONVEX_URL` some unit tests and the Vite app fail.
3. Playwright: `playwright.config.ts` reuses any server on port 5173, and other builders run at
   the same time. Use the private port your spec gives you: write a scratch config outside the
   repo (your scratch directory, which other builders share: name the file after your spec,
   e.g. `pw-spec02.config.ts`, never a generic name) that spreads the repo config, sets `testDir` to the absolute
   `e2e` path, `use.baseURL` to `http://localhost:<port>`, and `webServer` to
   `{ command: 'npx vite --port <port> --strictPort', url: 'http://localhost:<port>', cwd: <worktree>, reuseExistingServer: false }`.
   Run with `--retries=0`. Skip `e2e/calendar-sync.spec.ts` (it hard-codes 5173). Stop your
   server when done.
4. On Windows PowerShell 5, `&&` is refused; run `npx tsc -b` and `npx vite build` separately.

## Rules

- Project rules in `CLAUDE.md` apply. Read `docs/data-safety.md` before touching the timer or
  anything that writes `deepWorkSessions`. For Convex code read
  `convex/_generated/ai/guidelines.md` first.
- UI work uses the three design skills: `apple-design`, `frontend-design`, then
  `web-design-guidelines` over the changed files. Interface copy is sentence case, buttons say
  what happens, no em dashes.
- A bug or a changed behaviour gets a test that fails before the change and passes after.
  Never weaken or skip an existing test to get to green; if a test is wrong, fix it and say so.
- New tests go in new files or clearly separate `describe` blocks, so parallel builders merge.
- Edit files with the Edit tool, not `sed`. Files here have CRLF endings.
- Do not commit, push, deploy, run `npx convex deploy` or `npx convex dev`, or send email.
  Leave your changes uncommitted in the worktree; the supervisor exports them.
- Do not edit `.github/`, `docs/ENGINEERING_BASELINE.md` or files outside your spec's list. A
  needed change elsewhere goes in your report as an open item.
- Update `CLAUDE.md` where your change makes a sentence in it false.

## Checks every builder runs before reporting

`npm run lint`, `npx tsc -b`, `npm test`, `npm run test:convex`, `npx vite build`, and the
Playwright files your spec names. Report each command with its real counts. A check you did
not run is written "not run" with the reason.

## Report

Your final message is the report (the supervisor files it): what changed (files), each
acceptance criterion with its evidence, commands and counts, deviations from the spec and why,
open items.
