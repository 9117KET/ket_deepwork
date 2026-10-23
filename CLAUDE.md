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

## Data safety

`docs/data-safety.md` is the register of actions that can destroy recorded work,
which guards exist, and which gaps are still open. Read it before touching a
delete path, the deep work timer, or anything that writes `deepWorkSessions`.

The one rule underneath it: **worked minutes are sacred**. A task can be
retyped; ninety minutes you actually sat and worked cannot be recovered once the
record is gone. Rules live in `src/domain/workSafety.ts` with unit tests
alongside; behaviour is pinned by `e2e/work-safety.spec.ts`.

## Design

`docs/design/` holds the mobile and desktop redesign source (one `.dc.html` per
artboard, plus `canvas.json` and PNG previews) and the measured diagnosis that
motivated it. Read `docs/design/README.md` before changing planner layout — it
records which screen owns which feature, and why the mobile tabs currently
render ~2,500px of identical content.

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
- `GMAIL_SMTP_USER` / `GMAIL_SMTP_APP_PASSWORD` (challenge reminder emails; see
  `docs/DEPLOYMENT.md` step 3)

## Architecture

**Deepblock** is a React 19 + TypeScript SPA (Vite 7, React Router 7, Tailwind CSS 3) backed by Convex (database + auth + server functions).

### Data flow

- **Guest users**: state lives in `localStorage` under key `deepblock_state_v1`
- **Signed-in users**: same localStorage is used as a cache, synced to Convex via `src/storage/`
- `src/storage/localStorageState.ts` is the single write gateway - it handles both localStorage and Convex upserts

### Cross-device sync (`usePersistentState`)

localStorage is the source of truth; Convex is how devices agree. Four rules
carry the whole design, and each exists because of a specific failure:

1. **Reads are split hot/cold.** `plannerDays.getRecent` (last `HOT_WINDOW_DAYS`
   = 14) and `getArchive` (everything older) are two subscriptions over the
   `by_user_date` index. A Convex query re-runs when its read set changes, so
   the old single `getAll` re-read the *entire* history on every task tick —
   ~610 KB × every edit, growing forever, which is how the free-tier I/O budget
   was blown in June 2026. Editing today now invalidates only the recent window.
   `getAll` still exists for `/restore`; do not point live sync back at it.
2. **Writes are only dirty days, capped.** `update()` marks edited dates
   pending; `buildDaysSyncPayload` sends at most `MAX_DAYS_PER_SYNC` = 25 of
   them, newest first, and a backlog drains over paced passes. The original
   one-shot migration sent everything in one mutation and overran the quota
   mid-upload.
3. **A failed write never clears its pending flag.** This is what preserved
   2.5 months of edits through the 2026-06→09 outage.
4. **Hydration reconciles.** Any day held locally that the server has never
   received is queued for upload (skipping empty days via `isEmptyDay`). Without
   this, a day whose pending flag was lost is stranded on one machine forever,
   looking healthy there and not existing anywhere else — the worst shape a sync
   bug takes. Days are never deleted server-side, so "local has it, remote does
   not" is unambiguous.

Conflicts are last-write-wins on a client-stamped `updatedAt`, guarded on both
sides (`isStaleWrite` on the server, `isRemoteDayStale` on the client).

**Any change to a sync payload is a two-sided deploy** — the client ships via
Vercel on push to `main`, the backend only when someone runs `npx convex
deploy`. Shipping one without the other silently breaks all sync; see
`docs/DEPLOYMENT.md`.

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
  manualLoggedMinutes?  ← LEGACY hand-logged total; still read, never written
                           (hand-logged time is now a manual DeepWorkSession)
  isShallow?     ← marks logistical / non-deep work (Cal Newport)

DeepWorkSession
  id, label, durationMinutes, startedAt, finishedAt?
  taskId?        ← task the block was worked against (earned progress)
  source?        ← 'manual' = self-reported; absent = earned on the timer
  loggedAt?      ← when a manual claim was made (manual only)
  ← recorded when a countdown completes, when an away block is claimed,
    or when work is logged by hand
```

The running block is mirrored into `localStorage` under
`deepblock_active_block_v1` (`src/storage/activeBlock.ts`) so it outlives the
tab — see feature 8 below.

`sectionId` is one of: `mustDo | morningRoutine | highPriority | mediumPriority | lowPriority | nightRoutine`

### Today and the calendar

Time belongs to Google Calendar; the planner keeps what a calendar cannot.
`DayPlanner` renders, top to bottom: `DayHeader`, `CalendarTimeline` (the day's
events, read-only, via `useCalendarDay`), the Top 3 (`MustDoPinnedHeader`), and
one list, "Tasks" (`highPriority`). Days planned before the minimal rewrite
still show their other sections (`morningRoutine` … `sideQuest`) whenever they
hold tasks — never hidden, never migrated. New tasks only use the one list.

There is no block schedule, day setup, sleep window or NOW card any more
(`sectionTimeBlocks.ts`, `useDayBlockEditor`, `useTimeAwareness` were deleted).
A task gets a time by being **scheduled**: `ScheduleChip` → `ScheduleSheet` →
`scheduleTask`, which writes a real event with a 10-minute popup reminder, so
the calendar does the reminding on every device. `Task.scheduledAt` mirrors the
event's start. Without a connection the sheet still sets a plain time and says
no reminder comes with it.

`useWorkLog` copies each finished, earned (`source !== 'manual'`) session from
the last 36h to the "Deepblock log" calendar. It is driven by recorded sessions,
not the timer callback, so away-block claims and other devices are covered too;
the server derives the event id from the session id, so re-sending is a no-op.

**Tasks are mirrored into Google Tasks, both ways.** Every task on the open day
is a Google Task in a "Deepblock" list, due on its day — which is how it shows
on Google Calendar with a checkbox. `useTaskSync` sends the day's tasks
(`id`, `title`, `isDone`, `parentId` only) 1.2s after the last edit, on
foreground and every 2 min, to `tasks.syncDayTasks`, which reads the same day
from Google and reconciles with `planTaskSync` (`convex/_shared/taskSync.ts`,
pure). Each `googleTaskLinks` row keeps the last state both sides agreed on;
the side that differs from it is the side that changed, and the planner wins a
tie. A pull is applied by `handleApplyRemoteTaskChanges` and only recorded as
agreed once the planner echoes it back. Three rules: **a sync never deletes**
(a planner delete calls `tasks.removeTask` once Undo has expired, exactly like
`unscheduleTask`); **a Google delete leaves the planner task alone** (the link
is marked `remoteGone` and the task is never re-sent); **sync is off while
hydrating** (`isHydrating`), because a half-loaded day is not the day. The
Tasks scope was added after the first connections, so `connectionStatus.tasksEnabled`
is false until the user reconnects; `/calendar` and Today both say so.

### Accountability challenge

Two people, one season (e.g. 1 Oct → 31 Dec), each with their own goals and
"don'ts", and two explicit acts a day: **Lock in today's plan** before a morning deadline and
**Check in** before midnight. It replaces a WhatsApp thread; WhatsApp stays
the ping (the Share button hands a prefilled line to the Web Share sheet, or
copies it), the app is the record.

**The planner stays private.** The partner never reads `plannerDays`. What
they see is the `summary` the member's own client publishes into
`challengeDays` — Top 3 titles with done state, done/total for the rest, a
count of private tasks, earned deep-work minutes, habits done/total — built by
`buildChallengeSummary` in `src/domain/challenge.ts` and sent by
`useChallengeSync` (the `useTaskSync` shape: 1.2s debounce, foreground
refresh, off while hydrating). `Task.isPrivate` keeps a task out of the
summary: counted, never titled, still mirrored to the user's own Google Tasks.
Every function in `convex/challenges.ts` derives the caller from the identity
and checks membership; the partner view (`dayView`) never carries reminder
bookkeeping or a `userId`.

**Tables** (`convex/schema.ts`, validators shared via
`convex/_shared/challengeValidators.ts` so arg and table cannot drift):
`challenges` (span, local deadlines, `status` — the cron's one switch),
`challengeMembers` (one per user, with an IANA `timezone` refreshed on every
sync, because the two are in different zones, and the member's own `goals`
and `donts`), `challengeInvites` (7-day token, one seat), `challengeDays` (one
row per member per day: summary, `planSetAt`, `checkinAt`, note,
`dontsBroken`, `remindersSent`).
Legacy `shareTokens` is untouched. A user is in at most one active challenge.

**Goals and don'ts are per member.** Each member sets theirs on create or
join and edits them any time (`updateMyCommitments`); the partner reads them
via `memberView` and cannot change them. A removed don't is archived
(`archivedAt`), never deleted, and an edited one keeps its id, so every
`dontsBroken` id resolves forever (`resolveDontTexts` in
`src/domain/challengeCommitments.ts`). `challenges.goals`/`donts` are legacy,
never written again: a creator whose member row has no lists falls back to
them (`memberCommitments`), which is the whole migration.

**Reads are split hot/cold here too.** `myChallenge` and `dayCards` are small
and live; `history` returns the whole season and callers pass
`toDate = yesterday`, so today's debounced writes never invalidate it.

**Reminders are email from the user's own Gmail** (`convex/email.ts`, a
`"use node"` nodemailer action; swap to Resend in `send()` once a domain
exists). `convex/crons.ts` runs `reminders.sweep` every 15 minutes:
`challengesInternal.claimDueReminders` decides *and records* in one
transaction (a failed send costs one email, never doubles one), then the
action sends. The rules are pure in `convex/_shared/challengeReminders.ts`:
after the plan deadline every 120 min, four at most; from 21:30 local every
90 min for the check-in, two at most; each judged on the member's own clock.
`nudgePartner` schedules one email a day from inside the mutation.

**Routes and entry points:** `/challenge` (create / join / dashboard with the
countdown, both members' cards, the season grid, invite link),
`/challenge/join?invite=TOKEN` (`?invite=`, not `?code=`, which Convex Auth
intercepts; the token survives sign-up in sessionStorage). On Today:
`ChallengeCard` under the header, a "Day 22/92 · 70 left" pill in
`DayHeader`, and "Hide from partner" in the task menu. Review gets a
challenge section. The mobile tab bar is unchanged. Guests cannot take part.

**Tests:** `npm test` covers `src/domain/challenge.test.ts`;
`npm run test:convex` covers `convex/challenges.test.ts`,
`convex/reminders.test.ts` (mocked nodemailer) and the reminder rules. A
two-account flow cannot run in e2e (guest-only seeding).

### Responsive foundations

Mobile-first, and "mobile" means the whole spread — 280px Fold cover screens up
to 1920px, phones held sideways, and notched devices. Four rules, each with a
gate in `e2e/mobile-responsive.spec.ts`:

1. **`viewport-fit=cover` and safe-area insets are a pair.** `index.html` opts
   into the display cutout; without that meta every `env(safe-area-inset-*)`
   silently resolves to 0 and the padding below does nothing. Bottom-fixed
   chrome uses `.pb-safe-nav` (`max(0.5rem, inset)`) so it keeps its ordinary
   padding on flat screens and only grows to clear a home indicator. Fixed
   elements cannot inherit the shell's `px-safe`, so `MobileTabBar` sets its own
   left/right insets inline for landscape notches. Sheets are `z-[80]`, toasts
   dock at `z-70` via `.toast-dock`, the tab bar is `z-[60]`. On a coarse
   pointer every `input`, `select` and `textarea` is 16px (iOS zoom) and at
   least 44px tall (`src/index.css`), and the task rows switch to the phone
   anatomy (checkbox, title, one chip, ⋮ → `TaskActionSheet`) via
   `useCoarsePointer()`; the gates live in `e2e/mobile-today.spec.ts` and
   `e2e/mobile-panels.spec.ts`, with shared fixtures in `e2e/helpers/mobile.ts`.
2. **`dvh`, never `vh`.** `100vh` on a phone includes the URL bar that is about
   to collapse, so the bottom of a `h-screen` layout is cut off. `#root` sets
   `100vh` then `100dvh` (older browsers keep the first).
3. **44px touch targets** (WCAG 2.5.8 / Apple HIG). Use `.touch-target` when a
   control should always be thumb-sized, and `.touch-target-coarse` — gated on
   `(pointer: coarse)` — for dense rows that should stay compact under a mouse.
   Two exceptions are deliberate and skipped by the gate: buttons inline in a
   sentence, and the 31-column month grid (44px cells would be a 1364px row, so
   it lives in a horizontal scroller and its cells lift 24px → 32px on touch).
4. **Landscape phones are short, not narrow.** The `short:` breakpoint
   (`max-height: 500px`) trims vertical chrome; `touch:` targets coarse pointers.
   Fixed chrome must stay under 30% of a 390px-tall screen.

Utilities live in `src/index.css` under `@layer utilities`; breakpoints in
`tailwind.config.js`.

### Routing (`src/App.tsx` + `src/main.tsx`)

`main.tsx` wraps the app in `<BrowserRouter>` + `<AuthProvider>`. `App.tsx` routes:
`/` (the planner — there is no landing page), `/review` (this week's worked
time + habits), `/calendar`, `/calendar/callback`, `/privacy` (needed for the
Google OAuth consent screen), `/restore`, `/challenge` and `/challenge/join`.
`/planner`, `/planner/review` and any unknown path redirect, so old bookmarks
still land.

The landing page, travel, finance, sharing, goals/reviews, journal, shutdown
ritual, side quests and onboarding tour were removed in the minimal rewrite.
Their Convex functions are gone too, but their **tables** (`shareTokens`,
`financialSettings`, `travelTrips`) stay in `convex/schema.ts`, and their fields
stay in `AppState`, on purpose: removing a table definition or a field is how
stored data gets dropped, and that only happens after the export in
`docs/DEPLOYMENT.md` ("Shipping the minimal rewrite").

### Key directories

| Path | Purpose |
|------|---------|
| `src/domain/` | Types, date utils, stats, task progress, work safety — no React, pure logic |
| `src/storage/` | All persistence: localStorage gateway, Convex sync, active block mirror |
| `src/contexts/AuthContext.tsx` | Convex auth state, exposed via `useAuth()` |
| `src/components/planner/` | Today: header, calendar timeline, Top 3, task list, schedule sheet |
| `src/components/timer/` | Deep work timer, phone Focus panel, desktop Focus mode |
| `src/components/habits/` | Habit checklist, phone Habits panel, habit editor |
| `src/components/challenge/` | Challenge card on Today, check-in sheet, create/join, dashboard, season grid |
| `src/hooks/` | `useTaskHandlers`, `useCalendarDay`, `useWorkLog`, `useChallenge`, `useChallengeSync`, undo |
| `src/pages/` | Route-level page components |
| `src/services/calendarSyncService.ts` | Client wrappers for the Convex calendar actions |
| `src/services/challengeService.ts` | Client wrappers for the challenge functions, device timezone, Web Share |

### Google Calendar (Convex)

- **Backend:** `convex/calendar.ts` (public actions/queries) + `convex/calendarInternal.ts`
  (internal queries/mutations). Shared Google helpers in `convex/_shared/google.ts`,
  envelope encryption in `convex/_shared/crypto.ts`, the free-slot search and the
  log event id in `convex/_shared/freeSlot.ts` (pure, unit-tested).
- **Public API:** `connectionStatus` (query), `googleOauthStart` / `googleOauthCallback`,
  `listCalendars`, `selectCalendar`, `listEvents`, `scheduleTask`, `unscheduleTask`,
  `logWorkBlock`, `disconnectGoogle`; and in `convex/tasks.ts`, `syncDayTasks` and
  `removeTask` (Google Tasks, see "Today and the calendar").
- **Rules:** `listEvents` is read-only and writes nothing to the planner (the old
  import copied events in as tasks; it is gone). `scheduleTask` places a task in
  the first free gap between now/08:00 and 22:00 using freeBusy on the chosen
  calendar and `primary`, or at an exact `startTime`; a task already linked is
  moved (PATCH), never duplicated. `logWorkBlock` lazily creates the "Deepblock
  log" calendar (`googleCalendarConnections.logCalendarId`), recreates it if the
  user deleted it, and treats 409 as already logged. The calendar defaults to
  `primary` when none is selected.
- **Tables:** `googleCalendarConnections` (encrypted refresh token, granted scopes,
  selected calendar, log calendar, task list), `calendarEventLinks` (task ↔ event
  mapping) and `googleTaskLinks` (task ↔ Google Task, with the last agreed title
  and done state). The client never sees tokens — actions decrypt the refresh
  token and mint short-lived access tokens.
- **Tests:** `npm run test:convex` runs `convex/calendar.test.ts` and
  `convex/tasks.test.ts` against a mocked Google `fetch`.
- **Env vars** (Convex dashboard): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_TOKEN_ENCRYPTION_KEY_B64`. Prod still needs these copied over (DEPLOYMENT.md step 2).
  The Google Cloud project must have the **Google Tasks API** enabled as well as
  the Calendar API, or every task sync fails with a 403.
- **OAuth app status:** while the Google consent screen is in *Testing*, refresh
  tokens expire after 7 days and the calendar silently disconnects weekly.
  Publishing it needs `/privacy`, which describes exactly this data use.

### Streak logic

Streaks require at least one task created **and** at least one task completed on a given day. `activeDays` in `AppState` stores qualifying ISO dates; `src/domain/stats.ts` computes the streak count.

### Deep Work framework (Cal Newport)

Features built around the *Deep Work* philosophy:

1. **Session recording** — `DeepWorkTimer` (first card in the sidebar) calls `onSessionComplete(label, minutes, taskId?)` when the countdown ends. A "Working on" selector attributes the block to one of the day's trackable tasks; the selection locks while a session is running or paused. `DayPlanner.handleSessionComplete` appends a `DeepWorkSession` to `DayState.deepWorkSessions`, which is persisted via the normal Supabase sync path (`planner_days.deep_work_sessions` JSONB column).

2. **Daily total badge** — `DayHeader` receives `deepWorkMinutesToday` (computed by `computeDailyDeepWorkMinutes` in `stats.ts`) and renders a teal pill when > 0.

3. **Task depth classification** — `Task.isShallow?: boolean`. Right-click / ⋮ menu shows "Mark as shallow / Mark as deep work". Shallow tasks show an amber badge. When completed shallow tasks total ≥ 120 min, a warning banner appears above the sections.

4. **Weekly scoreboard** — `/review` (`ReviewPage`) shows this week's earned hours against `deepWorkGoalHoursPerWeek` (editable there), a bar per day, and hand-logged time beside it but never added to it.

5. **Depth philosophy** — removed from the UI with the time blocks; `AppState.depthPhilosophy` is kept so existing settings are not dropped.

6. **Task progress boxes** — a task with `durationMinutes >= 30` renders a row of
   30-minute boxes (`TaskProgressBoxes`), collapsing to a segmented bar past six.
   `computeTaskProgress` in `src/domain/taskProgress.ts` fills them: solid teal for
   minutes earned from an attributed `DeepWorkSession`, faded teal for
   hand-logged minutes (`computeManualMinutesForTask`), amber for anything
   logged past the estimate. Timer
   minutes always fill from the left, so earned work is one contiguous run and can
   never be confused with self-reported time. Only manual minutes can be undone.
   On a coarse pointer the row is one full-width button under the title
   (`TaskProgressBar`: an 8px bar with a segment per block and a "1h15 / 1h30"
   caption) opening `TaskProgressSheet`, which offers the timer first and
   hand-logging second. Rendered by `TaskItem` (via
   `SectionColumn`) and `MustDoPinnedHeader`.

7. **Time comes from the calendar** — a task's time is set by scheduling it into
   Google Calendar (`ScheduleChip` → `ScheduleSheet`, see "Today and the
   calendar" above); `Task.scheduledAt` mirrors the event start. On phones the
   duration picker lives in that sheet, so a row stays one line.

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
   a `DeepWorkSession` marked `source: 'manual'` and fills faded — an entry on
   the day, so it has a place in time, can be taken back on its own, and is
   detached rather than destroyed when the task is deleted. A clock range stores
   the real interval; a count of blocks stores only `loggedAt`, because an
   interval nobody knows is not invented. Manual entries are excluded from
   `computeDailyDeepWorkMinutes` by `source`, which is the only thing standing
   between self-report and the earned total. Undo takes back the last *entry*
   whole (`listManualEntries`), since logging is one gesture and taking it back
   has to be one too. `SessionAttributionPanel` (folded away under the logging
   controls) points a recorded block at a different task or at none, via
   `reattributeSession` in `workSafety.ts` — the minutes, instants and earned
   status are untouched, so only what the work was *for* changes. Done tasks are
   offered as destinations; realising a block belonged to something already
   ticked off is the common case. Completing a trackable task with an
   unlogged remainder raises `CompletionClaimPrompt` (12s, then it expires;
   touching it holds it open, and leaving the day dismisses it). One tick can
   raise several: ticking a parent completes its subtasks, and each trackable
   one is queued behind it, capped at `MAX_COMPLETION_CLAIMS` = 3. It asks in
   blocks, not minutes: `blockAmountOptions` in `taskProgress.ts` turns the
   still-empty blocks into cumulative choices, so eight blocks set aside and two
   actually worked can be said in one tap. It opens on all of them, so the old
   one-tap "log the whole remainder" still costs one tap. The same
   `BlockAmountPicker` is the "In blocks" mode of `ManualLogPanel`, with two
   blocks of headroom past the estimate. The row is never filled
   automatically. `computeWeeklySelfReportedHours`
   shows the hand-logged total beside the weekly scoreboard, explicitly *not
   counted* toward it.

9. **Block length is set from the timer** — the preset chips pick this run's
   length; the line under them (`BlockLengthLine`) shows `Your block: Xm on · Ym
   off` and offers "Make Nm my block" whenever the picked length differs from
   the configured one, calling `handleSetBlockLength` in `DayPlanner`.

10. **Completion is offered, never taken** — a block that fills a task's row
    raises a one-tap "Mark done?" (`doneOffer` in `DayPlanner`, the twin of the
    12s `completionClaim`). It is not ticked automatically: the estimate is what
    the work was expected to cost, not a definition of finished, and a box that
    ticks itself removes the act being rewarded. Dopamine tracks reward
    *prediction error*, so a tick you saw coming is not a reward at all.

    The four sounds live in `src/audio/chimes.ts` — one shared AudioContext
    (a fresh one per chime leaks, and browsers cap them, so the sound silently
    dies mid-session) and one ascending motif at four sizes: tick < block <
    task row filled < Top Three cleared. Rising and consonant reads as success;
    falling reads as an error. Only the tick is detuned, and only its *timbre* —
    randomising whether a reward fires is the slot-machine mechanic and has no
    place in a tool someone depends on. Muting is per-device (localStorage,
    deliberately outside the synced `AppState`).

Both `depthPhilosophy` and `deepWorkGoalHoursPerWeek` are global settings synced via `user_settings` JSONB — no migration required. `manualLoggedMinutes`, `taskId`, `source` and `loggedAt` are additive optional fields on existing JSON payloads (`plannerDays` stores tasks and sessions as `v.any()`) — no migration and no backend deploy.

### Atomic Habits features

- **Identity statement** — `AppState.identityStatement` (string), synced via `user_settings` JSONB. Editable inline in `HabitChecklist` (click-to-edit pattern with `editingIdentity` local state).
- **Habit definitions** — `HabitDefinition[]` with `id`, `label`, and optional `stackAnchor`. Default set in `DEFAULT_HABIT_DEFINITIONS` (types.ts). CRUD via `HabitEditorModal` — add/delete/reorder (▲▼ buttons) + anchor field. Saved to `AppState.habitDefinitions` and synced via `user_settings`.
- **Habit checklist** (`src/components/habits/HabitChecklist.tsx`) — sidebar card: identity statement (click-to-edit), habit rows with toggle button, 🔥 streak badge, amber ⚠ at-risk highlight. `collapsed` local state; `doneCount/totalCount` in header.
- **Never-miss-twice logic** — `getAtRiskHabitIds(days, habitIds, today)` in `stats.ts`: a habit is at-risk when `days[yesterday].habitCompletions[id] !== true` AND `days[dayBeforeYesterday].habitCompletions[id] === true`. Displayed as amber border + ⚠ icon; tooltip: "You missed yesterday — don't miss twice".
- **Per-habit streaks** — `computePerHabitStreaks(days, habitIds, untilDate)` in `stats.ts`: walks backwards up to 365 days counting consecutive completed days.
- **Habit completions** — `DayState.habitCompletions: Record<string, boolean>`. Toggled via `handleToggleHabit` in `DayPlanner`, persisted via the normal planner day upsert path.
- **Week of habits** — `/review` shows the last seven days of each habit as dots (`computeHabitWeek` in `habitWeek.ts`); the monthly grid was removed. On a phone the Habits tab (`MobileHabitsPanel`) shows the same seven dots under each habit, and each row is one button that toggles it.
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
