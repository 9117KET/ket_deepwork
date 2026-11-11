# Spec 04: drag handle on the left of every task row

*Run:* `docs/00-orchestration/runs/2026-11-11-group-reopen-handle-focus/` · *Builder:* builder ·
*Worktree:* yes · *Playwright port:* 5194 · *Time box:* 60 minutes of agent work

## Goal

On every task row, at every width and on every pointer type, the drag handle is the first
thing in the row, at its left edge, before the checkbox. Today that is true on a desktop and
false on a phone, where the handle trails after the ⋮. The user asked for the left side.

## Inputs (read all of these first)

- `02_COMMON.md` (run folder): setup, rules, checks, report.
- `scout-planner-ui.md` (run folder), part A: every render site with line numbers, what does
  and does not depend on the handle's position, the tests to re-check.
- `src/components/planner/TaskItem.tsx`, `src/components/planner/MustDoPinnedHeader.tsx`,
  `src/components/planner/DragHandle.tsx`, `src/hooks/useTouchReorder.ts`.
- `e2e/drag-handle.spec.ts`, `e2e/touch-reorder.spec.ts`, `e2e/helpers/mobile.ts`.
- `CLAUDE.md` "Responsive foundations".
- Skills: `apple-design`, `frontend-design`, `web-design-guidelines`.

## Deliverables

- `src/components/planner/TaskItem.tsx`, `src/components/planner/MustDoPinnedHeader.tsx`: the
  phone rows render the handle first.
- A new e2e file `e2e/drag-handle-left.spec.ts` pinning the position.
- Comment and `CLAUDE.md` text that says "trailing" corrected.

## Acceptance criteria

1. On a touch device (coarse pointer, 390px wide), for a Tasks row, a Top 3 row and a subtask
   row, the handle's bounding box starts left of the row's checkbox and left of its title.
2. On a desktop (fine pointer, 1280px wide), the same holds for a Tasks row, a Top 3 row and a
   subtask row.
3. On the phone the handle is still at least 44x44, the row is still one line (handle,
   checkbox, title, one chip, ⋮), nothing overflows horizontally at 280px wide, and the title
   keeps at least the width it can; say in the report how much title width a 390px row lost.
4. The phone progress bar under a row still lines up with the title's left edge.
5. All four ways of moving a task still work and their existing tests pass unchanged, or with a
   change you name and justify: `e2e/drag-handle.spec.ts`, `e2e/touch-reorder.spec.ts`,
   `e2e/mobile-today.spec.ts`, `e2e/mobile-responsive.spec.ts`, `e2e/duration-chip.spec.ts`,
   `e2e/work-safety.spec.ts`, `e2e/fill-from-yesterday.spec.ts`.
6. A vertical swipe that starts on the row body (not on the handle) still scrolls the page on a
   phone, and a swipe starting on the checkbox does not lift the row.
7. A Top 3 phone row that shows no handle today (`trailing !== 'menu'`) keeps its title aligned
   with the rows that do show one, or you state why not.

## Constraints

- Do not change `useTouchReorder.ts` or `DragHandle.tsx` behaviour. A class change on the
  handle for spacing is allowed.
- Do not touch the timer, Focus mode, `DayPlanner.tsx` or anything under `convex/` or
  `src/components/challenge/` (other builders own them).

## Out of scope

- Any change to how a drag works, the hold time, or the ⋮ sheet.

## Verification the builder must run

The checks in `02_COMMON.md`, plus Playwright on port 5194 for the seven files in criterion 5
and the new file.

## Report to

Your final message; the supervisor files it as `report-04-round1.md`.
