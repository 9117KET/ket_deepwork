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

DayState
  date, tasks: Task[], deepWorkSessions, habitCompletions, sleepHours, mood

Task
  id, title, isDone, sectionId, date
  parentId?      ← subtask; completing parent auto-completes children
  scheduledAt?   ← "HH:MM"
  durationMinutes?
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
