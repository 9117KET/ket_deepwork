# Spec 03: Challenge backend — edit the dates, goals with ids, daily marks, minutes in the summary

*Run:* `docs/00-orchestration/runs/2026-11-07-planner-and-challenge-v3/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 90 minutes of agent work

## Goal

A member who created a challenge with the wrong dates can correct them without losing a day anybody recorded; each member can mark, any time during the day, which goals they kept and which don'ts they broke, and the partner sees those marks; the published day summary can carry planned and done minutes so a duration-weighted completion rate can be shown. All of it lands in `convex/` only, additive and optional, so the current client keeps working against the new backend and the client of spec 04 can be built against the contract in parallel.

## Inputs (read all of these first)

- `02_COMMON.md` (setup; **contract §A is the deliverable, word for word**).
- `scout-challenge.md` §1–§3 and the Risks list: the readers of the span, `requireMember`/`fail()`, how `checkIn` and `upsertDay` behave, the strict `summaryValidator`, where `dayView` is the partner's allow-list.
- `convex/_generated/ai/guidelines.md`.
- `CLAUDE.md` › "Accountability challenge" (all of it) and › "Cross-device sync" rule on two-sided deploys.
- `convex/challenges.ts`, `convex/schema.ts`, `convex/_shared/challengeValidators.ts`, `convex/challengesInternal.ts`, `convex/_shared/challengeInactivity.ts`, `convex/challenges.test.ts` (the `pair`, `signUp`, fake-timer seeding), `convex/challengeCommitments.test.ts`, `convex/challengesMulti.test.ts`.

## Deliverables (exact paths)

- `convex/_shared/challengeValidators.ts`: `commitmentValidator` + alias, the two optional summary fields, as in contract §A.
- `convex/schema.ts`: `challengeMembers.goals` union; `challengeDays.goalsKept`.
- `convex/challenges.ts`: `normalizeGoals`; `memberCommitments`/`memberView` returning `Commitment[]` goals; `dayView` and `myDayView` with `goalsKept`; `updateMyCommitments` accepting bare strings and `{id?, text}` for goals with the don'ts rule (archive, mint `goal-<now>-<n>`, honour `goal-legacy-<i>` ids for a row still on strings); `updateSpan`; `markDay`; `checkIn` with optional `goalsKept`; one shared `assertSpan` helper used by `createChallenge` and `updateSpan`. The creator check reuses whatever `leaveChallenge`/`deleteChallenge` use.
- `convex/challengeEdits.test.ts` (new): the cases in the acceptance criteria. Existing tests updated only where a `toEqual` on a day view or a goals list now needs the new fields (say which).
- `CLAUDE.md` › "Accountability challenge": add one short paragraph "Editing the dates" (the six rules in plain sentences) and one "Daily marks" (what `markDay` writes, that it is not an act, goals have ids, legacy strings), and the two summary fields in the **Tables** paragraph. Keep the register of the file.

## Acceptance criteria (each one checkable by a scout; all in `convex/challengeEdits.test.ts` unless stated)

1. `updateSpan` by the partner fails with "Only the creator can change the dates"; by the creator on an ended challenge fails with "This challenge has ended"; by a non-member with "You are not in this challenge".
2. `updateSpan` with end before the creator's local today fails with "The end date can't be before today"; with a start after a day on which the partner has a `planSetAt` row fails with the sentence naming that day (`"… past 24 Oct, when the first lock-in or check-in was recorded"`); a span of 367 days fails with "A challenge can run for at most a year"; a plan deadline at 22:00 fails as in `createChallenge`.
3. A valid `updateSpan` (start earlier, end later, deadlines changed) returns the new view; `myChallenges` and `history` reflect it; every `challengeDays` row that existed before still exists, unchanged (count and content).
4. `updateMyCommitments` on a member whose goals are legacy strings `["Read", "Run"]`: `memberView.goals` before the write is `[{id:"goal-legacy-0",text:"Read"},{id:"goal-legacy-1",text:"Run"}]`; a `markDay` with `goalsKept:["goal-legacy-0"]` succeeds; then `updateMyCommitments({goals:[{id:"goal-legacy-0",text:"Read daily"},"Swim"]})` yields goals with ids `goal-legacy-0` (text updated), a minted `goal-…` for Swim, and `Run` archived; the earlier day's `goalsKept` still resolves.
5. `markDay` today with `goalsKept` only leaves an existing row's `dontsBroken`, `summary`, `checkinAt`, `planSetAt`, `note` byte-for-byte unchanged; `markDay` with `dontsBroken` only leaves `goalsKept` unchanged; an unknown id fails "Unknown goal" / "Unknown don't"; a date two days back fails with the `checkIn` sentence; a date outside the span fails "That day is outside the challenge"; the partner's `dayCards`/`todayCards` `dayView` shows `goalsKept`; a row created by `markDay` alone has no `planSetAt`/`checkinAt`, and the inactivity decision for that member is the same as with no row (`convex/challengeInactivity.test.ts` style assertion, or a sweep run).
6. `checkIn` with `goalsKept` writes it; `checkIn` without it keeps what `markDay` wrote; `checkIn` still de-duplicates `dontsBroken` and rejects an unknown don't.
7. `syncDaySummary`, `lockInPlan`, `checkIn` accept a summary with `plannedMinutes: 240, doneMinutes: 90` and store it; they still accept a summary without the fields (old client); the partner's `dayView.summary` carries them.
8. `npm run test:convex` passes in full; `npx tsc -b` and `npm run lint` are clean; nothing under `src/` changed except `CLAUDE.md` is at the repo root and may change. (If `tsc -b` fails because `src/domain/challenge.ts` mirrors the summary type strictly, report it; do not edit `src/`.)
9. The report lists every public function whose args changed and states the deploy order (backend first, then `main`).

## Constraints

- Project rules from `CLAUDE.md`; every refusal is a `fail()` sentence; the partner view gains `goalsKept` and nothing else; `userId` never returned; `challengeDays` rows never deleted.
- Additive only: every new arg and field optional, every new function new. No change to `syncDaySummary`'s or `lockInPlan`'s rules.
- Do not edit anything under `src/` (spec 04 owns it).

## Out of scope

- Extending an ended season; reordering goals; a mark counting as an act for inactivity; emails about marks; the client.

## Verification the builder must run

- `npm run test:convex`, `npx tsc -b`, `npm run lint`, in your worktree.

## Report to

Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`; the supervisor files it as `report-03-round1.md`.
