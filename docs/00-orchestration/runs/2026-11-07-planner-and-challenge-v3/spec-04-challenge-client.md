# Spec 04: Challenge client — edit the dates, tick goals and cross don'ts on the dashboard, show the completion rate

*Run:* `docs/00-orchestration/runs/2026-11-07-planner-and-challenge-v3/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 120 minutes of agent work

## Goal

On `/challenge/:id` the creator can correct the season's dates and deadlines from the header; under your own row on the Today surface your goals and don'ts are always visible with a ✓ to say you kept a goal today and a ✕ to say you broke a don't, and your partner's row shows "Kept 2 of 3 goals" beside their marks; each member's row shows how much of their planned time is done today, and head to head shows the season's duration-weighted rate. Built against the backend contract of spec 03 (in parallel; the generated `api` types will not exist in your worktree, so type the new calls through the contract and say so).

## Inputs (read all of these first)

- `02_COMMON.md` (setup; **contract §A is what the server will accept; §B is your deliverable word for word, including the fixed copy**).
- `scout-challenge.md` §2–§4: where goals and don'ts render, `CheckinSheet`, `MemberRow` meta, the dashboard anatomy with line ranges, the 15 design rules.
- `CLAUDE.md` › "Accountability challenge" (Routes, Sheets, the privacy rule), › "Deep Work framework" item 7 (the day gauge, `computeDayCompletion`).
- `src/domain/challenge.ts`, `src/domain/challengeCommitments.ts`, `src/domain/challengeList.ts` (`seasonStepError`), `src/domain/dayCompletion.ts`, `src/services/challengeService.ts`, `src/hooks/useChallenges.ts`, `src/components/challenge/ChallengeDetail.tsx`, `MemberRow.tsx`, `CheckinSheet.tsx`, `CommitmentsSheet.tsx`, `ListEditor.tsx`, `ChallengeTodayBlock.tsx`, `src/pages/ChallengeCreatePage.tsx` (date fields to reuse), `src/components/ui/Sheet.tsx`, `TextButton`, `Notices`.
- Design: `~/.claude/skills/apple-design/SKILL.md` (toggle buttons, meters, sheets), `~/.claude/skills/frontend-design/SKILL.md`, `~/.claude/skills/web-design-guidelines/SKILL.md` (run over the changed files), and `docs/00-orchestration/runs/2026-11-02-duration-dnd-multichallenge-design/scout-design-review.md` "Rules for the rebuild".

## Deliverables (exact paths)

- `src/domain/challenge.ts`: `ChallengeSummary` gains the two optional fields; `buildChallengeSummary` fills them from `computeDayCompletion(day.tasks)` (private tasks included; the comment says so and why: counted, never titled); `dayCompletionPercent`, `seasonCompletion` per contract §B. `src/domain/challengeCommitments.ts`: `Commitment`, `activeCommitments`, `resolveCommitmentTexts`, `keptLine`, wrappers kept.
- `src/services/challengeService.ts`: `updateSpan(...)`, `markDay(...)`, `checkIn` passing `goalsKept`, `updateMyCommitments` sending goals as `{id?, text}`.
- `src/hooks/useChallenges.ts`: types for `goalsKept` on day views and `Commitment[]` goals.
- `src/components/challenge/ChallengeDetail.tsx`: "Edit dates" `TextButton` beside Rename, creator only, active only; a `Sheet` "Dates and deadlines" with four fields, client pre-validation (split `seasonStepError` into a dates part and a deadlines part in `challengeList.ts`, both reused by `ChallengeCreatePage`), server sentence shown with `ErrorLine`, verb "Save dates". Under your `MemberRow` in the Today surface: the "Today's commitments" block — one row per active goal and per active don't, each a 44 px toggle button (`aria-pressed`) with the shape per contract (✓ in the `share.done` colour for a kept goal; ✕ in the warning colour for a broken don't; unset is an outlined shape), calling `markDay` with the full current set of that kind, disabled while the call is in flight, optimistic is optional. Head to head gets the "Planned time done" row and the new note. Nothing else moves; the Goals and don'ts section with Edit stays where it is.
- `src/components/challenge/MemberRow.tsx`: meta gains `keptLine` and the percentage with a thin `role="meter"` (`aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, `aria-label="Planned time done"`); the "Broke:" line uses active don'ts for its "Kept all don'ts" condition (fix the archived-count bug noted in the scout).
- `src/components/challenge/CheckinSheet.tsx`: "Which goals did you keep today?" checkbox list over active goals above the don'ts, seeded from `existing.goalsKept`, sent as `goalsKept`.
- `src/components/challenge/CommitmentsSheet.tsx` / `ListEditor.tsx`: goals edited with stable ids like don'ts (the editor already does this for don'ts; reuse it).
- `src/components/challenge/ChallengeTodayBlock.tsx`: pass `goalsKept`/goals into `CheckinSheet`; no other change.
- Tests: `src/domain/challenge.test.ts` (summary fields; `dayCompletionPercent` null/0/64/100 cases; `seasonCompletion` over rows with and without fields); `src/domain/challengeCommitments.test.ts` (`keptLine`, archived goal counted as kept, null with no active goals); `src/domain/challengeList.test.ts` (the split validators). `e2e/challenge-guest.spec.ts` still passes (guest routes unchanged).
- `CLAUDE.md` › "Accountability challenge" › the `/challenge/:id` route bullet and "On Today": one sentence each for Edit dates, Today's commitments, the percentage and the head-to-head row.

## Acceptance criteria (each one checkable by a scout)

1. `buildChallengeSummary` on a day with tasks of 60m done, 120m not done, one 30m private done → `plannedMinutes: 210, doneMinutes: 90`; `dayCompletionPercent` → 42; on a day with no tasks → `plannedMinutes: 0`, percent `null`; on a summary without the fields → `null`.
2. `seasonCompletion` over `[{planned 100, done 50}, {no fields}, {planned 100, done 100}]` → `{planned 200, done 150, percent 75}`.
3. `keptLine(["a","z"], [{id:"a",text:"Read"},{id:"b",text:"Run"},{id:"z",text:"Old",archivedAt:1}])` → "Kept 2 of 3 goals" (**amended 7 Nov after round 2:** the denominator is the active goals plus any archived goal kept that day, so the line never reads "2 of 1" and never claims every goal was kept when one was not; the original "2 of 2" was the supervisor's arithmetic error); with no active goals → `null`.
4. In `ChallengeDetail.tsx`, "Edit dates" renders only when `isCreator` (the view's field) and not `readOnly`; the sheet's Save calls `updateSpan` with the four values; a server `ConvexError` message appears in an `ErrorLine`.
5. The commitments block renders under your `MemberRow` only when the member has at least one active goal or don't; each toggle has `aria-pressed` and a spoken label from the contract; a goal toggle calls `markDay({ goalsKept })` with the full set, a don't toggle `markDay({ dontsBroken })` with the full set, never both in one call.
6. `MemberRow` shows "Kept 2 of 3 goals" and "64% of planned time" with a `role="meter"` when the data is there, and neither line when it is not; "Kept all don'ts" appears only when the member has active don'ts and none broken.
7. Cyan appears on exactly one control per view (the primary next act); ✓ and ✕ are shapes with colour, never colour alone; no literal hex, no `text-[Npx]`.
8. `npx tsc -b` (see note on generated types), `npm run lint`, `npm test`, `npx playwright test e2e/challenge-guest.spec.ts` pass; `npx vite build` builds.
9. `web-design-guidelines` over the changed `.tsx`: zero open findings or each listed with a reason.
10. Nothing under `convex/` changed.

Note on generated types: `convex/_generated/api.d.ts` in your worktree does not know `updateSpan`/`markDay`. Reference them as `api.challenges.updateSpan` with a local type assertion and a `// contract: spec 03` comment, so the supervisor can drop the assertion after the merge; `tsc -b` must still pass in your worktree.

## Constraints

- Project rules from `CLAUDE.md`; the planner stays private (only aggregates travel in the summary); the partner view is read, never written here.
- One primary button per view; `TextButton` for quiet actions; sheets through `ui/Sheet`; errors through `ErrorLine`.
- The Today block on `/` (`ChallengeTodayBlock`) does not gain the commitments toggles in this run (keep Today lean); only its check-in sheet learns about goals.
- Edit with the Edit tool.

## Out of scope

- The `SeasonGrid` cells; `/review`; extending an ended season; marks on the Today block; emails.

## Verification the builder must run

- The commands in criterion 8, in your worktree.

## Report to

Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`; the supervisor files it as `report-04-round1.md`.
