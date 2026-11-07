# Spec 01: Move a task by a visible handle, fill a day from yesterday

*Run:* `docs/00-orchestration/runs/2026-11-07-planner-and-challenge-v3/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 90 minutes of agent work

## Goal

A user on the live app says moving a task is "only move up or down, which is boring", on desktop and on a phone, although a drag engine shipped on 2 Nov and works in Chromium. When this is done every root row in the Top 3 and in Tasks shows a drag handle at every width, a finger on the handle lifts the row at once (no 300 ms hold), a mouse on the handle or the row drags it, the Top 3 never holds more than three roots however a task gets there, and "Fill from yesterday" brings back yesterday's Top 3 (into empty slots) and yesterday's list, unticked, with no stale times or logged minutes.

## Inputs (read all of these first)

- `02_COMMON.md` (setup, contract §C): the shared-file rule with spec 02 and the fixed words.
- `scout-planner.md` §1 and §3: how the drag paths are wired today, line by line, and the defects 1–6; the Playwright evidence that the engine works.
- `CLAUDE.md` › "Responsive foundations" rule 1 (the four ways a task moves, `useTouchReorder`, the subtask rule) and › "Today and the calendar".
- `docs/data-safety.md` (a copy must never create or move worked minutes).
- `src/components/planner/MustDoPinnedHeader.tsx`, `TaskItem.tsx`, `SectionColumn.tsx`, `DayPlanner.tsx`, `src/hooks/useTouchReorder.ts`, `src/hooks/useTaskHandlers.ts`, `src/domain/taskUtils.ts`, `e2e/touch-reorder.spec.ts` (its `seedDesktop`, `openDesktop`, `mouseDrag` helpers), `e2e/copy-from-day.spec.ts`, `e2e/helpers/mobile.ts`.
- Design: `~/.claude/skills/apple-design/SKILL.md` (drag affordances, 44 px targets), `~/.claude/skills/frontend-design/SKILL.md`, `~/.claude/skills/web-design-guidelines/SKILL.md` (run over the changed files before reporting).

## Deliverables (exact paths)

- `src/components/planner/MustDoPinnedHeader.tsx`, `src/components/planner/TaskItem.tsx`, `src/components/planner/SectionColumn.tsx` (grip hunks only; see constraints): one shared drag handle element on every root row — visible at every width and on both pointer types, at least 44x44 px hit area on a coarse pointer (`.touch-target-coarse`), `cursor: grab`, the spoken label "Drag to move <title>", keyboard behaviour unchanged (Alt+Arrow, Enter menu). Put it in one small component (`src/components/planner/DragHandle.tsx`) used by both lists.
- `src/hooks/useTouchReorder.ts` and the wiring in `DayPlanner.tsx`: a `pointerdown` with `pointerType === 'touch'` on the handle lifts the row immediately (no hold); a touch on the row body keeps the current 300 ms hold so a swipe still scrolls. On a coarse-pointer device a `pointerType === 'mouse'` drag must also work: either route mouse pointer events on the handle into the same reorder hook, or render the HTML5 draggable path alongside the phone anatomy — your choice, but a mouse on a touch laptop can drag after this.
- `src/hooks/useTaskHandlers.ts` (`handleDropOrRefuse` / `handleMoveTask` path) and `DayPlanner.tsx`: a drop or a sheet "Move to Top 3" that would make the Top 3 hold more than 3 roots is refused and the toast says "Top 3 is full. Move one out first." (reuse the subtask-refusal toast mechanism, `DayPlanner.tsx:342-345`). Reordering within a full Top 3 still works.
- `src/hooks/useTaskHandlers.ts` `handleCopyFromDay` and `DayPlanner.tsx` `copySource`: the copy takes yesterday's `mustDo` roots into today's Top 3 while slots remain (first by order, at most `3 - today's mustDo roots`), any leftover `mustDo` roots go to the list; the list roots copy as today; roots already present (same section and lowercased title) are skipped as now; subtasks follow their copied root; every copied task is `isDone: false`, has `scheduledAt` cleared (`resetTimes: true`; there is no calendar event for a copied id) and has no `manualLoggedMinutes`. The button is offered while today's list is empty (as now); the undo toast stays "Copied from yesterday".
- `src/domain/taskUtils.ts` `cloneTasksForDay`: drops `manualLoggedMinutes`, with a comment saying why (legacy field; copying it invents logged time).
- Tests: `e2e/drag-handle.spec.ts` (desktop 1280x900: handle visible on every row without hover; drag Top 3 row 3 onto row 1 by the handle reorders; drag a Tasks row into a full Top 3 is refused with the toast and the Top 3 keeps 3; phone (`PHONE` fixture): a touch-drag from the handle with no hold moves a row; a plain swipe on the body still scrolls or at least does not move it). `e2e/fill-from-yesterday.spec.ts` (seed yesterday with 3 Top 3 + 2 list tasks, one done, one with `scheduledAt` and `manualLoggedMinutes`; today empty → button fills Top 3 (3) and list (2), all unticked, no `scheduledAt`, no `manualLoggedMinutes`; today with 1 Top 3 → fill adds 2 Top 3 roots and the list; today with a list → no button; undo restores). Replace or delete `e2e/copy-from-day.spec.ts` (it pins the old keep-`scheduledAt` behaviour). `src/domain/taskUtils.test.ts`: `cloneTasksForDay` drops `manualLoggedMinutes`.
- `CLAUDE.md` › "Responsive foundations" rule 1: update the two sentences about how a task moves (handle, no hold from the handle, the cap) and add one sentence about what "Fill from yesterday" copies.

## Acceptance criteria (each one checkable by a scout)

1. In `e2e/drag-handle.spec.ts`, every root row in both lists has an element with `aria-label` starting "Drag to move" that is visible (`toBeVisible`) without hover, at 1280x900 and at the `PHONE` viewport.
2. Dragging Top 3 row 3 onto row 1 by the handle with a mouse reorders to `[3,1,2]`; the existing `e2e/touch-reorder.spec.ts` still passes (12).
3. Dropping a Tasks row onto a Top 3 that holds 3 roots leaves the Top 3 at 3 and shows the toast text from the contract; "Move to Top 3" in the ⋮ sheet on a full Top 3 does the same.
4. On the phone viewport, `pointerdown` (touch) on the handle followed by a move of 60 px within 100 ms lifts and moves the row; the same gesture on the row body does not move it (the hold still gates body drags).
5. Fill from yesterday with today empty creates exactly yesterday's roots and subtasks in the right sections with `isDone === false`, no `scheduledAt`, no `manualLoggedMinutes`, read back from `localStorage` `deepblock_state_v1`.
6. With one Top 3 root already set today, the fill adds two Top 3 roots and the rest to the list, and never exceeds three.
7. `npx tsc -b`, `npm run lint`, `npm test`, `npx playwright test e2e/drag-handle.spec.ts e2e/fill-from-yesterday.spec.ts e2e/touch-reorder.spec.ts e2e/minimal-today.spec.ts e2e/mobile-today.spec.ts` all pass; `npx vite build` builds.
8. `web-design-guidelines` run over the changed `.tsx` files: zero open findings, or each remaining one listed in the report with a reason.
9. No change under `src/domain/durations.ts`, `TaskDurationPicker.tsx`, `ScheduleSheet.tsx`, `AddTaskInput.tsx` or the duration chip hunks of the two shared files (spec 02 owns them).

## Constraints

- Project rules from `CLAUDE.md` apply; worked minutes are sacred: a copy never creates a `DeepWorkSession` and never carries logged time.
- Subtasks keep their rule (never leave the parent; the existing toast).
- The handle is one component; no second drag engine. Keep the `data-testid`s the existing e2e relies on.
- Edit with the Edit tool. Do not touch spec 02's hunks (contract §C). Say in the report the line ranges you changed in `TaskItem.tsx` and `MustDoPinnedHeader.tsx`.

## Out of scope

- Carrying forward unfinished tasks only; "Fill from last week" semantics beyond what `copySource` already does; dragging subtasks across parents; the duration chip.

## Verification the builder must run

- The commands in criterion 7, in your worktree, and `npx playwright test` for the two new specs on both projects the config defines. If the repo's Playwright config has a Firefox or WebKit project installed, run `e2e/drag-handle.spec.ts` on it too and report; if the browser is not installed, say so and do not install it.

## Report to

Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`; the supervisor files it as `report-01-round1.md`.
