# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # TypeScript compile + Vite build → dist/
npm run lint      # ESLint check
npm run preview   # Local preview of production build
```

No test runner is configured. CI runs `lint` then `build` on push/PR to `main`.

## Environment

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Architecture

**Deepblock** is a React 19 + TypeScript SPA (Vite 7, React Router 7, Tailwind CSS 3) backed by Supabase (PostgreSQL + Auth + Edge Functions).

### Data flow

- **Guest users**: state lives in `localStorage` under key `deepblock_state_v1`
- **Signed-in users**: same localStorage is used as a cache, synced to Supabase (`planner_days` table) via `src/storage/`
- `src/storage/localStorageState.ts` is the single write gateway — it handles both localStorage and Supabase upserts

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
  scheduledAt?   ← "HH:MM"
  durationMinutes?
  isShallow?     ← marks logistical / non-deep work (Cal Newport)

DeepWorkSession
  id, label, durationMinutes, startedAt, finishedAt?
  ← recorded automatically when the sidebar timer completes
```

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

### Supabase Edge Functions (Google Calendar)

Six Deno edge functions under `supabase/functions/`:
- `google-oauth-start` / `google-oauth-callback` — OAuth flow
- `google-calendars-list` / `google-calendar-select` — calendar selection
- `google-sync-pull` / `google-sync-push` — bidirectional event sync

Tokens are stored server-side in the `google_calendar_sync` table; the client never sees them.

### Sharing

`supabase/functions` is not involved — sharing uses `src/storage/supabaseSharing.ts` directly. A share token record in Supabase encodes `permission: "view" | "edit"` and the owner's user ID.

### Streak logic

Streaks require at least one task created **and** at least one task completed on a given day. `activeDays` in `AppState` stores qualifying ISO dates; `src/domain/stats.ts` computes the streak count.

### Deep Work framework (Cal Newport)

Five features built around the *Deep Work* philosophy:

1. **Session recording** — `DeepWorkTimer` in the sidebar calls `onSessionComplete(label, minutes)` when the countdown ends. `DayPlanner.handleSessionComplete` appends a `DeepWorkSession` to `DayState.deepWorkSessions`, which is persisted via the normal Supabase sync path (`planner_days.deep_work_sessions` JSONB column).

2. **Daily total badge** — `DayHeader` receives `deepWorkMinutesToday` (computed by `computeDailyDeepWorkMinutes` in `stats.ts`) and renders a teal pill when > 0.

3. **Task depth classification** — `Task.isShallow?: boolean`. Right-click / ⋮ menu shows "Mark as shallow / Mark as deep work". Shallow tasks show an amber badge. When completed shallow tasks total ≥ 120 min, a warning banner appears above the sections.

4. **Weekly scoreboard** — `MonthlyTrackingDashboard` shows a "Deep Work This Week" card: progress bar (hours done vs. editable goal), per-day bar chart. Stats computed by `computeWeeklyDeepWorkHours` in `stats.ts`.

5. **Depth philosophy** — Three chips (Rhythmic / Journalistic / Bimodal) in the tracking dashboard set `AppState.depthPhilosophy`. When set to `rhythmic`, a teal banner above the *High Priority* section shows the current deep block time window.

Both `depthPhilosophy` and `deepWorkGoalHoursPerWeek` are global settings synced via `user_settings` JSONB — no migration required.

### Atomic Habits features

- **Identity statement** — `AppState.identityStatement` (string), synced via `user_settings` JSONB. Editable inline in `HabitChecklist` (click-to-edit pattern with `editingIdentity` local state).
- **Habit definitions** — `HabitDefinition[]` with `id`, `label`, and optional `stackAnchor`. Default set in `DEFAULT_HABIT_DEFINITIONS` (types.ts). CRUD via `HabitEditorModal` — add/delete/reorder (▲▼ buttons) + anchor field. Saved to `AppState.habitDefinitions` and synced via `user_settings`.
- **Habit checklist** (`src/components/habits/HabitChecklist.tsx`) — sidebar card: identity statement (click-to-edit), habit rows with toggle button, 🔥 streak badge, amber ⚠ at-risk highlight. `collapsed` local state; `doneCount/totalCount` in header.
- **Never-miss-twice logic** — `getAtRiskHabitIds(days, habitIds, today)` in `stats.ts`: a habit is at-risk when `days[yesterday].habitCompletions[id] !== true` AND `days[dayBeforeYesterday].habitCompletions[id] === true`. Displayed as amber border + ⚠ icon; tooltip: "You missed yesterday — don't miss twice".
- **Per-habit streaks** — `computePerHabitStreaks(days, habitIds, untilDate)` in `stats.ts`: walks backwards up to 365 days counting consecutive completed days.
- **Habit completions** — `DayState.habitCompletions: Record<string, boolean>`. Toggled via `handleToggleHabit` in `DayPlanner`, persisted via the normal planner day upsert path.
- **Monthly habit grid** — `HabitTrackingGrid` inside `MonthlyTrackingDashboard`: rows = habits, columns = days 1–31, final column = streak. Wrapped in `HabitGridBoundary` error boundary. Read-only (completions toggled from the sidebar, not the grid).
- **Habit editor modal** (`src/components/habits/HabitEditorModal.tsx`) — opened via `setEditHabitsOpen(true)` in DayPlanner. Works on a local `draft` copy of `HabitDefinition[]`; saves on "Save" click only.
