# Check 03, round 2 (scout, Sonnet) — filed by the supervisor

Ran from the worktree: `npm run test:convex` 16 files / 193 passed; `npx tsc -b` clean; `npm run lint` clean; `git diff HEAD --stat -- src` empty.

## Findings

1. Low — `challenges.ts:~1196-1203`: `markDay` on a date with no row inserts a row with `emptySummary()`; the partner's `dayView` then carries an empty summary where it was `null`. **Supervisor:** checked `MemberRow.tsx:108`: "Nothing shared yet today" keys on `day?.planSetAt`, not on the row's existence, and `nudgePartner` already inserts the same bare row; the client's own summary sync overwrites today's within 1.2 s. Not a defect.
2. Low — `updateSpan` can move the start past a date that has only a mark-only row (no act), hiding it from `history`. Matches the rule as written (acts only). **Supervisor:** acceptable; a mark without a lock-in or check-in is not a recorded day. Added to the summary's notes.
3. Info — the end-date rule checks every member's clock (`challengeEdits.test.ts:156-167`, Berlin creator, New York partner); report 2's "creator only" gap understated the coverage.
4. Info — an old client saving bare strings archives all goals and mints new ids each save; marks still resolve; ends when spec 04 ships.

## Acceptance criteria 1–9: all met, each named to a test in `convex/challengeEdits.test.ts` (:100-110, :113-154, :171-223, :229-290, :334-426, :432-462, :467-491) plus the three commands and the report's deploy order.

## Write trace
`updateSpan`: one patch of the challenge's dates/deadlines; reads `challengeDays` only; never touches `status` or `warning`. `markDay`: patch of `goalsKept`/`dontsBroken` only (skipped when empty) or a bare insert; never `upsertDay`, never `recordAct` (only callers :1116 `lockInPlan`, :1158 `checkIn`). `checkIn`: `upsertDay` as before plus `goalsKept` when given; still `recordAct`. `updateMyCommitments`: one patch of the member row; archived kept. No path deletes a day row.

## Refusals
All through `fail()`; no new plain `Error`. New sentences: "Only the creator can change the dates", "The end date can't be before today", "The start can't move past 24 Oct, when the first lock-in or check-in was recorded"; reused: "That day is outside the challenge", "You can only check in for today or yesterday" (also from `markDay`), "Unknown goal"/"Unknown don't".

## Partner visibility
`dayView`/`myDayView` + `goalsKept` (ids only; key set pinned at :352); `memberView` + `goalItems` (the member's own goals, already readable as `goals`); `challengeView` unchanged; summary fields are numbers; no new `userId`.

## Deploy window (new backend, current client)
`updateMyCommitments` from `challengeService.ts:79-87` / `CommitmentsSheet.tsx:38` with `string[]` still works; `memberView.goals` at `ChallengeDetail.tsx:468,479,513` still `string[]`; `checkIn`, `lockInPlan`, `syncDaySummary` unchanged for old args; extra return fields harmless; `invitePreview.inviterGoals` still `string[]`.

No unmarked breaks; every report claim supported.
