# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # TypeScript compile + Vite build → dist/
npm run lint      # ESLint check
npm run preview   # Local preview of production build
```

Unit tests run under Vitest (`npm test`, `npm run test:watch`); Playwright covers
e2e (`npm run test:e2e`). CI runs `lint` then `build` on push/PR to `main`.

On Windows the `build` script (`tsc -b && vite build`) fails under PowerShell 5,
which rejects `&&`. Run `npx tsc -b` and `npx vite build` separately there.

## Deployment

See `docs/DEPLOYMENT.md` for the Convex dev/prod deployment names, the Vercel
project mapping, legacy deployments to avoid, and the pending production setup
steps (auth keys, Google Calendar env vars, domain reclaim).

## Environment

Copy `.env.example` to `.env` and fill in:
- `VITE_CONVEX_URL` (from Convex dashboard - deployment URL)

In the Convex dashboard (Project Settings -> Environment Variables) set:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY_B64` (32-byte AES key, base64)
- `SITE_URL` (your deployed URL, e.g. `https://ket-deepwork.vercel.app`)

## Architecture

**Deepblock** is a React 19 + TypeScript SPA (Vite 7, React Router 7, Tailwind CSS 3) backed by Convex (database + auth + server functions).

### Data flow

- **Guest users**: state lives in `localStorage` under key `deepblock_state_v1`
- **Signed-in users**: same localStorage is used as a cache, synced to Convex via `src/storage/`
- `src/storage/localStorageState.ts` is the single write gateway - it handles both localStorage and Convex upserts

### Core state shape (`src/domain/types.ts`)

```
AppState
  days: Record<ISO-date, DayState>
  habitDefinitions?: HabitDefinition[]
  monthTitles?: Record<string, string>
  activeDays?: string[]          ← streak computation
  identityStatement?: string     ← Atomic Habits "I am X" declaration
  depthPhilosophy?: 'rhythmic' | 'journalistic' | 'bimodal'  ← Cal Newport
  deepWorkGoalHoursPerWeek?: number   ← weekly deep work target (default 20)

DayState
  date, tasks: Task[], deepWorkSessions, habitCompletions, sleepHours, mood

Task
  id, title, isDone, sectionId, date
  parentId?      ← subtask; completing parent auto-completes children
  scheduledAt?   ← "HH:MM"; opt-in anchor for externally fixed times only
  durationMinutes?    ← the planned cost; drives the focus-block progress row
  manualLoggedMinutes?  ← hand-logged progress (timer minutes live on the session)
  isShallow?     ← marks logistical / non-deep work (Cal Newport)

DeepWorkSession
  id, label, durationMinutes, startedAt, finishedAt?
  taskId?        ← task the block was worked against (earned progress)
  ← recorded when a countdown completes, or when an away block is claimed
```

The running block is mirrored into `localStorage` under
`deepblock_active_block_v1` (`src/storage/activeBlock.ts`) so it outlives the
tab — see feature 8 below.

`sectionId` is one of: `mustDo | morningRoutine | highPriority | mediumPriority | lowPriority | nightRoutine`

### Routing (`src/App.tsx` + `src/main.tsx`)

`main.tsx` wraps the app in `<BrowserRouter>` + `<AuthProvider>`. `App.tsx` handles:
1. `?share=TOKEN` — fetches shared planner from Supabase, renders read-only or editable shell
2. Normal routes: `/` (landing), `/planner`, `/travel`, `/finance`, `/calendar`, `/calendar/callback`

### Key directories

| Path | Purpose |
|------|---------|
| `src/domain/` | Types, date utils, stats, time-block allocation — no React, pure logic |
| `src/storage/` | All persistence: localStorage, Supabase planner/sharing/settings |
| `src/contexts/AuthContext.tsx` | Supabase auth state, exposed via `useAuth()` |
| `src/components/planner/` | Day planner UI, task items, weekly overview |
| `src/components/timer/` | Deep work timer (Pomodoro-style) + motivation card |
| `src/components/tracking/` | Monthly habit/mood/sleep dashboard |
| `src/pages/` | Route-level page components |
| `src/services/` | Google Calendar helpers (called by `CalendarSyncPage`) |
| `supabase/functions/` | Edge Functions for Google Calendar OAuth + sync |
| `supabase/migrations/` | SQL schema (5 migration files) |

### Google Calendar (Convex)

> Migrated off Supabase Edge Functions onto Convex. Any `supabase/functions/*`
> calendar code is legacy/unused — the live integration is below. See
> `docs/ROADMAP.md` (Google Calendar phase status) for the backlog.

- **Backend:** `convex/calendar.ts` (public actions/queries) + `convex/calendarInternal.ts`
  (internal queries/mutations). Shared Google helpers in `convex/_shared/google.ts`,
  envelope encryption in `convex/_shared/crypto.ts`.
- **Public API:** `connectionStatus` (query), `googleOauthStart` / `googleOauthCallback`,
  `listCalendars`, `selectCalendar`, `syncFromGoogle`, `syncToGoogle`, `disconnectGoogle`.
- **Tables:** `googleCalendarConnections` (encrypted refresh token + selected calendar)
  and `calendarEventLinks` (task ↔ google event mapping + etag). The client never
  sees tokens — actions decrypt the refresh token and mint short-lived access tokens.
- **Frontend:** `src/services/calendarSyncService.ts` wraps the actions;
  `CalendarSyncPage.tsx` is the UI, `CalendarCallbackPage.tsx` handles the OAuth redirect.
- **Sync rules:** import = timed events → `highPriority` tasks (all-day skipped);
  push = tasks with `scheduledAt` + `durationMinutes` and no `parentId`.
- **Env vars** (Convex dashboard): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_TOKEN_ENCRYPTION_KEY_B64`. Prod still needs these copied over (DEPLOYMENT.md step 2).

### Sharing

`supabase/functions` is not involved — sharing uses `src/storage/supabaseSharing.ts` directly. A share token record in Supabase encodes `permission: "view" | "edit"` and the owner's user ID.

### Streak logic

Streaks require at least one task created **and** at least one task completed on a given day. `activeDays` in `AppState` stores qualifying ISO dates; `src/domain/stats.ts` computes the streak count.

### Deep Work framework (Cal Newport)

Nine features built around the *Deep Work* philosophy:

1. **Session recording** — `DeepWorkTimer` (first card in the sidebar) calls `onSessionComplete(label, minutes, taskId?)` when the countdown ends. A "Working on" selector attributes the block to one of the day's trackable tasks; the selection locks while a session is running or paused. `DayPlanner.handleSessionComplete` appends a `DeepWorkSession` to `DayState.deepWorkSessions`, which is persisted via the normal Supabase sync path (`planner_days.deep_work_sessions` JSONB column).

2. **Daily total badge** — `DayHeader` receives `deepWorkMinutesToday` (computed by `computeDailyDeepWorkMinutes` in `stats.ts`) and renders a teal pill when > 0.

3. **Task depth classification** — `Task.isShallow?: boolean`. Right-click / ⋮ menu shows "Mark as shallow / Mark as deep work". Shallow tasks show an amber badge. When completed shallow tasks total ≥ 120 min, a warning banner appears above the sections.

4. **Weekly scoreboard** — `MonthlyTrackingDashboard` shows a "Deep Work This Week" card: progress bar (hours done vs. editable goal), per-day bar chart. Stats computed by `computeWeeklyDeepWorkHours` in `stats.ts`.

5. **Depth philosophy** — Three chips (Rhythmic / Journalistic / Bimodal) in the tracking dashboard set `AppState.depthPhilosophy`. The *block length* is no longer set there — the dashboard shows a readout and the control lives under the timer's preset chips (feature 9). When set to `rhythmic`, a teal banner above the *High Priority* section shows the current deep block time window.

6. **Task progress boxes** — a task with `durationMinutes >= 30` renders a row of
   30-minute boxes (`TaskProgressBoxes`), collapsing to a segmented bar past six.
   `computeTaskProgress` in `src/domain/taskProgress.ts` fills them: solid teal for
   minutes earned from an attributed `DeepWorkSession`, faded teal for
   `Task.manualLoggedMinutes`, amber for anything logged past the estimate. Timer
   minutes always fill from the left, so earned work is one contiguous run and can
   never be confused with self-reported time. Only manual minutes can be undone.
   On phones the row is one button opening `TaskProgressSheet`, which offers the
   timer first and hand-logging second. Rendered by `TaskItem` (via
   `SectionColumn` / `SideQuestSection`), `MustDoPinnedHeader`, and read-only in
   `TomorrowMustPanel` (tomorrow has no logged work yet).

7. **Time as an opt-in anchor** — `Task.scheduledAt` is no longer a field on the
   task row. Sections already say when work happens, so tasks are budgeted by
   duration; a clock time is set only for externally fixed commitments, via
   `TimeAnchor` (the ⋮ menu in `TaskItem`, a hover clock icon in the MUST panels).
   Everything keyed on `scheduledAt` — `useTimeAwareness` nudges,
   `TaskConflictModal`, calendar push in `convex/calendar.ts` — is unchanged and
   now fires only on anchored tasks.

8. **Work done away from the screen** — the countdown is mirrored to
   `localStorage` (`src/storage/activeBlock.ts`) on every state change, keyed on
   the absolute instant it lands on. On mount `restoreTimer()` in
   `useDeepWorkTimer` resolves it three ways: still in flight → resumes live;
   paused → comes back paused; ran out while the app was closed → surfaces as
   `pendingAwayBlock`, rendered by `AwayBlockClaim` at the top of the planner.
   Claiming it calls `handleRecordAwaySession`, which writes a real
   `DeepWorkSession` (earned, solid) against the day the block *started* on,
   with its true start/finish instants. Discarding clears the record. Claims
   older than `AWAY_BLOCK_MAX_AGE_MS` (12h) are dropped unasked.

   For work no timer ever saw, `ManualLogPanel` in `TaskProgressSheet` logs a
   whole stretch at once — a block stepper, or a clock range parsed by
   `parseClockRangeMinutes` in `taskProgress.ts`. All of it still writes
   `manualLoggedMinutes` and fills faded. Completing a trackable task with an
   unlogged remainder raises a one-tap offer to log it by hand (12s, then it
   expires); the row is never filled automatically. `computeWeeklySelfReportedHours`
   shows the hand-logged total beside the weekly scoreboard, explicitly *not
   counted* toward it.

9. **Block length is set from the timer** — the preset chips pick this run's
   length; the line under them (`BlockLengthLine`) shows `Your block: Xm on · Ym
   off` and offers "Make Nm my block" whenever the picked length differs from
   the configured one, calling `handleSetBlockLength` in `DayPlanner`. The
   tracking dashboard keeps a readout only.

Both `depthPhilosophy` and `deepWorkGoalHoursPerWeek` are global settings synced via `user_settings` JSONB — no migration required. `manualLoggedMinutes` and `taskId` are additive optional fields on existing JSON payloads — no migration either.

### Atomic Habits features

- **Identity statement** — `AppState.identityStatement` (string), synced via `user_settings` JSONB. Editable inline in `HabitChecklist` (click-to-edit pattern with `editingIdentity` local state).
- **Habit definitions** — `HabitDefinition[]` with `id`, `label`, and optional `stackAnchor`. Default set in `DEFAULT_HABIT_DEFINITIONS` (types.ts). CRUD via `HabitEditorModal` — add/delete/reorder (▲▼ buttons) + anchor field. Saved to `AppState.habitDefinitions` and synced via `user_settings`.
- **Habit checklist** (`src/components/habits/HabitChecklist.tsx`) — sidebar card: identity statement (click-to-edit), habit rows with toggle button, 🔥 streak badge, amber ⚠ at-risk highlight. `collapsed` local state; `doneCount/totalCount` in header.
- **Never-miss-twice logic** — `getAtRiskHabitIds(days, habitIds, today)` in `stats.ts`: a habit is at-risk when `days[yesterday].habitCompletions[id] !== true` AND `days[dayBeforeYesterday].habitCompletions[id] === true`. Displayed as amber border + ⚠ icon; tooltip: "You missed yesterday — don't miss twice".
- **Per-habit streaks** — `computePerHabitStreaks(days, habitIds, untilDate)` in `stats.ts`: walks backwards up to 365 days counting consecutive completed days.
- **Habit completions** — `DayState.habitCompletions: Record<string, boolean>`. Toggled via `handleToggleHabit` in `DayPlanner`, persisted via the normal planner day upsert path.
- **Monthly habit grid** — `HabitTrackingGrid` inside `MonthlyTrackingDashboard`: rows = habits, columns = days 1–31, final column = streak. Wrapped in `HabitGridBoundary` error boundary. Read-only (completions toggled from the sidebar, not the grid).
- **Habit editor modal** (`src/components/habits/HabitEditorModal.tsx`) — opened via `setEditHabitsOpen(true)` in DayPlanner. Works on a local `draft` copy of `HabitDefinition[]`; saves on "Save" click only.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
