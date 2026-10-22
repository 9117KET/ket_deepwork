# Report 02, round 2 (FIX): Today on a phone

*Filed by the supervisor from the builder's final message. Commit `4c6084a` on `worktree-agent-a99d740f54a18a71d`, on top of `a871408`, no rebase.*

- Fix 1: done. `TaskActionSheet` takes an optional `onSetDuration` and shows a "Set duration…" row (Clock icon). On phones `TaskItem` passes it for subtasks only, wired to the existing `onSchedule`, which opens `ScheduleSheet` for the subtask via `DayPlanner`'s `setScheduleTaskId`; "Save length only" sets the length. Root tasks keep "Schedule…". New test "a subtask can set its duration from its sheet" (opens "Pack the bag"'s sheet, no Schedule row, taps "Set duration…", sees the dialog named "Pack the bag" with "How long").
- Fix 2: done. On a coarse pointer the title cell in `TaskItem` and `MustDoPinnedHeader` is a 44px-tall button that opens the row's sheet; checkbox and ⋮ keep their own hit areas; a title being edited stays an input and a URL title stays a link; fine pointer unchanged. New test "tapping a title opens its action sheet with the title in full".

Files: `TaskActionSheet.tsx`, `TaskItem.tsx`, `MustDoPinnedHeader.tsx`, `e2e/mobile-today.spec.ts` (now 13 tests).

Verification (private-port scratch config): `npm run lint` clean; `npx tsc -b` exit 0; `npx playwright test e2e/mobile-today.spec.ts e2e/mobile-responsive.spec.ts e2e/work-safety.spec.ts --reporter=line` → `51 passed (1.4m)`.

Open question: on a subtask, "Set duration…" opens the full schedule sheet, so "At this time" and "Next free slot" are also offered; using them would put the subtask on the calendar, which desktop never offers for subtasks. A length-only mode of `ScheduleSheet` would close that; not added (outside the fix list).
