# Spec 02: the countdown rules and the days-left headline (pure domain + one hook)

*Run:* `docs/00-orchestration/runs/2026-11-05-solo-countdown/` · *Builder:* builder (Opus) · *Worktree:* yes, from `main` ·
*Time box:* 45 minutes of agent work

## Goal
A pure module answers, for one member on their own clock, "what is the next thing I owe today and how long until its deadline", and formats it two ways: to the second for the detail page and to the minute for the Today block. A second pure function turns `ChallengeProgress` into the headline ("70" / "days left", "Last day", "Season over"). A hook ticks once a second only while something on screen needs it and the tab is visible. No UI in this spec; spec 03 renders it.

## Inputs (read all of these first)
- `C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-05-solo-countdown\02_COMMON.md`: setup and the contract (section "Domain"). Names and signatures there are fixed; where this spec is more precise, this spec wins.
- `src/domain/challenge.ts`: `ChallengeProgress`, `challengeProgress` (UTC day arithmetic), `ChallengeDayLike`, `formatClock`.
- `src/domain/challengeList.ts`: `owedAct`, `owedLabel`, `challengePillLabel`: the existing words for what you owe; the new line must agree with them.
- `src/hooks/useMinuteTick.ts`: the pattern for the new hook.
- `convex/_shared/challengeReminders.ts`: `hhmmToMinutes`, `localDateAndMinutes`: how the server judges the same deadlines (so client and server never disagree about which side of a deadline "now" is).
- `src/domain/challenge.test.ts` and `src/domain/challengeList.test.ts`: test style (Vitest, fake timers where time matters).

## Deliverables (exact paths)
- `src/domain/challengeCountdown.ts` (new): everything in the contract's "Domain" section, with the precise rules below.
- `src/domain/challengeCountdown.test.ts` (new): the tests below.
- `src/hooks/useSecondTick.ts` (new): the hook.
- `src/hooks/useSecondTick.test.ts` (new) if the repo's test setup can render hooks (check `vitest.config.ts` for a DOM environment and whether `@testing-library/react` is installed); if not, say so in the report and test the hook's pure scheduling helper instead (extract `nextTickDelay(nowMs): number`, the ms until the next whole second, so the display changes on the second rather than drifting).

## Precise rules

### `countdownState`
Order of judgement, first match wins:
1. `running === false` → `{ kind: 'idle' }`.
2. `checkinAt` set → `{ kind: 'done' }`.
3. Let `planAt = localDeadlineMs(todayIso, planDeadline)`, `checkAt = localDeadlineMs(todayIso, checkinDeadline)`.
4. `planSetAt` unset and `nowMs < planAt` → `{ kind: 'lock', deadlineMs: planAt, msLeft: planAt - nowMs }`.
5. `nowMs < checkAt` → `{ kind: 'checkin', deadlineMs: checkAt, msLeft: checkAt - nowMs, planMissed: planSetAt == null }`.
6. Otherwise → `{ kind: 'closed', planMissed: planSetAt == null }`.

A check-in without a plan is allowed in this app, so after the plan deadline passes with no plan, the countdown moves on to the check-in and says the plan was not locked; it never counts down to a deadline that has passed.

### `localDeadlineMs`
`new Date(y, m - 1, d, hh, mm, 0, 0).getTime()` from `dateIso` ("YYYY-MM-DD") and `hhmm` ("HH:MM"). Device local time, on purpose: the deadlines are local wall-clock times and the server judges them in the member's IANA zone, which on the member's own device is the same zone. On a DST change day the wall-clock deadline still means the wall-clock time (a 23:59 deadline is 23:59, whatever the day's length).

### `formatCountdown`
Floor to whole seconds. `h:mm:ss`, hours unpadded. `msLeft <= 0` → `"0:00:00"`. Examples: 8_073_000 → `"2:14:33"`; 873_000 → `"0:14:33"`; 59_999 → `"0:00:59"`.

### `formatCountdownCoarse`
Floor to whole minutes. `>= 60 min` → `"2h 14m left"`; `1..59 min` → `"14m left"`; `0 < ms < 60_000` → `"under a minute left"`; `<= 0` → `"0m left"`. Exact hours: `"2h left"` (no `0m`).

### `countdownLine(state, deadlines, precise)`
- lock → `Lock in by ${planDeadline} · ${time}` where precise `time` is `${formatCountdown} left` and coarse is `formatCountdownCoarse`.
- checkin → `Check in by ${checkinDeadline} · ${time}`, plus ` · plan not locked` when `planMissed`.
- closed → `Check-in deadline passed` (plus ` · plan not locked` when `planMissed`).
- done → `Done for today`.
- idle → `null`.

### `daysLeftHeadline(progress, span, todayIso)`
Signature: `(progress: ChallengeProgress, span: ChallengeSpan, todayIso: string): DaysLeftHeadline`. (The contract left the upcoming case open; this settles it: the function takes the span and today so it can count days to the start with the same UTC arithmetic `challengeProgress` uses.)
- phase active, daysLeft ≥ 2 → `{ number: String(daysLeft), label: 'days left' }`.
- phase active, daysLeft = 1 → `{ number: '1', label: 'day left' }`.
- phase active, daysLeft = 0 → `{ number: null, label: 'Last day' }`.
- phase upcoming → `{ number: null, label: 'Starts tomorrow' }` when the start is tomorrow, else `{ number: null, label: 'Starts in N days' }`.
- phase ended → `{ number: null, label: 'Season over' }`.

### `useSecondTick(active)`
- `useState(() => Date.now())`.
- Effect on `[active]`: when inactive, do nothing. When active and `document.visibilityState === 'visible'`, schedule `setTimeout` for `nextTickDelay(Date.now())` then `setInterval(1000)` (or re-arm a timeout each tick; either is fine, the display must change on the whole second). Listen to `visibilitychange`: hidden → clear timers; visible → `setNow(Date.now())` and re-arm. Clean everything up on unmount or when `active` turns false.
- Export `nextTickDelay(nowMs: number): number` = `1000 - (nowMs % 1000)` (returns 1000 when exactly on the second).

## Acceptance criteria (each one checkable by a scout)
1. Every function in the contract's "Domain" section exists with the given name and signature, plus `nextTickDelay`; the module has no React or Convex import.
2. Tests cover each branch of `countdownState` (idle, done, lock, checkin with and without planMissed, closed with and without planMissed), each branch of both formatters at the boundaries listed above, each `countdownLine` output listed above word for word, and each `daysLeftHeadline` case (2+ days, 1 day, last day, starts tomorrow, starts in N days, season over).
3. One test fixes the local-time rule: with the process timezone whatever it is, `localDeadlineMs('2026-11-05', '10:00')` equals `new Date(2026, 10, 5, 10, 0).getTime()`, and the state flips from `lock` to `checkin` at exactly that instant (one ms before → lock, at → checkin).
4. One test runs the whole-day story with fake timers: 09:00 no plan → lock with 1:00:00 left; 10:00:00 no plan → checkin with planMissed; plan set at 10:30 → checkin without planMissed; checked in → done; 23:59 not checked in → closed.
5. `npx tsc -b`, `npm run lint`, `npm test` clean (the new tests are included by the default `src/**/*.test.ts` include).
6. No existing file changed except by adding nothing; the deliverables are all new files. (`git status --short` lists only the four or three new files.)

## Constraints
- Project rules from `CLAUDE.md` apply.
- Pure module: no `Date.now()` inside `src/domain/challengeCountdown.ts`; time comes in as an argument.
- Words in `countdownLine` are exactly as written; spec 03 and the e2e checks grep for them.
- Edit with the Edit tool, never `sed`. Create with Write.

## Out of scope
- Rendering. Any change to `ChallengeDetail.tsx`, `ChallengeTodayBlock.tsx` or any other component.
- Sound or notification when a deadline passes.

## Verification the builder must run
- `npx tsc -b`
- `npm run lint`
- `npm test`
- `git status --short`

## Report to
Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`. The supervisor files it as `report-02-round1.md`. Include the exact `vitest` tail showing the new test count.
