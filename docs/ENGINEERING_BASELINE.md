# Engineering baseline: Deepblock (ket_deepwork)

Date: 2026-11-11 · HEAD: `cae99e5` (main) · Previous baseline: none

Each item is **met**, **partly** or **not met**, with the file or command output that shows it.
Commands were run on Windows 11, Node v26.13.0, between 00:50 and 00:56 local time
(23:50 to 23:56 UTC, which matters for B3).

## A. Pipeline

| # | Item | State | Evidence |
|---|---|---|---|
| A1 | A pipeline runs on every pull request and on the default branch | met | `.github/workflows/ci.yml`: `push` and `pull_request` on `main` |
| A2 | It runs lint | met | `ci.yml` step "Lint" (`npm run lint`) |
| A3 | It runs typecheck | met | `ci.yml` step "Build" runs `tsc -b && vite build` |
| A4 | It runs unit and integration tests | **not met** | `ci.yml` has no test step. `npm test` (401 tests) and `npm run test:convex` (193 tests) never run in CI |
| A5 | It runs the build | met | `ci.yml` step "Build" |
| A6 | It runs end-to-end tests | **not met** | No Playwright step in `ci.yml`. 183 e2e tests run only by hand |
| A7 | It runs a performance check | **not met** | None in `ci.yml`; no Lighthouse, size-limit or web-vitals in `package.json` |
| A8 | No blocking check is `continue-on-error` | met | No `continue-on-error` in `ci.yml` |
| A9 | The default branch is green now | partly | CI on `cae99e5`: success (1m6s, 7 Nov), and the four runs before it. But CI is only lint and build. Locally, lint, typecheck, unit, Convex and build pass; e2e had 8 failures (B3) |
| A10 | Merging on red is prevented | **not met** | `gh api .../branches/main/protection` → 404 "Branch not protected"; `.../rulesets` → `[]` |
| A11 | A second reader reviews each pull request | **not met** | PRs #37, #39, #40: 0 reviews each. Checks present: `build`, GitGuardian, Vercel preview |

Also found: `package.json` `engines.node` is `22.x`, `ci.yml` uses Node `20`, the local machine
runs v26. Three versions for one project.

## B. Tests

| # | Item | State | Evidence (counts, duration) |
|---|---|---|---|
| B1 | Unit tests exist and pass locally | met | `npm test`: 26 files, 401 tests passed, 1.1s |
| B2 | Integration tests cross real boundaries | met | `npm run test:convex`: 16 files, 193 tests passed, 1.6s. `convex-test` runs the real functions against an in-memory Convex database; Google and nodemailer are mocked. The client-to-Convex path while signed in has no automated test |
| B3 | End-to-end tests cover the main user paths in a real browser | partly | `npx playwright test`: 183 tests, **175 passed, 8 failed**, 3.4 min, Chromium only. All guest-mode; no signed-in flow (CLAUDE.md: "A two-account flow cannot run in e2e"). The 8 failures (4 in `completion-claim-blocks.spec.ts`, 3 in `crawl.spec.ts`, 1 in `session-attribution.spec.ts`) all fail to find their seeded task. Those three files seed "today" with `new Date().toISOString().slice(0, 10)`, the UTC date, and the run happened when the local date was 11 Nov and the UTC date 10 Nov. Likely cause: a test bug that fails whenever local and UTC dates differ (one hour a night in UTC+1). Not confirmed by a rerun at another hour |
| B4 | Access tests cover each role and the signed-out case | partly | Server: `convex/challenges.test.ts`, `challengesMulti.test.ts` (membership, privacy, admin). Signed-out: `e2e/challenge-guest.spec.ts`. No browser test of a signed-in member or admin |
| B5 | Performance budgets are written down and checked | **not met** | No budgets in `CLAUDE.md` or `docs/`. Only measure today: build output, `index-*.js` 662.77 kB (190.38 kB gzip), one chunk, Vite warns it is over 500 kB |
| B6 | Accessibility is checked automatically | partly | No axe or similar in `package.json`. Hand-written gates exist: 44px touch targets (`e2e/mobile-responsive.spec.ts`), sheet focus trap (`e2e/challenge-guest.spec.ts`), drag handle keyboard path (`e2e/drag-handle.spec.ts`) |
| B7 | Areas with logic and no tests | listed | Source files to test files: `src/components` 51 to 0, `src/pages` 11 to 0, `src/hooks` 12 to 4, `src/services` 2 to 1, `convex` 25 to 16. Covered well: `src/domain` 14 to 13, `src/storage` 5 to 5. Components and pages are reached only through e2e |

## C. Architecture record

| # | Item | State | Evidence |
|---|---|---|---|
| C1 | `docs/ARCHITECTURE.md` (or equal) states the stack and why | partly | No `docs/ARCHITECTURE.md`. `CLAUDE.md` "Architecture" states the stack and explains many rules with their cause (sync, challenge, deep work). The choice of stack itself (why Convex, why Vercel) is not written |
| C2 | It matches the code today | partly | `CLAUDE.md` is current to PR #40 but still says "the normal Supabase sync path" in Deep Work item 1. Stale Supabase text also in `.github/PULL_REQUEST_TEMPLATE.md`, `.claude/commands/debug-sync.md` (and likely `new-migration`, `deploy-functions`), `docs/USER_GUIDE.md`, `docs/STITCH_PROMPT.md`. The app has been on Convex since June 2026 |
| C3 | Decisions are recorded (ADRs or equal) | partly | No `docs/adr/`. Decisions live as prose in `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/data-safety.md`, `docs/design/README.md` and five run folders under `docs/00-orchestration/runs/` |
| C4 | The project `CLAUDE.md` holds commands, conventions and an "SDLC" section | partly | Commands and conventions: yes. No "SDLC" section |
| C5 | Design rules exist | met | `tailwind.config.js` tokens and breakpoints, `src/index.css` utilities, `docs/design/README.md`, "Responsive foundations" in `CLAUDE.md`, `src/components/ui/` |
| C6 | Current docs for the main libraries are reachable | met | `convex/_generated/ai/guidelines.md`; installed packages under `node_modules` |

## D. Safety

| # | Item | State | Evidence |
|---|---|---|---|
| D1 | Local or staging environment exists, separate from production | met | `docs/DEPLOYMENT.md`: Convex dev `knowing-gopher-377`, prod `nautical-wolf-453`; Vercel previews point at dev; dev has `EMAIL_DELIVERY=off` |
| D2 | Migrations are versioned and have a way back | partly | Convex schema is in git (`convex/schema.ts`) and the stated rule is additive optional fields, never removing a table or field before an export. No written rollback for a schema change |
| D3 | Production writes and destructive actions need a human yes | partly | The rule is written (`/sdlc` Stage 7, `docs/DEPLOYMENT.md`). But `.claude/settings.local.json`, which is tracked in git, pre-allows `Bash(npx convex *)` (covers `convex deploy` and `convex env set --prod`), `Bash(git *)` and `Bash(git push *)` (covers force push, and a push to `main` deploys the client), `Bash(vercel --prod)` and `PowerShell(Remove-Item *)`. None of these would raise a prompt |
| D4 | Secrets are out of the repo | met | `.gitignore` covers `.env`, `.env.local`, `*.local`, `backups/`; only `.env.example` is tracked; a `git grep` for Google API key, OAuth secret, private key and `sk-` patterns found nothing; GitGuardian passes on each PR. `docs/dev-test-accounts.local` is untracked |
| D5 | Backups exist and a restore has been tried | partly | `backups/` (git-ignored, this machine only): `dev-before-minimal.zip` and `prod-before-minimal.zip` (11 Oct), `prod-before-challenge.zip` (22 Oct). `DEPLOYMENT.md` says the exports were verified. No record of a restore (`convex import`) being tried, no schedule, newest is 20 days old, no copy off this machine found in the repo |
| D6 | A release can be rolled back, and how is written down | **not met** | Not found in the repo. `DEPLOYMENT.md` gives deploy order (backend first) but no way back for the client (Vercel) or the backend (Convex) |

## E. Production

| # | Item | State | Evidence |
|---|---|---|---|
| E1 | Error monitoring is live on client and server | **not met** | No Sentry or similar in `package.json`, `src/` or `convex/`. Server errors are visible only in the Convex dashboard logs; client errors nowhere |
| E2 | Someone reads it and failures become tickets or fixes | **not met** | Nothing to read. The June to September 2026 sync outage ran about 2.5 months unseen (`DEPLOYMENT.md`) |
| E3 | A smoke check runs against the live site after release | partly | `DEPLOYMENT.md` "Verify what the live site points at" (a curl by hand) and `email:sendTestEmail`. Nothing automatic, and nothing that checks the client and backend validators agree |
| E4 | Uptime or scheduled-job health is watched | **not met** | One cron (`convex/crons.ts`, reminders every 15 min). Not watched; `DEPLOYMENT.md` says to read the logs by hand |

## Gaps, in the order to close them

| # | Gap | Why this order | Size |
|---|---|---|---|
| 1 | Fix the 8 e2e failures: seed "today" from the local date in `completion-claim-blocks`, `session-attribution` and `crawl` specs (confirm the cause first by rerunning after 01:00 local) | The suite must be reliably green before it can block merges | Patch |
| 2 | Add `npm test` and `npm run test:convex` to `ci.yml`; set Node to 22 to match `engines` | 594 tests take under 4s and are not run on any PR. Cheapest large gain | Patch |
| 3 | Add Playwright to `ci.yml` (install Chromium, `npm run test:e2e`, upload the report on failure) | Every later feature's acceptance tests depend on this running | Patch |
| 4 | Protect `main`: require the CI check to pass before merge | Makes 2 and 3 binding. A GitHub setting, yours to make | Setting |
| 5 | Second reader on every PR (an agentic review on the PR, or `/code-review` recorded in the PR) | Three recent PRs merged with no review | Small |
| 6 | Narrow `.claude/settings.local.json`: remove the blanket `npx convex *`, `git *`, `git push *`, `vercel --prod` and `Remove-Item *` allows so deploys, pushes and deletes ask each time | The human gate on production is written but not enforced | Patch |
| 7 | Write rollback into `docs/DEPLOYMENT.md`: Vercel promote of the previous deployment, redeploy of the previous Convex commit, and the two-sided order in reverse | A bad release currently has no written way back | Small |
| 8 | Backups: try one restore into dev, write the steps, decide a schedule and an off-machine copy | Backups that were never restored are unproven | Small |
| 9 | Error monitoring on the client and Convex, plus an automatic post-release smoke check (site loads, bundle points at prod, validators agree) | The one long outage here was invisible for 2.5 months. Needs your choice of service | Feature |
| 10 | Performance budgets: record today's figures (bundle 190 kB gzip; measure load and interaction), agree targets, check in CI | Budgets cannot be invented; they need your numbers | Small |
| 11 | Automated accessibility check (axe in Playwright) on each route | Hand-written gates cover size and focus only | Small |
| 12 | Signed-in e2e path (a seeded test account on dev) | The sync and challenge flows, the riskiest code, have no browser test | Feature |
| 13 | `docs/ARCHITECTURE.md` and `docs/adr/`: move the stack and the standing decisions out of `CLAUDE.md` prose; remove stale Supabase text from the PR template, `.claude/commands/`, `USER_GUIDE.md` and `CLAUDE.md` | Record keeping; nothing breaks without it today | Small |

## Proposed "SDLC" section for the project `CLAUDE.md`

Not added. Items marked "to decide" are yours.

```markdown
## SDLC

| Setting | Value |
|---|---|
| Lint | `npm run lint` |
| Typecheck | `npx tsc -b` |
| Unit | `npm test` |
| Integration | `npm run test:convex` |
| Build | `npx vite build` (on Windows run `tsc -b` and `vite build` separately) |
| End-to-end | `npm run test:e2e` (Chromium, guest mode, about 3.5 min) |
| Performance | none yet. Today: main bundle 663 kB, 190 kB gzip. Budgets: to decide |
| Smoke | `docs/DEPLOYMENT.md` "Verify what the live site points at" (by hand) |
| Environments | local: `npm run dev` plus Convex dev `knowing-gopher-377`; preview: Vercel preview on Convex dev; production: `ket-deepwork.vercel.app` on Convex `nautical-wolf-453` |
| Deploy path | Client: merge to `main`, Vercel deploys. Backend: `npx convex deploy`, run by the human. A changed payload or argument: backend first, then push |
| Rollback | to write (gap 7) |
| Monitoring | Convex dashboard logs only. Error monitoring: to decide (gap 9) |
| Protected | Convex prod and its env vars; tables `plannerDays`, `challengeDays`, and legacy `shareTokens`, `financialSettings`, `travelTrips`; `deepWorkSessions` in any day; `backups/` |
```
