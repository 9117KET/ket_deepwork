# Check 01, round 1 (scout, Sonnet) — filed by the supervisor

Ran from the worktree: `npx tsc -b` clean; `npm run lint` clean; `npx vitest run src/domain/taskUtils.test.ts src/domain/workSafety.test.ts` 2 files / 65 passed; the three spec-02 files have an empty diff. Playwright not run; e2e claims read, not executed. Read `e2e/drag-handle.spec.ts` after the builder's round-2 edit (the `flick()` burst version).

## Findings
1. Medium — `useTaskHandlers.ts:77, 159, 191`: `handleAddTask`, `handleAddTaskAbove/Below` do not check the Top 3 cap; only the UI add line does (`MustDoPinnedHeader.tsx:278, 542, 726`, field hidden at 3, no message). **Supervisor:** Add above/below is wired only for list sections (`DayPlanner.tsx:642-643`, `section.id` of the rendered list), and the Top 3 add field disappears at 3 by design; accepted, not a defect.
2. Low — `DragHandle.tsx:48` `touch-none`: a scroll that starts on the handle lifts the row instead. By design (the handle is a narrow trailing strip; the body still scrolls). Accepted.
3. Low — the fill copies direct children only; a grandchild would be dropped. Pre-existing; subtasks are one level deep in this app. Accepted.
4. Low — `docs/data-safety.md:43, 53` still describe the old copy (keeps `scheduledAt`, copies logged minutes). **Supervisor:** FIX.
5. Low — the report's "94 ms against a <100 ms assertion" is stale after round 2. Not a defect.
6. Info — Playwright/`npm test`/`vite build` figures are the builder's; re-run by the supervisor on the integrated head.
7. (from §8) `copySource` does not check for duplicates, so a fill where every root is already present does nothing and may push an empty undo entry. **Supervisor:** FIX.

## Criteria
1 met (`drag-handle.spec.ts:119` desktop, `:160` phone ≥44×44; label matched exactly `:75`); 2 met (`:127` → `[T3,T1,T2]`; touch-reorder 12 to re-run); 3 met for drop (`:136`, `:192`), **sheet "Move to Top 3" refusal has no test** (code `DayPlanner.tsx:352-355`, guard `useTaskHandlers.ts:322`) — **Supervisor:** FIX; 4 met in outcome (`:172` moves, `:182` body does not; burst inside the hold); 5 met (`fill-from-yesterday.spec.ts:127-163`: `isDone` false, no `scheduledAt`, no `manualLoggedMinutes`, sections, parent, sessions unchanged); 6 met (`:165-178`); 7, 8 cannot tell; 9 met (hunks listed, none a duration hunk).

## Data-safety trace
Carried: `title`, `isShallow`, `isPrivate`, `durationMinutes`, relocated `sectionId`, new `id`, target `date`, remapped `parentId`. Dropped: `manualLoggedMinutes` (destructured out), `scheduledAt` (`resetSchedule: true`), `isDone` forced false. `deepWorkSessions` untouched on both days (asserted). No orphan: a subtask copies only if its root is in `landing`. Walk (today 2 Top 3, yesterday 3 + 2): one slot filled, the other two Top 3 roots and the two list roots go to Tasks; Top 3 ends at 3. Undo wraps the fill (`DayPlanner.tsx:~766`).

## Paths into `mustDo`
Mouse drop → `refusedFull` toast; finger/mouse-on-handle drop → same; Alt+Arrow cannot cross lists; sheet and grip-menu "Move to Top 3" → `handleMoveToEnd` + floor guard → toast; add line → field hidden at 3; fill → overflow to Tasks.

## `useTouchReorder`
Handle lift requires `isPrimary` and a handle inside this row (`:338`); touch lifts at once (`:395`); body keeps `HOLD_MS` and `SLOP_PX` → `end(false)` so scrolling continues (`:355`); mouse/pen accepted only from the handle (`:341`); `pointercancel` handled (`:379`); `preventDefault` on non-touch pointerdown stops selection and native drag.

## `DragHandle`
`role="button"`, `tabIndex=0`, `data-drag-handle`, `aria-label="Drag to move <title>"` (one component, every handle); callers add `aria-haspopup`, `aria-expanded`, `aria-keyshortcuts`; base 28×24, `.touch-target-coarse` → 44×44 on coarse (`index.css:114-117`); Enter/Space click only when an `onClick` exists.

## Copy
Toast and handle label match §C; undo labels "Copied from yesterday" / "Copied from last week" / "Copied from <date>"; CLAUDE.md rule 1 rewritten in sentence case.
