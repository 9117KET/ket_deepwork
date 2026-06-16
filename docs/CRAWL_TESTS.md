# Deepblock — Crawl & Smoke Test Harness

End-to-end crawl tests that exercise every route, catch regressions in guest-mode flows, and
gate the CI pipeline against real browser rendering.

## Two test layers (and why)

The Google Calendar sync logic lives in **server-side Convex actions** (`convex/calendar.ts`),
which call Google with a server-side `fetch`. Playwright's `page.route()` only intercepts
**browser** traffic, so it physically cannot mock those calls or reach past the OAuth redirect.
Testing the calendar engine therefore happens at two layers:

| Layer | Tool | What it covers | Script |
|---|---|---|---|
| Browser / route crawl | Playwright (`e2e/crawl.spec.ts`) | Guest-mode rendering, every route loads without a React crash | `npm run test:crawl` |
| Convex function engine | `convex-test` + Vitest (`convex/calendar.test.ts`) | The real calendar actions run in-process against a **mocked Google `fetch`** | `npm run test:convex` |

> ⚠️ **Triage note (corrected):** an earlier report classified "calendar connect fails" as
> local *env noise* because `GOOGLE_*` vars were assumed missing. That was wrong on two counts —
> the vars **are** set in the dev Convex deployment, and the guest-mode crawl never renders the
> Connect button at all (it's behind the `isAuthenticated && !connected` branch), so the flow
> was never actually exercised. The `convex/calendar.test.ts` suite closes that gap.

## Prerequisites

| Requirement | How to satisfy |
|---|---|
| Node 22 | `node --version` → `v22.x` |
| Dev server on :5173 | `npm run dev` |
| Playwright browsers installed | `npx playwright install chromium` (one-time) |
| No Convex backend needed | Tests run in guest mode (localStorage only). Auth-gated features are skipped or noted. |

Convex features that require a live backend (receipt parsing, calendar OAuth, trip data,
finance sync) will silently degrade — the tests check for "no crash", not for Convex data.
See "Needs production backend" below.

## npm Scripts

```bash
# Headless CI gate — run this in CI after starting the dev server
npm run test:crawl

# Headed (visible browser) — for local debugging
npm run test:crawl:watch

# Playwright UI mode — interactive exploration + time-travel debugging
npm run test:crawl:ui

# Run all e2e specs (crawl + monthly-review + copy-from-day etc.)
npm run test:e2e

# All e2e specs in UI mode
npm run test:e2e:ui

# Convex calendar engine — runs the real sync actions against a mocked Google.
# No dev server, no Playwright, no Google credentials needed.
npm run test:convex
```

## Running in CI

Minimal CI setup (GitHub Actions example):

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps

- name: Start dev server
  run: npm run dev &
  env:
    VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}

- name: Wait for dev server
  run: npx wait-on http://localhost:5173 --timeout 30000

- name: Run crawl tests
  run: npm run test:crawl
```

No seeded users are required — the crawl spec operates entirely in guest mode.

## What the Crawl Spec Covers

Located at `e2e/crawl.spec.ts`:

| Suite | What it checks |
|---|---|
| Landing (`/`) | Page loads, "How it works" section, footer links present |
| Planner (`/planner`) | Guest-mode login bypass, date nav, section collapse, task visibility |
| Planner — Must Do | Pinned header renders and add-task input works |
| Planner — sections | Seeded task visible, click/complete doesn't crash, collapse/expand |
| Planner — Deep Work Timer | Timer renders, Start button interactive |
| Planner — Tracking Dashboard | Monthly dashboard renders, habit toggle safe |
| Finance (`/finance`) | All 5 tab groups render, FIRE calculator input, expense entry |
| Travel (`/travel`) | Loads, heading visible, sign-in prompt for unauthenticated |
| Calendar (`/calendar`) | Loads without crash, unauthenticated UI present |
| Calendar callback | No-code and invalid-code param both handled gracefully |
| Share link (`?share=TOKEN`) | Invalid token shows user-friendly error, not React crash |
| Legal pages (`/privacy`, `/terms`, `/support`) | Each renders without crash |
| Cross-route navigation | All defined routes have non-empty body, no React error boundary |
| Finance localStorage | State persists with correct schema |
| Planner localStorage | State persists; task addition reaches localStorage |
| Security — bundle | Client bundle does not contain raw `ANTHROPIC_API_KEY` or `GOOGLE_CLIENT_SECRET` |
| Security — auth form | Empty credential submission does not crash the page |

## Calendar sync engine — covered by `convex/calendar.test.ts`

Run with `npm run test:convex`. Mocks Google at the server-side `fetch` boundary and drives
the real actions:

| Suite | What it verifies |
|---|---|
| OAuth connect | `googleOauthStart` builds a valid consent URL; callback exchanges the code and stores the refresh token **encrypted** (never plaintext); missing-refresh-token path throws |
| List & select | `listCalendars` maps the Google list; `selectCalendar` persists into `connectionStatus` |
| Import (`syncFromGoogle`) | Timed events → `highPriority` tasks; all-day events skipped; re-import updates the linked task instead of duplicating; throws when no calendar selected |
| Push (`syncToGoogle`) | Schedulable task → event create + link stored; existing link → PUT (update); Google rejection counts as skipped; unscheduled/subtask rows ignored |
| Disconnect | Removes the connection and all event links |
| Auth guards | Every action/mutation rejects unauthenticated callers; `connectionStatus` reports not-connected for anonymous |

## Still needs a real backend / interactive login to verify

Not coverable by either harness without external systems:

- **Google OAuth consent + token exchange against real Google**: needs an interactive Google
  login and `http://localhost:5173/calendar/callback` whitelisted as a redirect URI in the
  Google Cloud console. (The engine logic itself is covered by `test:convex` with a mock.)
- **Receipt scanner**: Requires `ANTHROPIC_API_KEY` in Convex env vars (Claude Haiku action)
- **Travel trip creation**: Requires Convex auth + travel table
- **Finance Convex sync**: Requires authenticated Convex session
- **Share link with real token**: Requires a Convex-issued share token from a real account
- **Streak computation from Convex**: Requires authenticated session with real day data

## Key Design Notes

- **Guest-mode first**: `injectGuestState()` injects `deepblock_state_v1` into localStorage via `addInitScript` before navigation, bypassing the login wall without any auth credentials.
- **Strict-mode safe**: All `[data-tour="date-nav"]` locators use `.first()` — the attribute appears twice in the DOM because `AppChrome` previously rendered children in both desktop and mobile containers. This was fixed in the AppChrome refactor (see findings).
- **Convex noise ignored**: Tests filter out `ConvexError` messages from the JS console so missing-backend errors are not treated as failures.
- **No clock mocking by default**: The crawl runs at real clock time. The monthly-review suite uses `page.clock.setFixedTime()` for date-dependent banner tests.
