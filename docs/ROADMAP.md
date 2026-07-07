# Product roadmap & cross-feature architecture

_Last updated: 2026-06-14. Living document — update as phases land._

This captures **deferred work** and **how the features talk to each other**, so any
build session can resume without re-deriving context. For the finance redesign
rationale (waterfall vs. buckets), see the commit `f232b1f` and
`src/domain/financeWaterfall.ts`.

---

## Finance — phase status

### ✅ Phase 1 (shipped, `f232b1f`)
Monthly waterfall dashboard, fast daily capture (receipt scan → daily transaction,
voice add), voice shopping list, life-ambition savings presets, 5-group nav
(Today · Plan · Goals · Grow · Setup), secondary BucketHealth view.

### ⏳ Phase 2 — Net worth, Debts, Bucket-health polish (NEXT)
Goal: make the Grow/Setup tabs trustworthy and wire them into the waterfall.

- **Net worth** (`NetWorthTracker.tsx`)
  - **Persistence gap to fix:** `balanceOverrides`, `debtOverrides`, `adHocAssets`,
    `adHocLiabilities` are component `useState` — they reset on reload; only the
    saved snapshot survives. Move live balances into `FinancialState` (e.g.
    `accounts[].balance` updates + a persisted `netWorthManualEntries`).
  - Auto-roll-up: assets = account balances + savings-goal `currentAmount`;
    liabilities = debt balances. Reduce manual entry.
  - Surface current net worth as a small card on the Today dashboard.
- **Debts** (`DebtManager.tsx`)
  - Feed each debt's `minimumPayment` into the waterfall as a Monthly-bill line
    (today bills come only from `csp.expenses` fixed bucket — debts are invisible
    to the waterfall). Decide: auto-include vs. an explicit "count in bills" toggle.
  - Payoff projection (avalanche/snowball already modelled) → months-to-debt-free.
  - Debt balances already flow into Net worth liabilities; verify after persistence fix.
- **Bucket-health polish** (`BucketHealth.tsx`)
  - Currently budget-only (CSP percentages vs. targets). Add **actual vs. budget**
    by pulling `transactions[month]` per bucket (logic already exists in
    `ExpenseTracker`), plus a one-line "you're over on X" nudge.
  - Link from the waterfall ("see bucket health") so the blended model is discoverable.

### 🔭 Phase 3 — Automation & intelligence (later)
- **Recurring monthly template:** auto-seed each new month's `incomeSources` and
  recurring bills from the previous month so the waterfall isn't blank on the 1st.
- **Money-date review** (`lastMoneyDateAt` already exists): a monthly prompt to
  reconcile balances, take a net-worth snapshot, and roll leftover into savings.
- **Advisor context:** feed the waterfall summary + net worth into
  `convex/financialAdvisor.ts` system prompt.
- **FIRE integration:** pull `currentPortfolioValue` from net worth automatically.

---

## Google Calendar — phase status

The integration was **migrated off Supabase Edge Functions onto Convex** (the
CLAUDE.md "Supabase Edge Functions" section is stale — the live code is in
`convex/calendar.ts` + `convex/calendarInternal.ts`).

### ✅ Phase 1 (shipped)
Full Convex backend + driving UI.
- **Backend** (`convex/calendar.ts`): OAuth start/callback, `listCalendars`,
  `selectCalendar`, `syncFromGoogle` (Google → planner), `syncToGoogle`
  (planner → Google), `disconnectGoogle`, and a client-readable
  `connectionStatus` query (no secrets). Refresh tokens are AES-encrypted at
  rest (`_shared/crypto.ts`); access tokens are minted per call.
- **Schema:** `googleCalendarConnections` (one per user) + `calendarEventLinks`
  (task ↔ google event, with etag for optimistic concurrency on push).
- **Sync model:** imported timed events become `highPriority` tasks; only tasks
  with `scheduledAt` + `durationMinutes` (and no `parentId`) are pushed.
  All-day events are skipped. Idempotent via `calendarEventLinks`.
- **UI** (`CalendarSyncPage.tsx`): auth gate → connect → calendar picker →
  date-range Import/Push → disconnect, with result banners. OAuth `state` is
  stashed in `sessionStorage` and verified in the callback (CSRF mitigation).

**Prod blocker (see `DEPLOYMENT.md` step 2):** copy `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY_B64` to the **prod** Convex
deployment and add the prod `/calendar/callback` redirect URI to the Google OAuth
client. Until then sync only works on dev.

### ⏳ Phase 2 — Reliability & reach (NEXT)
- **All-day events:** currently dropped on import. Decide a representation
  (unscheduled task on the day vs. a date-only block) and round-trip them.
- **Deletions:** neither side propagates deletes. A deleted Google event leaves a
  stale linked task (and vice-versa). Use `calendarEventLinks` to reconcile —
  prune links whose event/task no longer exists.
- **CSRF hardening (server-side):** `state` is only checked client-side today.
  Persist it server-side in `googleOauthStart` and verify in `googleOauthCallback`.
- **Push scope:** pushes every scheduled task in range on each run. Consider an
  opt-in flag per task or a "don't push shallow tasks" toggle.
- **412 on push:** etag conflicts are silently `skipped`. Surface a "N had
  conflicting Google edits" nudge and offer re-pull.

### 🔭 Phase 3 — Automation (later)
- **Auto-sync:** a Convex cron / scheduled action to pull+push the rolling window
  instead of manual buttons. Needs token-refresh resilience + per-user opt-in.
- **Calendar → planner time-blocking:** feed imported events into the rhythmic
  deep-work block window so the planner respects real commitments.
- **Travel ↔ Calendar:** push trip day-plan blocks (from `travelTrips.dailyPlan`)
  to Google as part of the cross-feature map below.

---

## Cross-feature communication map

How the pillars share state. All signed-in sync rides Convex tables; guests use
localStorage mirrors.

```
                    ┌─────────────── Convex auth (global) ───────────────┐
                    │  useConvexAuth() → isAuthenticated gates ALL sync   │
                    └────────────────────────────────────────────────────┘
   Planner (AppState)            Travel (travelTrips)         Finance (FinancialState)
   localStorage: deepblock_state_v1   Convex: travelTrips     localStorage: deepblock_finance_v1
        │                              │                            │
        │  pre-trip tasks  ───────────>│                            │
        │  (preTripTasks.ts inject)    │                            │
        │                              │  trip budget ─────────────>│  Critical expense
        │                              │  (WaterfallDashboard picker, api.travel.list)
        │                              │  trip actual spend ───────>│  daily transaction
        │                              │  (financebridge.ts)        │
        │                                                           │
        │  <─ shopping list lives in Finance (state.shoppingList) ──┘
```

**Existing links**
- **Travel → Finance (planned):** `WaterfallDashboard` critical-expense picker reads
  `api.travel.list`, inserts a trip's `budget.totalBudget` as a `CriticalExpense{tripId}`.
- **Travel → Finance (actual):** `domain/financebridge.ts` + `TripDetailPage`
  `handleLogExpenseToFinance` → `FinanceTransaction`.
- **Travel → Planner:** `domain/preTripTasks.ts` injects prep tasks into planner days.

**Gaps / opportunities (unbuilt)**
- **Finance → Planner:** shopping-list items or "money date" could surface as planner
  tasks on a chosen day.
- **Net worth ← everything:** single roll-up of accounts + goals − debts (phase 2).
- **One income source of truth:** `csp.monthlyNetIncome` vs. per-month `incomeSources`
  — waterfall already prefers `incomeSources` and falls back; keep that contract.

---

## Auth — current state & known issues

**Stack:** Convex Auth (`@convex-dev/auth`, Password provider). `convex/auth.ts`,
`convex/auth.config.ts` (`domain: CONVEX_SITE_URL`), routes via `convex/http.ts`.
Client: `ConvexAuthProvider` in `main.tsx` → `AuthContext.tsx` exposes
`useAuth()` (signIn/signUp/signOut/user) over `useConvexAuth()`.

**Deployments** (see `DEPLOYMENT.md`): prod `nautical-wolf-453` (JWT keys set
2026-06-12, sign-in worked then); dev `knowing-gopher-377` (used by `npx convex dev`
and Vercel previews). Local client URL comes from `.env.local` `VITE_CONVEX_URL`.

### ✅ Login fixed (2026-06-14)
Local-dev sign-in no longer entered the app: the **dev** deployment's `JWKS` env var
was corrupted with embedded newlines (Windows `cmd.exe` mangling), so JWT signatures
couldn't be verified → endless refresh loop, `isAuthenticated` stuck false. Fixed by
regenerating + re-setting `JWKS`/`JWT_PRIVATE_KEY` via `--from-file`. See
`DEPLOYMENT.md` (2026-06-14 note). **No app code changed** — it was an env-var data bug.

### ⚠️ Remaining auth-gating inconsistencies (UX, optional)
1. **Login wall only on `/planner`.** `PlannerPage.tsx` is the only page that renders
   `LoginForm`. `/finance`, `/travel`, `/calendar` render with **no auth gate**, so
   they're usable while signed out — they just don't sync (`useQuery(..., 'skip')`).
2. **Guest mode is per-page local state** (`useState(false)` in PlannerPage) — not
   persisted, not shared. Signing in on planner isn't reflected elsewhere; the guest
   choice resets on navigation.
3. There **is** an "Account" item in `AppChrome`'s sidebar (sign-in/out), so auth is
   not entirely invisible — but the wall/guest behaviour still differs per page.

### Proposed fix (phase: Auth)
- Lift auth/guest decision to a **single app-level guard or context flag**
  (persist the guest choice, e.g. `deepblock_guest`), consumed by `AppChrome` so
  every page reflects the same state.
- Add a small **account menu** in `AppChrome` (email + Sign out when authed;
  "Sign in to sync" CTA when guest).
- Decide per-feature gating policy: keep finance/travel usable as guest (local only)
  but show a persistent "not syncing — sign in" banner.

---

## Travel planner — update backlog (needs scoping)

Candidate work, pending direction:
- Tighten the **Travel → Finance** loop (budget vs. actual on the trip budget tab,
  one-tap "log to finance" for every expense, reconcile on trip completion).
- Surface **upcoming trips on the finance Today dashboard** (not just the picker).
- Trip **packing/prep tasks** visibility from the planner side.
- Multi-currency clarity on the budget tab (base vs. local).

> Fill in concrete travel requirements here when scoped.
