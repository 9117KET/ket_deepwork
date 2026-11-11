# Spec 06: two defects from the sweep (away-block day, cancelled prompt)

*Run:* `docs/00-orchestration/runs/2026-11-11-group-reopen-handle-focus/` · *Builder:* builder ·
*Worktree:* yes · *Playwright port:* 5196 · *Time box:* 60 minutes of agent work

## Goal

Two things a user can hit today stop happening: minutes worked away from the screen are filed
on the day the block started, not the day that happened to be on screen; and cancelling an
"add task" prompt adds nothing.

## Inputs (read all of these first)

- `02_COMMON.md` (run folder): setup, rules, checks, report.
- `scout-sweep.md` (run folder), findings 1 and 2.
- `docs/data-safety.md`, row 1 ("a block belongs to the day it started") and "Testing these".
- `src/components/timer/useDeepWorkTimer.ts`, `src/storage/activeBlock.ts`,
  `src/domain/workSafety.ts` (`blockDayIso`), `src/hooks/useTaskHandlers.ts`,
  `src/components/planner/DayPlanner.tsx:312-320`.
- `e2e/work-safety.spec.ts` (`seed()` puts a block mid-run or already landed).

## Deliverables

- The fix for each defect, each with a test written first that fails on the current code.
- New tests in new files: a unit test beside the code where the rule is pure, and
  `e2e/away-block-day.spec.ts` and `e2e/add-task-cancel.spec.ts`.
- `docs/data-safety.md`: a "Closed" row for the away-block day.

## Acceptance criteria

1. A block started on day D, with the planner then paged to another day, the tab closed and
   the block left to land: on return the claim records the session on day D, with its true
   start and finish instants. The day that was on screen gains nothing.
2. The same when the block is paused and restored, and when it is still in flight on return
   and lands live: day D in every case.
3. A block that crosses midnight belongs to the day it started on (say in the report what
   `blockDayIso` does and that you kept it).
4. The stored record never carries a UTC-derived date: the two fallbacks at
   `useDeepWorkTimer.ts:390,403` use the local date or are removed.
5. Cancelling the prompt of "Add task above", "Add task below" and "Add subtask" adds no task
   and no Undo offer; an empty or whitespace title adds none either; a typed title still adds
   the task where it did.
6. No existing test is weakened; `e2e/work-safety.spec.ts`, `e2e/session-attribution.spec.ts`
   and `e2e/completion-claim-blocks.spec.ts` pass.

## Constraints

- Worked minutes are sacred: nothing here may drop, shorten or double a session. Do not change
  `AWAY_BLOCK_MAX_AGE_MS`, the claim UI, or what Stop, Discard and Finish early do.
- In `useDeepWorkTimer.ts` change only what the stored day needs. Another builder is editing
  `FocusMode.tsx`, `MobileFocusPanel.tsx`, the Focus render sites in `DayPlanner.tsx` and
  possibly `DeepWorkTimer.tsx`; do not touch those. Another edits `TaskItem.tsx` and
  `MustDoPinnedHeader.tsx`; do not touch those either.
- Keep `window.prompt` (replacing it with a sheet is out of scope); only fix the cancel.
- Nothing under `convex/` or `src/components/challenge/`.

## Out of scope

- Mounting the timer above the router (finding 4), two-tab coordination, the stale docs.

## Verification the builder must run

The checks in `02_COMMON.md`, plus Playwright on port 5196 for the three files in criterion 6
and the two new files.

## Report to

Your final message; the supervisor files it as `report-06-round1.md`.
