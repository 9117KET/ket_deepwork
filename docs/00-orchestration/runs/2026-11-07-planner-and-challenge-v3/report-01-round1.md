# Report: spec 01, move a task by a visible handle, fill a day from yesterday (round 1) — filed by the supervisor from the builder's final message

**Worktree:** `.claude\worktrees\agent-ab9edc63d9abae73c`. Uncommitted. Setup: merge "Already up to date" (`3ea502e`); `node_modules` junction.

## Done
- `src/components/planner/DragHandle.tsx` (new): grip icon, `role="button"`, `data-drag-handle`, "Drag to move <title>", `cursor-grab`, `touch-none`, `.touch-target-coarse` (28x24 px under a mouse, ≥44x44 on a coarse pointer); Enter/Space activate it when it has an `onClick`.
- Placement: desktop rows in both lists (replaces the 14 px, 40 %, `sm`-hidden grip; visible at every width; Alt+Arrow, Enter, right-click, Shift+F10 unchanged); phone rows after the ⋮ on the trailing edge (iOS reorder-control position), tapping it opens the row's action sheet; Move up/down below `sm` kept.
- `useTouchReorder`: pointerdown on the row's handle lifts at once; a touch on the body keeps the 300 ms hold; a mouse or pen on the handle goes through the same hook (a mouse on a touch laptop now drags). One engine.
- Top 3 cap: `TOP3_MAX`, `wouldOverfillTop3` in `taskUtils.ts`; `handleDrop` returns `"refusedFull"` from a ref of the day's tasks (new optional third arg of `useTaskHandlers`); `DayPlanner` shows "Top 3 is full. Move one out first." for mouse drop, finger drop (`onDropRoot` → `handleDropOrRefuse`), sheet and grip-menu "Move to Top 3"; `handleMoveTask` refuses inside its updater as the last guard; reordering inside a full Top 3 works.
- `handleCopyFromDay(source, listSectionId)`: yesterday's Top 3 roots fill today's free slots in order, leftovers go to Tasks; list roots keep their section; Side Quests excluded; duplicates skipped in the landing section; subtasks follow; every copy unticked, no `scheduledAt`, no `manualLoggedMinutes`; no session copied. Undo toast "Copied from yesterday" (was "Copied fill from yesterday").
- `cloneTasksForDay` drops `manualLoggedMinutes` (comment) and gains `resetSchedule`.
- CLAUDE.md rule 1 rewritten (handle, no hold from the handle, the cap) + one sentence on the fill.
- Tests: `e2e/drag-handle.spec.ts` (9), `e2e/fill-from-yesterday.spec.ts` (3), `taskUtils.test.ts` additions; `touch-reorder.spec.ts` (new labels; two tests make room in the Top 3), `work-safety.spec.ts` (grip label regex); `copy-from-day.spec.ts` deleted. `SectionColumn.tsx` unchanged.
- Shared-file lines: `TaskItem.tsx` 12-15, 29, removed `GripIcon` 102-120, 139, 444-453 (phone handle), 488, 529-540; duration hunks untouched. `MustDoPinnedHeader.tsx` 11-12, 23-24, 392-400 (phone handle), 580-595; duration hunks untouched.

## Verification (builder)
`npx tsc -b` clean; `npm run lint` clean; `npm test` 25 files / 376 passed (with `VITE_CONVEX_URL` set); `npx vite build` ok; Playwright Chromium `--retries=0`: drag-handle 9 + fill 3 + touch-reorder 12 + minimal-today, mobile-today, work-safety, dnd-sleep-sidebar, mobile-responsive = 87 passed. Handle gesture 40-68 ms single, 94 ms with 4 workers against a <100 ms assertion. Only a chromium project exists; nothing installed. web-design-guidelines: fixed the phone handle's keyboard activation; kept sentence case.

## Open questions
`resetTimes` would also clear `durationMinutes`; cleared only `scheduledAt` (`resetSchedule`). Subtask rows also get a handle (desktop had the grip; phone now too).

## Known gaps
Fill still offered when every source root is a duplicate (pre-existing). A desktop with a fine primary pointer plus touchscreen cannot finger-drag (HTML5 drag path, as before). The 100 ms timing check passed at 94 ms under 4 workers and could flake.

## Suggestions
Check the phone layout at 280 px (row = checkbox + title + chip + ⋮ + handle, and spec 02's chip lands in the same row). A unit test for `handleCopyFromDay`.
