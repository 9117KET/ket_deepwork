# Scout: challenge span, daily goal/don't marks, completion rate (7 Nov 2026)

Read-only, working tree at `752119f`. No tests run.

## 1. Span

**Definition.** `challenges` table, `convex/schema.ts:161-188`: `startDate`, `endDate` plain `v.string()`; `planDeadline`, `checkinDeadline` `HH:MM` applied in each member's own timezone; `status` active/ended with `endedReason`, `endedAt`, `warning`, `solo`. No timezone on the challenge row; it lives on `challengeMembers.timezone` (`schema.ts:193`), refreshed on every `syncDaySummary` (`challenges.ts:899-901`). `challengeMembers.joinedDate` (`schema.ts:205`) is the member's local date at join; older rows derive it from `joinedAt` (`challengesInternal.ts:77-79`). `ISO_DATE` and `HHMM` regexes: `convex/_shared/challengeValidators.ts:12-13`; no span validator there, the args are inline in `createChallenge`.

**`createChallenge` validation** (`challenges.ts:627-692`): `assertIsoDate` on both (647-648); start ≤ end (649); `daysBetween + 1 > MAX_SPAN_DAYS` (366, line 55) → "A challenge can run for at most a year" (650); plan deadline before `CHECKIN_START` (21:30, from `_shared/challengeReminders.ts`) and check-in deadline after it (651-658). No check that the start is today or later.

**Who may act.** `renameChallenge` (808-819) uses `requireMember(..., {write: true})`: either member, while active (`challenges.test.ts:260` has the partner renaming). Creator-only checks exist only in `leaveChallenge` (834) and `deleteChallenge` (863). `requireMember` (154-164): `fail("You are not in this challenge")`, `fail("This challenge has ended")`. `fail()` (69-71) throws `ConvexError({code: "challenge", message})`; the client shows `data.message` via `challengeErrorMessage` (`challengeService.ts:181-192`). Only "Not authenticated" is a plain `Error` (`requireUser`, 84-88).

**Readers of the span and the effect of a change** (rows exist only inside the old span):

| Reader | Behaviour | Effect of a change |
|---|---|---|
| `inRange` (306-308) | inclusive start..end; used by `syncDaySummary` 902, `lockInPlan` 929/935, `checkIn` 971, `nudgePartner` 1015 | rows outside a new span are unreachable for writes, never deleted; a `checkIn` outside is refused "That day is outside the challenge" |
| `syncDaySummary` (891-910) | skips dates outside | start later stops sync for earlier days; rows stay |
| `history` (471-498) | index `gte(startDate).lte(toDate)`, cap 400 | start later hides earlier rows; start earlier shows added days as missed; end earlier does not trim; `toDate` is yesterday so rows after a new end can come back and the client must clip |
| `dayCards`, `todayCards` | read today's row by date, no span check | a today outside the span still returns a row if one exists |
| `reminderDecision` (`challengeReminders.ts:76`) | null outside span | end before today stops reminders at once |
| `countableDates` (`challengeInactivity.ts:39-47`) | later of join date and start, last 4 full days; `challengesInternal.ts:163-165` filters `d <= endDate` | start later than yesterday leaves no countable days |
| season-over sweep (`challengesInternal.ts:145-150`) | ends as `seasonOver` once every member's local date is past `endDate`; `crons.ts:7` every 15 min | end moved before today ends the challenge on the next sweep, irreversibly (writes refuse ended challenges) |

Client: `challengeProgress` (`src/domain/challenge.ts:91-98`) "Day 22 of 92"; `daysLeftHeadline` (`challengeCountdown.ts:107-116`), `challengeDates` (101-106), `SeasonGrid`, `memberSeason`, `jointStreak` all derive from the span passed in and update when `info.challenge` updates (`myChallenges` is live). `challengeList.ts` uses `endDate` in `endedSentence` (147) and mirrors the limits `MAX_SPAN_DAYS`, `CHECKIN_REMINDERS_FROM` (105-106) in `seasonStepError` (115-126), called at `ChallengeCreatePage.tsx:105`; the date inputs and `FIELD_ID` pattern at `ChallengeCreatePage.tsx:80-135` are reusable. `seasonStepError` also validates deadlines.

**Mirror points for an `updateSpan`:** `convex/challenges.ts` near `renameChallenge` (808); a test file; `src/services/challengeService.ts` beside `renameChallenge` (89-91); `ChallengeDetail.tsx` `ChallengeTitle` (602-687) holds Rename (button 611-624, form 647-686), `meta` line built 249-254 and rendered 288; the `readOnly` guard (96) hides write controls once ended. Types flow through `useChallenges.ts` because `challengeView` (219-238) already returns `startDate`/`endDate`. A new public mutation is additive: deploy the backend first, then push `main`.

## 2. Goals and don'ts today

**Storage.** `challengeMembers.goals?: string[]` (`schema.ts:198`), plain strings, no ids. `challengeMembers.donts?: Dont[]` (`schema.ts:200`), `dontValidator = {id, text, archivedAt?}` (`challengeValidators.ts:21`). Legacy `challenges.goals`/`donts` (`schema.ts:170-171`) never written; `memberCommitments` (`challenges.ts:246-252`) falls back to them for the creator only. `memberView` (254-257) returns `{displayName, timezone, joinedAt, goals, donts}` with archived don'ts included. `updateMyCommitments` (766-805): goals replaced wholesale via `cleanList` (no stable identity); don'ts keep ids on edit, removed ones archived, new ones minted `dont-<now>-<n>` (`mintDonts`, 320-322); `MAX_LIST` 10, `MAX_ITEM` 200. Client: `resolveDontTexts` (`challengeCommitments.ts:30-32`) maps ids to text, fallback "a don't"; `activeDonts` filters archived.

**`checkIn`** (958-996): args `challengeId`, `date`, `summary`, `note?`, `dontsBroken: string[]`; checks date in span, today or yesterday, note ≤ 1000 chars, every id a known don't (archived counts, 977-980; else "Unknown don't"); `upsertDay` sets `dontsBroken` (de-duplicated) and `checkinAt = existing ?? now`; `recordAct` clears an inactivity warning. `dontsBroken` is only ever written inside a check-in.

**`CheckinSheet.tsx`**: note textarea, then "Which did you break today?" checkboxes over active don'ts (128-160), draft `broken: Set<string>` seeded from `existing.dontsBroken`; Save calls `checkIn(..., dontsBroken: [...broken])` (53). Goals are not shown.

**Dashboard.** `ChallengeDetail.tsx:461-481` section "Goals and don'ts", `Commitments` component (559-599) for yours with Edit, then the partner's: plain `list-disc` lists, in the right rail from `lg`, below the Season, not in the Today surface. `MemberRow.tsx:111-121`: after check-in "Broke: ..." in the tertiary colour or "Kept all don'ts" (note `donts.length > 0` includes archived). `ChallengeTodayBlock.tsx` uses `CheckinSheet` with `activeDonts` (119-122), shows no goals or don'ts. No per-day goal state exists anywhere.

**What a `goalsKept` needs.** Identity first: goals have no ids and are replaced as a list; keying by text or index breaks on edit. Schema `challengeDays.goalsKept: v.optional(v.array(v.string()))` (`schema.ts:222-240`), read as `?? []`. A mutation separate from `checkIn` (marking must not require a check-in), copying `checkIn`'s rules: `requireMember` write, `inRange`, today-or-yesterday, ids validated, de-duplicated. It must not set `checkinAt`, and must not call `upsertDay` with `emptySummary()` over an existing row (`upsertDay` patches `summary` whenever called; `nudgePartner` 1027 uses `emptySummary()` only when no row exists). `recordAct`: inactivity reads only `planSetAt` and `checkinAt` (`challengeInactivity.ts`), so a tick never counts as a non-missed day. Partner view `dayView` (273-283) is an explicit allow-list: add `goalsKept` there and in `myDayView` (287-296); `challenges.test.ts:213` does `toEqual` on the partner day view and will need updating. `buildChallengeSummary` unaffected. Two writers of `dontsBroken` (`checkIn` and the new mutation): say which wins and never let a goals-only mark wipe a check-in's confession.

**Tests.** `convex/challenges.test.ts`, `challengesMulti.test.ts`, `challengeCommitments.test.ts`, `challengeFixes.test.ts`, `challengeInactivity.test.ts`, `challengeNudges.test.ts`, `challengesSolo.test.ts`, `reminders.test.ts`. Seeding in `challenges.test.ts`: `convexTest(schema, modules)` with `modules = import.meta.glob('./**/*.*s')` (14); `vi.useFakeTimers({now: Date.UTC(2026,9,22,10,0), toFake: ['Date']})` (17-22); `signUp(t, email)` → `{id, as}` (42-45); `setup` (28-36); `summary()` (40); `pair(t)` (47-53) creates as a, invites, accepts as b (`BERLIN` vs `NY`). `npm run test:convex` = `vitest run --config vitest.convex.config.ts` (edge-runtime); `npm test` is the node domain suite.

## 3. Completion rate

**`buildChallengeSummary`** (`src/domain/challenge.ts:66-88`; type 17-31): roots only; `mustDo` is the Top 3; `top3` titles and `isDone` of non-private Top 3 (or the first three visible tasks with `top3FromTasks: true`); `tasksDone`/`tasksTotal` over the visible non-private rest (Top 3 excluded); `privateCount`; `deepWorkMinutes` = `computeDailyDeepWorkMinutes(day)` (earned only); `habitsDone`/`habitsTotal`. No planned or done minutes.

**`computeDayCompletion`** (`dayCompletion.ts:47-93`): returns `DayCompletion` (24-35) `{plannedMinutes, doneMinutes (may be fractional), ratio (0..1, 0 when nothing planned), rootCount, doneRootCount, unestimatedCount}`. Roots only; worth = `durationMinutes` or `DEFAULT_TASK_DURATION_MINUTES` (30) (37-45); a leaf earns all when ticked; a parent earns pro rata of subtask minutes, its own tick ignored (70-79). `gaugeFigures` (109-114) floors to whole minutes and a percent. Callers: `DayPlanner.tsx:166`, `DayHeader`; the summary builder is called from `DayPlanner.tsx:229` and `ChallengeDetailPage.tsx:42` with `(day, habits)`.

**Carrying it in the summary.** Privacy: `computeDayCompletion` includes private tasks; aggregates reveal size, not titles, and "N private" is already disclosed; recommendation: include them. Schema: `summaryValidator` (`challengeValidators.ts:29-39`) is a strict `v.object`, so new fields are a **backend change**; the same validator is used in `schema.ts:226` and in the args of `syncDaySummary` (892), `lockInPlan` (919), `checkIn` (962); hand-copied in `src/domain/challenge.ts:17-31`; `emptySummary()` at `challengeValidators.ts:79-81`. A client that sends the new field before the backend deploy fails every lock-in, check-in and summary sync (the 2026 outage shape): backend first, fields `v.optional`.

**Where it renders.** Per day: `MemberRow.tsx` meta line (66-69, currently deep and habits). Per season: head-to-head table (`ChallengeDetail.tsx:416-443`), `ScoreRow` (541-556) takes `full` of `of` and `streak`; `memberSeason` (`challenge.ts:246-264`) iterates every reached date and sums `summary.deepWorkMinutes`, so a duration-weighted season rate is the same loop over planned and done minutes (not an average of daily percentages; `memberSeason` includes today in `pastDays`). `SeasonGrid` per cell: day number, `DayCellState` (`both`, `plan`, `checkin`, `none`, `future`) for you and the partner (partner's own today), from `planSetAt`/`checkinAt` (`ChallengeDayLike`, `challenge.ts:48-53`); spoken text `DAY_STATE_LABEL` (`challengeList.ts:129-135`); data from `history` (to yesterday, `HISTORY_CAP` 400) plus today's `dayCards` row (`ChallengeDetail.tsx:116-117`).

## 4. `ChallengeDetail.tsx` anatomy (262-537)

1. 263-264 grid wrapper (two columns from `lg`: `minmax(0,1fr)` and 24rem).
2. 265-290 `<header>`: back link, `ChallengeTitle` with Rename (270; defined 602-687), days-left headline and countdown (271-287), `meta` (288; built 249-254), ended sentence (289).
3. 292-296 inactivity warning banner.
4. 298-414 Today surface, the only card: your `MemberRow` (304); next-act buttons (306-344: Lock in primary, Check in, Edit check-in); hairline; partner `MemberRow` with Share and Nudge, or solo "Invite a partner", or "Nobody has joined yet" (346-402); errors and notices (403-412).
5. 416-443 head to head / "Your season": Full days and In a row; hidden while `upcoming`; note "A full day is a locked plan and a check-in." (441).
6. 446 right column; 447-459 `SeasonGrid`; 461-481 Goals and don'ts; 483-496 Leave / Delete; 499-536 sheets.

**Design rules** (`docs/00-orchestration/runs/2026-11-02-duration-dnd-multichallenge-design/scout-design-review.md`, 15 rules): first screen is the two member rows and one primary action; at most two card surfaces per screen, hairlines between rows, no nested cards; each fact once; cyan only for the single next action, "done" is one colour plus a ✓ shape, warning colour only for "broke"/"missed", one error token with an icon; head to head is two numbers per person with "full day" defined on the page; one primary button per view named for the next act, Share and Nudge quiet; shared `Sheet` and `ActionSheet`; 12 px text floor via the five-style scale (Title, Section, Body, Caption, Numeral), never `text-[Npx]`; 4.5:1 text and 3:1 control contrast, every grid state a shape as well as a hue, grid as a table; sentence case with typographic apostrophes; 44 px targets via `TextButton`; palette through tokens, no literal hex or raw `red-*`/`amber-*`.

## Risks

1. Span edit hiding or ending recorded work (start later hides `history` rows; end before today ends the season on the next sweep).
2. Either member editing the span if the rename rule is copied.
3. Strict `summaryValidator`: client first = sync outage.
4. Goals have no ids.
5. Two writers of `dontsBroken`.
6. `upsertDay` always patches `summary`.
7. Privacy of aggregate minutes (product call; `privateCount` semantics unchanged).
8. `dayView` is the partner-facing allow-list; `toEqual` tests will need updating.
9. Day marks must use each member's own today.
10. Inactivity ignores marks: a user who ticks goals but never locks in or checks in is still warned and closed.
11. A start earlier than `joinedDate` shows pre-join days as missed for the later joiner.
