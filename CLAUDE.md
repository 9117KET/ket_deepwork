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
- `ADMIN_EMAILS` (comma-separated; who may read the admin list of every
  challenge; unset means nobody)

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
  durationMinutes?    ← the planned cost, from the ladder in durations.ts (an
                         off-ladder value is kept, never rewritten); drives the
                         focus-block progress row and the day gauge
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

One to eight people (`MAX_MEMBERS` = 8), one season (e.g. 1 Oct → 31 Dec),
each with their own goals and "don'ts", and two explicit acts a day: **Lock in today's plan** before a morning deadline and
**Check in** before the check-in deadline. It replaces a WhatsApp thread; WhatsApp stays
the ping (the Share button hands a prefilled line to the Web Share sheet, or
copies it), the app is the record.

**The planner stays private.** The partner never reads `plannerDays`. What
they see is the `summary` the member's own client publishes into
`challengeDays` — Top 3 titles with done state, every other visible task's
title with done state (`tasks`, added 7 Nov 2026; older rows carry only the
done/total counts, which are still sent), a
count of private tasks, earned deep-work minutes, habits done/total — built by
`buildChallengeSummary` in `src/domain/challenge.ts` and sent by
`useChallengeSync` (the `useTaskSync` shape: 1.2s debounce, foreground
refresh, off while hydrating). `Task.isPrivate` keeps a task out of the
summary: counted, never titled, still mirrored to the user's own Google Tasks.
Every function in `convex/challenges.ts` derives the caller from the identity
and checks membership; the partner view (`dayView`) never carries reminder
bookkeeping or a `userId`. Only the member's own today is published:
`syncDaySummary` drops any date more than a day from their local today,
`lockInPlan` takes today only and `checkIn` today or yesterday, and the
planner syncs only while it shows today, so browsing another day never
rewrites what the partner saw.

**Many challenges, each private.** A user may be in any number of active
challenges at once (`MAX_ACTIVE_MEMBERSHIPS` = 20; the 21st is refused; a
row they left does not count), each with its own members, at most eight.
Nothing returned for one challenge says a member is in any other: no count,
no name. The summary is
published once and fanned out: `syncDaySummary` keeps its args and writes the
row in every active challenge whose span covers the date. The lock-in is one
act for the whole day: `lockInPlan` without a `challengeId` stamps every
active challenge, with one it stamps that one. Check-in and nudge are per
challenge, because don'ts and partners differ, and every other write takes a
`challengeId` and goes through `requireMember` ("You are not in this
challenge", "This challenge has ended"). Those changed function arguments
make this a two-sided deploy: backend first (`npx convex deploy`), then push
`main`; see `docs/DEPLOYMENT.md`.

**Groups.** Every read returns `others`: every other active member in join
order (`joinedAt` ascending), each a `memberView` with a `key` (the member
row id, the only identifier of another member that leaves the server) and
`isCreator`. `partner` stays in every return, equal to `others[0]`, so the
client built for two keeps working against this backend; `challengeView`
adds `memberCount`, `capacity` (8), the warned member's `memberKey` and
`displayName`, `reopenedDate` and `closedSpans`. `dayCards` and `todayCards`
take optional `otherDates: [{ key, date }]` and `history` optional
`otherToDates: [{ key, toDate }]`, because each member is on their own clock;
a member without an entry is read at `partnerDate` (`partnerToDate ?? toDate`).
`myChallenges` returns the open `invite` while seats remain. Any active member
may invite; one seat per link; the ninth is refused with "This challenge is
full (8 members)". A link whose maker has since left or been dropped is dead:
`invitePreview` returns `notFound` and names nobody (a former member's name
and lists are never shown), and `acceptInvite` refuses it ("This invite link
is no longer valid"). With seats free but `MEMBER_ROW_BOUND` rows already
kept, a newcomer is refused with "This challenge cannot take new members"; a
former member, whose row is among them, can still return. One `membersOf` (`convex/_shared/challengeMembers.ts`,
bounded at `MEMBER_ROW_BOUND` = 64 rows, active and former) serves both
`challenges.ts` and the sweep; the pure rules are in
`convex/_shared/challengeGroup.ts`. Added 11 Nov 2026 as a backend-first
deploy: every old argument is still accepted and every old field keeps its
name, type and meaning, so deploy the backend before the group client.

On the client, `src/domain/challengeGroup.ts` holds the group rules (pure,
tested): `othersOf` (falls back to `partner` when `others` is absent),
per-member dates, `groupCountLabel` ("3 of 5 others locked in"),
`othersWho`, `leaveSentence`, `seatsLeftLabel`, closed days
(`seasonCellState`, `countedDates`) and reopen bounds. The hooks send
`otherDates`/`otherToDates` only for a group (two or more others), so a
two-person challenge sends exactly what it always has. Two people read as
before: "your partner", one mark beside yours, "Head to head". From three,
the screens say "the others" and count.

**A challenge may be solo.** `createChallenge({ solo: true })` stores
`challenges.solo`, and `challengeView` returns `solo` (absent reads as
false, so every older row is two-person). It only says "nobody is expected":
lock-in, check-in, inactivity, reminders and deletion run as for any
one-member challenge, and a nudge still says "Nobody has joined yet". An
invite still works, and `acceptInvite` sets `solo: false` in the same
mutation that adds the partner, so from then on it is a two-person challenge
in every view. A partner leaving never makes it solo again. On the client
it is the "Just me" choice in step 1 of `/challenge/new` (beside "With
others", the default). While a solo challenge has nobody in it, the
dashboard's partner slot is one quiet "Invite someone" that reveals the
usual invite link, head to head is "Your season" with your row only, and
the Today block and the list say "Just you" where a partner's mark would
be (`othersWho` in `challengeGroup.ts`); a challenge with others expected
and still alone keeps "Nobody has joined yet" and says "Waiting for
someone to join".

**Days left and the countdown.** Every running or upcoming dashboard leads
with the days-left headline (`daysLeftHeadline`, the `numeral` type style)
and under it one line counting down to what you owe next today (lock in,
then check in), both from `src/domain/challengeCountdown.ts`, on your own
clock. The dashboard ticks every second through `useSecondTick`, armed only
while a deadline is ahead and the tab is visible; the Today block and the
list stay on the minute tick ("2h 14m left", "Day 22 of 92 · 70 days
left"). The line is a `role="timer"`, which is not announced on change, so
a screen reader is never read every second.

**Refusals are sentences.** Every expected state (validation, invite states,
"not in a challenge", nudge rules) throws `ConvexError({ code, message })`
through `fail()`, because Convex redacts a plain `Error` to "Server Error" in
production. `challengeErrorMessage` shows `data.message`; nudge rule refusals
carry `code: "nudgeRule"`, which the card shows as a quiet status. Only
"Not authenticated" stays a plain `Error`.

**Tables** (`convex/schema.ts`, validators shared via
`convex/_shared/challengeValidators.ts` so arg and table cannot drift):
`challenges` (span, local deadlines, `status` — the cron's one switch, with
`endedReason` and `endedAt` once it ends, and an inactivity `warning` while
active), `challengeMembers` (one per user per challenge, indexed
`by_user_challenge`, with an IANA `timezone` refreshed on every sync, because
members are in different zones, the member's own `goals` and `donts`,
`joinedDate` and `lastActedAt`, and `leftAt`/`leftReason` once they left or
were dropped), `challengeInvites` (7-day token, one seat),
`challengeDays` (one row per member per day: summary, `planSetAt`,
`checkinAt`, note, `dontsBroken`, `goalsKept`, `remindersSent`, and on the
nudger's row `nudgesSentAt` and `nudgesByMember`). `challenges` also carries
`reopenedDate`, `reopenedAt` and `closedSpans` once reopened. The summary
may carry `plannedMinutes` and `doneMinutes` (whole minutes planned and
earned by ticks, the `computeDayCompletion` rule, private tasks included);
both are optional, because old rows and old clients lack them.
Legacy `shareTokens` is untouched. A season runs at most 366 days, and the
check-in deadline must fall after 21:30, where the check-in reminders start.

**Leaving.** Nothing is deleted. A member who leaves keeps their row, marked
`leftAt` and `leftReason: "left"`: a former member, invisible to every read
and write as a member (they see nothing of it, the others no longer see
them). An invite brings them back to the same row (same key, name, join
order, goals and don'ts with their ids, and their old days reappear); only
`joinedDate` moves to their today, so inactivity counts from the return. The
creator leaving hands the role (`createdBy`) to the remaining member with the
earliest `joinedAt`, and the challenge runs on. The last active member
leaving ends it (`"allLeft"`) and keeps their row active, so they can still
read and reopen it. A warning naming the leaver is cleared. `"creatorLeft"`
is no longer written; old rows with it stay valid. Season end is
`"seasonOver"`, `endChallenge` by hand is `"manual"`.

**Inactivity closes a pair, drops one from a group.** The sweep judges each
active member on their own clock over full local days only (yesterday
backwards, never today), from the latest of the start, their join date and
the day after the latest reopen. A day with no lock-in and no check-in is
missed, and a day with no row at all counts the same. Three missed days in a
row put a `warning` on the challenge and email every member; the warned
member gets no plan or check-in reminder while it stands. Their next lock-in
or check-in clears it in the same mutation. A fourth missed day, a full day
after the warning: with two members or one it closes the challenge
(`"inactive"`) and emails both; with three or more it drops that member
alone (`leftAt`, `leftReason: "inactive"`, the creator role handed over if it
was theirs), clears the warning, emails every member including the dropped
one ("dropped": an invite link brings them back with everything kept), and
the challenge runs on. One warning at a time: a second quiet member is not
warned until the first is resolved (known limit). The rules are pure in
`convex/_shared/challengeInactivity.ts` (`countableDates`, `inactivityFrom`,
`missedRun`, `inactivityDecision`).

**Reopening.** `reopenChallenge({ challengeId, endDate? })`: the creator (the
current `createdBy`, an active member) reopens an ended challenge with
everything it recorded. Refusals: "Only the creator can reopen a challenge",
"This challenge is already running", the 20-challenge cap, "This challenge
no longer exists". The end date is `endDate ?? the old one`; it must be on or
after every active member's today (else code `needsEndDate`, "Pick an end date
from today on", and the client asks for one), not before the start, and at
most 366 days from the reopen day ("A season runs at most 366 days from
today"; the original start may be older). One patch: `status: "active"`,
`endedReason`, `endedAt` and `warning` removed, `endDate`, `reopenedDate`
(the reopener's local date), `reopenedAt`, and `closedSpans` extended with
the stretch it spent ended (from the end date, or the day after when someone
locked in or checked in that day, to the day before the reopen; none for a
reopen the same day; the newest 20 kept). No member row and no day row
changes; former members stay former. Every other active member gets one
"running again" email, scheduled from the mutation.

Known limits, accepted (11 Nov 2026):
- A reopen checks only the creator against the 20-challenge cap, so it can put another member over 20 active challenges.
- Former-member rows count in the newest-50 `by_user` window `allMemberships` reads, so a person who left many challenges sees fewer old ones.
- `deleteChallenge` (creator or admin, ended only, guard unchanged) now removes the days of up to eight people, former members included.
- `reopenedDate` is the reopener's local date; members in other zones may be a day apart from it.

**Goals and don'ts are per member.** Each member sets theirs on create or
join and edits them any time (`updateMyCommitments`); the other members read
them via `memberView` and cannot change them. A removed don't is archived
(`archivedAt`), never deleted, and an edited one keeps its id, so every
`dontsBroken` id resolves forever (`resolveDontTexts` in
`src/domain/challengeCommitments.ts`). `challenges.goals`/`donts` are legacy,
never written again: a creator whose member row has no lists falls back to
them (`memberCommitments`), which is the whole migration; a hand-over first
writes such a creator's legacy lists onto their own row, and empty lists
onto a successor whose row has none, so the fallback never moves to the new
creator.

**Editing the dates.** `updateSpan` corrects the start, the end and,
optionally, the two deadlines of a running season. Only a member may call it,
and only while the challenge is active. Only the creator (the current
`createdBy`) may change the dates ("Only the creator can change the dates").
The span and deadline checks are the ones `createChallenge` makes, from one
helper (`assertSpan`), except that a reopened season's 366 days run from its
`reopenedDate`, not its start ("A season runs at most 366 days from the day
it was reopened"), so it stays editable past a year from the start. The end cannot move before any active member's local
today, because the season-over sweep would end it at once. The start cannot
move past the first day on which any member, former members included, locked
in, checked in or marked a goal or don't, because `history` reads from the
start and those days would vanish ("The start can't move past 24 Oct, when
the first lock-in, check-in or mark was recorded"), nor past the first closed
stretch ("The start can't move past 5 Oct, when the challenge was closed").
No `challengeDays` row is deleted or changed, and `status` is left alone.

**Daily marks.** Goals have ids now, like don'ts: minted `goal-<ms>-<n>`,
kept through edits, archived when removed. A member row written before that
holds plain strings; `normalizeGoals` reads the one at index `i` as
`goal-legacy-<i>`, and the member's first `updateMyCommitments` stores those
ids for real, so a mark made before the edit still resolves after it.
`memberView` (and the result of `updateMyCommitments`) carries goals twice:
`goals` is still `string[]`, the active texts, so a client built before ids
keeps rendering through a deploy; `goalItems` is the list with ids, archived
ones included, like `donts`. New client code reads `goalItems`.
`markDay` records, any time during today or yesterday on the member's own
clock, which goals they kept (`goalsKept`) and which don'ts they broke
(`dontsBroken`). It writes only the lists it is given and nothing else on the
row; a missing row is created with an empty summary and no acts. A mark is
not one of the two daily acts: it never calls `recordAct`, so it neither
clears a warning nor saves a member from inactivity. `checkIn` takes an
optional `goalsKept` too; left out, the day's marks stay. The partner's
`dayView` carries `goalsKept`.

**Reads are split hot/cold here too.** `myChallenges` (every membership,
active first, at most 50), `dayCards` (one challenge) and `todayCards` (every
active challenge's today in one subscription) are small and live; `history`
returns one challenge's whole season and callers pass `toDate = yesterday`,
so today's debounced writes never invalidate it. `history` takes a date per
member, `toDate` for the viewer, `partnerToDate` for the first other member
and `otherToDates` for the rest, because each one's yesterday is on their own
clock; with one date a member a day ahead leaves a hole in the grid. Reads accept an ended challenge, so a finished
season stays readable, read-only; writes see only an active one, so an ended
season never blocks the next. (The single-challenge `myChallenge` is gone;
the client reads `myChallenges` through `src/hooks/useChallenges.ts`.)
`adminStatus` and `adminListChallenges` give an
`ADMIN_EMAILS` address a read-only list of every challenge with its active
members' emails and last activity, and a count of `formerMembers`.

**Reminders are email from the user's own Gmail** (`convex/email.ts`, a
`"use node"` nodemailer action; swap to Resend in `send()` once a domain
exists). `convex/crons.ts` runs `reminders.sweep` every 15 minutes:
`challengesInternal.claimDueReminders` decides *and records* in one
transaction (a failed send costs one email, never doubles one), then the
action sends. The rules are pure in `convex/_shared/challengeReminders.ts`:
after the plan deadline every 120 min, four at most; from 21:30 local every
90 min for the check-in, two at most; each judged on the member's own clock.
One missed act, one email: the caps and spacing are judged per row, but the
sweep groups by member, so someone owing the same lock-in in three challenges
gets one plan email naming all three, and `remindersSent` is recorded on every
row it covers. Inactivity runs first in the same pass, and a challenge it
closes gets nothing further. Every email links to `/challenge/<id>`. The
check-in reminder names the challenge's own deadline ("Check in before
22:00"; "midnight" only for 23:59, the earliest deadline when one email covers
several challenges), and says "your partner" for two people, "the group" for
three or more. `nudgePartner({ challengeId, memberKey? })` schedules one email
from inside the mutation to one other member: `memberKey` names them (another
challenge's key, or one's own: "They are not in this challenge"); without it
the target is `others[0]`, as the two-person client expects. Up to three per
target per nudger-local day, at least an hour apart, only while the target
owes the day something (pure rules in `convex/_shared/challengeNudges.ts`,
shared with the button). The per-target times are
`challengeDays.nudgesByMember[key]` on the nudger's row (returned by
`todayCards` as `mine.nudgesByMember`); `nudgesSentAt` still gets every nudge
of the day, so the two-person client's count stays right; a row from before
per-target bookkeeping counts its legacy list for `others[0]` only; legacy
`nudgeSentAt` reads as one.

**Routes and entry points.** Hooks: `useChallenges()` (the list),
`useChallengeDetail(id, now)` (one challenge plus every member's today:
`others`, each `{ member, date, day }` keyed by `member.key`),
`useTodayCards(active, now)` (every running challenge's today, one
subscription, each row with the same `others`) and
`useChallengeHistory(id, toDate, partnerToDate, otherToDates)`, all in
`src/hooks/useChallenges.ts`; the strings for state (row marks, what you owe,
the ended and warning sentences, the Today pill) are pure in
`src/domain/challengeList.ts`. Every challenge route shares
`ChallengeChrome` (account menu, tab bar, sign-in form for guests).
- `/challenge` (`ChallengeListPage`): one row per challenge, running first
  (name, "Day 22 of 92", you and your partner as ✓/– marks with words, or
  in a group your mark and "3 of 5 others locked in", a "Warning" badge),
  then ended ones with the sentence for how they ended ("Ended 3 Nov · Kin
  left" for a legacy `creatorLeft`, "Ended 3 Nov · everyone left", "Closed 3
  Nov after 4 days without a lock-in or check-in", "Season over", "Ended by
  hand"). "New challenge" and "Join with a link" (inline). With none, an
  invitation. No redirect with one.
- `/challenge/new` (`ChallengeCreatePage`): two steps. Name, "With others"
  or "Just me" (the hint says a link seats one person and a challenge holds
  up to 8), length (30 / 90 / 365 days or custom dates), deadlines folded
  under "Deadlines"; then goals and don'ts (optional), display name under
  "Advanced". Opens the new dashboard.
- `/challenge/:id` (`ChallengeDetailPage` → `ChallengeDetail`): the first
  screen is the header (name with Rename; "Day 22 of 92 · plan by 10:00 ·
  check in by 23:59", then "Reopened 11 Nov" once reopened), a warning
  banner when the warning is yours (or names someone no longer listed), and
  one Today surface: your `MemberRow`, one full-width button for your next
  act (Lock in → Check in → quiet "Edit check-in"), then one `MemberRow` per
  other member in join order, keyed by `memberView.key`, each with its own
  Nudge (`nudgePartner` with `memberKey` in a group, none for two; its
  allowance from `nudgesByMember[key]` via `nudgeTimesFor`) and the warning
  sentence on the warned member's row. Two people keep Share in the
  partner's row; a group shares once, below the rows. While seats remain any
  member has a quiet "Invite someone" with "3 seats left"; at 8 it is gone.
  Then, un-carded: head to head ("Everyone so far" in a group: a row per
  member, you first, join order, no ranking; full days and run, "A full day
  is a locked plan and a check-in."), the `SeasonGrid` (a `<table>`; two
  people get two marks a day, yours left; a group gets one member's marks at
  a time, picked in a "Marks for" menu, while each cell's screen-reader text
  names every member's state; each state is a shape: filled = full, ring =
  plan only, dot = check-in only, dash = missed, dotted outline = closed, the
  `closedSpans` days, which count for nobody in the score either), goals and
  don'ts (yours, then each member's), and Leave through an `ActionSheet`
  (`leaveSentence`: alone it ends; the creator with others is told who
  becomes the creator; anyone else that a new invite link brings them back
  with everything). Beside Rename the creator of a running season has "Edit dates", a
  "Dates and deadlines" sheet that calls `updateSpan` (the client checks
  format and order with `seasonDatesError`/`seasonDeadlinesError`; whether
  today or a recorded day blocks it is the server's sentence). Under your
  row, while the season runs, "Today's commitments" lists your active goals
  (✓ kept) and don'ts (✕ broke) as `aria-pressed` toggles, each tap sending
  the full set of one kind through `markDay`; goal ids come from
  `memberView.goalItems` (`goalItemsOf`), never from the plain `goals`
  texts. Each `MemberRow` adds "Kept 2 of 3 goals" (`keptLine`) and "64% of
  planned time" with a thin `role="meter"` (`dayCompletionPercent` over the
  summary's `plannedMinutes`/`doneMinutes`, private tasks included as
  minutes, never titles), and head to head adds "Planned time done", the
  season's minutes done over minutes planned (`seasonCompletion`), not an
  average of daily percentages. An ended season is read-only with its sentence under the header;
  its creator has "Reopen challenge" beside "Delete challenge", a `ReopenSheet`
  that reopens with one verb while the end date is ahead for everyone, and
  otherwise asks for a new end date (min the latest member's today, max 366
  days from yours) with the verb disabled until one is set; refusals are the
  server's sentence; success needs no reload, the subscription flips every
  member's dashboard. Anyone else reads "The creator can reopen it." An
  unknown id says "Not one of your challenges". From `lg`, the season and the
  commitments are a right rail. Design rules: `scout-design-review.md` in
  `docs/00-orchestration/runs/2026-11-02-duration-dnd-multichallenge-design/`.
- `/challenge/join?invite=TOKEN` (`?invite=`, not `?code=`, which Convex Auth
  intercepts; the token survives sign-up in sessionStorage). Being in other
  challenges never blocks a join; "Join challenge" opens the new dashboard.
  A full challenge reads "This challenge is full (8 members)."; a former
  member previews as `ok` and joins the same way, getting their row back.
- `/admin/challenges` (`AdminChallengesPage`): read-only table from
  `adminListChallenges`; anyone else sees "Not an admin". The sidebar and
  account menu show the link only when `adminStatus.isAdmin` (`useIsAdmin`).

When a member sets no Top 3, the summary carries their first three visible
tasks with `top3FromTasks`, and `MemberRow` labels them so.

**On Today** `ChallengeTodayBlock` sits under the header: one compact row per
running challenge (name, your partner's mark or in a group "3 of 5 others
locked in", what you owe), one "Lock in
today's plan" above the rows while any is unlocked (it calls `lockInPlan`
without an id, so it locks them all), a per-row Check in that opens that
challenge's `CheckinSheet`, and the warning sentence on a warned row. The
`DayHeader` pill reads "Day 22/92 · 70 left" with one running challenge and
"2 challenges" with more (`challengePillLabel`). The block has no
commitment toggles (Today stays lean); its `CheckinSheet` asks "Which goals
did you keep today?" above the don'ts, seeded from the day's `goalsKept`, so
a check-in never undoes what the dashboard marked. "Hide from challenge" is in the
task menu. Review shows each running challenge's week as one row of marks
per member, you first.
The phone tab bar has a fifth tab, **Challenges**, lit on every `/challenge*`
route and on the admin list. Guests cannot take part.

**Sheets.** Every challenge sheet and `ScheduleSheet` render through
`src/components/ui/Sheet.tsx`: portalled, `#root` made `inert` while open,
focus moved in and trapped, Escape and scrim close, drag the header down to
dismiss on touch, a quiet Cancel plus one verb. `ActionSheet` (same file) is
the destructive-choice form and replaces `window.confirm`. Quiet actions are
`ui/TextButton` (always 44px); errors are `ui/Notices` `ErrorLine` (the
`share.error` token plus an icon). On the challenge screens cyan is only the
one primary button; "done" is `share.done` with a ✓ or a filled shape.

**Tests:** `npm test` covers `src/domain/challenge.test.ts`,
`src/domain/challengeList.test.ts` and `src/domain/challengeGroup.test.ts`;
`e2e/challenge-guest.spec.ts` covers every challenge route as a guest and
the shared sheet's focus trap; `e2e/challenge-group.spec.ts` renders the
dashboard from a fixture (`e2e/harness/challenge-group.html`, served by the
Vite dev server, no backend) for two, five and eight people and the ended
cases, and checks rows, Nudge, invite, score, grid at 320px, leave copy and
the reopen sheet (writes are not exercised);
`npm run test:convex` covers `convex/challenges.test.ts`,
`convex/challengesMulti.test.ts` (many challenges, privacy, admin),
`convex/challengeInactivity.test.ts` and `convex/reminders.test.ts` (mocked
nodemailer), `convex/challengeGroups.test.ts` (eight seats, `others`, the live
two-person client's calls, privacy with four, per-target nudges, leaving and
returning, hand-over, a dropped member, the check-in reminder's deadline),
`convex/challengeReopen.test.ts`, and the reminder, inactivity and group rules
(`convex/_shared/*.test.ts`). A
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
   anatomy (handle, checkbox, title, one chip, ⋮ → `TaskActionSheet`) via
   `useCoarsePointer()`; the gates live in `e2e/mobile-today.spec.ts` and
   `e2e/mobile-panels.spec.ts`, with shared fixtures in `e2e/helpers/mobile.ts`.
   Every row shows one `DragHandle` ("Drag to move <title>") at every width,
   first in the row at its left edge, before the checkbox, on a phone as on a
   desktop (`e2e/drag-handle-left.spec.ts`); a phone row that cannot be dragged
   holds the handle's place (`PhoneHandleSpacer`), so titles stay in one column.
   A task moves four ways: a finger on the handle lifts the row at once, or
   presses and holds anywhere else on it for 300 ms, and drags it between rows
   of either list (`useTouchReorder`; a swipe on the body without the hold
   still scrolls, and a mouse on a touch device drags by the handle too), the
   ⋮ sheet offers "Move to Top 3" / "Move to Tasks" (with subtasks, to the
   end) and Move up / down, a mouse drags any row on a desktop, and
   Alt+ArrowUp / Alt+ArrowDown on a desktop handle moves it one step with a
   spoken result. The Top 3 never holds more than three roots: a drop or a
   "Move to Top 3" that would make a fourth is refused with "Top 3 is full.
   Move one out first." (`wouldOverfillTop3`). Subtasks never leave their
   parent by drag: a drop anywhere but among their siblings is refused with a
   toast pointing to "Move to another parent"; `e2e/touch-reorder.spec.ts` and
   `e2e/drag-handle.spec.ts` pin all of it. "Fill from yesterday" (offered
   while today's list is empty) copies yesterday's Top 3 into today's empty
   slots, the rest to Tasks, and its list, all unticked, with their lengths but
   no scheduled time and no logged minutes (`e2e/fill-from-yesterday.spec.ts`).
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
Google OAuth consent screen), `/restore`, `/challenge`, `/challenge/new`,
`/challenge/join`, `/challenge/:id` and `/admin/challenges`.
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
| `src/components/challenge/` | Today block, member row, dashboard view, check-in and commitments sheets, season grid, shared chrome |
| `src/components/ui/` | `Sheet` + `ActionSheet`, `TextButton`, `Notices` (error and warning lines), `MaterialIcon` |
| `src/hooks/` | `useTaskHandlers`, `useCalendarDay`, `useWorkLog`, `useChallenges`, `useChallengeSync`, `useIsAdmin`, undo |
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

1. **Session recording** — `DeepWorkTimer` (first card in the sidebar) calls `onSessionComplete(label, minutes, taskId?)` when the countdown ends. A "Working on" selector attributes the block to one of the day's trackable tasks; the selection locks while a session is running or paused, and the block holds its task from the start (`blockTask`), so paging to another day mid-block keeps it; a task deleted mid-block leaves the session unattributed (`attributedTaskOnDay`). `DayPlanner.handleSessionComplete` appends a `DeepWorkSession` to `DayState.deepWorkSessions`, which is persisted through the normal planner sync (`plannerDays` in Convex; see "Cross-device sync").

2. **Daily total badge** — `DayHeader` receives `deepWorkMinutesToday` (computed by `computeDailyDeepWorkMinutes` in `stats.ts`) and renders a teal pill when > 0.

3. **Task depth classification** — `Task.isShallow?: boolean`. Right-click / ⋮ menu shows "Mark as shallow / Mark as deep work". Shallow tasks show an amber badge. When completed shallow tasks total ≥ 120 min, a warning banner appears above the sections.

4. **Weekly scoreboard** — `/review` (`ReviewPage`) shows this week's worked hours against `deepWorkGoalHoursPerWeek` (editable there) and a bar per day. Hand-logged time counts toward the goal like timer time; each bar shows it as a faded segment so the two stay distinguishable.

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

   **One ladder, one gauge.** Every length picker (the desktop row's
   `DurationChip` popover, the phone's `ScheduleSheet`) offers
   `durationOptions()` from `src/domain/durations.ts`: 10m, 15m, 20m, then 30m
   to 8h, ascending, with a stored off-list value shown in its place. Every
   root row shows its length without hover: the length, or a dim "Time" when
   unset, on a desktop chip and on the phone's one chip alike. A length is
   typed ("2h 30m", "45", "1:30", read by `parseDurationInput`) or picked
   from the ladder, and one typed at the end of a new task ("Write report
   2h") is split off by `extractTrailingDuration`. The day's one completion measure is the gauge in
   `DayHeader` (`role="meter"`), built by `computeDayCompletion` in
   `src/domain/dayCompletion.ts`: planned minutes done of planned minutes, where
   a task with no duration counts as 30m and the line says how many did, and a
   parent earns its minutes pro rata of its subtasks. The Top 3's own pips and
   a section's "~Xh left" line stay as they are.

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
   automatically. On `/review` the hand-logged
   minutes (`computeDailySelfReportedMinutes`) *are* counted toward the weekly
   goal, shown as the faded part of each day's bar: plenty of real work never
   runs on the timer. Elsewhere (the Today badge, the challenge summary, the
   work log) earned time is still kept separate.

9. **Block length is set from the timer** — the preset chips pick this run's
   length; the line under them (`BlockLengthLine`) shows `Your block: Xm on · Ym
   off` and offers "Make Nm my block" whenever the picked length differs from
   the configured one, calling `handleSetBlockLength` in `DayPlanner`.

   **Leaving Focus only changes the view.** Desktop Focus mode (`FocusMode`)
   has an outlined "Exit focus" button top-left, and Esc does the same; the
   phone's running Focus tab has "Exit focus" top-left, which switches to
   Today. While a block still runs, the sidebar timer offers "Back to focus".
   None of them pauses, stops, banks or discards the block
   (`e2e/focus-exit.spec.ts`).

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
