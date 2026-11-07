# Scout: planner drag and drop, duration, Fill from yesterday (7 Nov 2026)

Read-only audit of the working tree at `752119f` (branch `run/2026-11-05-solo-countdown`). Two Playwright jobs were run (port 5173 free; Playwright started `npx vite` itself).

Supervisor's own checks, added on top: the live bundle at https://ket-deepwork.vercel.app (`assets/index-BzUvSIXY.js`) contains "Subtasks stay inside their task", "Move to Top 3" and "Fill from yesterday", so the 2 Nov drag-and-drop build *is* deployed. The user still reports that on the live app "only move up or down" is possible, on desktop and on a phone, and that they did not know a drag existed. Conclusion: the engine works in Chromium with a fine pointer; the failure is discoverability (no visible handle, 300 ms hold on a phone, mouse path not rendered on a coarse-pointer device). Lines cited below were spot-checked by the supervisor: `MustDoPinnedHeader.tsx:70` (`const MAX = 3`), `:276` (cap only in `handleAdd`), `useTaskHandlers.ts:437-443` (the `mustDo`/`sideQuest` filter), `DayPlanner.tsx:526-534` (`copySource`), `:748-758` (the button) are correct.

## Defects found

1. `src/components/planner/MustDoPinnedHeader.tsx:545-548` and `src/hooks/useTouchReorder.ts:322`: any device whose primary pointer is `(pointer: coarse)` gets the phone anatomy. The HTML5 mouse path is not rendered there; rows move only by a 300 ms press-and-hold with `pointerType==='touch'`, or by the ⋮ sheet. A mouse on a touch laptop or tablet cannot drag.
2. `MustDoPinnedHeader.tsx:584`: the only visible drag affordance is a 14 px grip at 40 % opacity (`text-share-onSurfaceVariant/40`), hidden under `sm`. The whole row is `draggable` (`:555`), so dragging works, but it looks undraggable.
3. `MustDoPinnedHeader.tsx:70, 276` vs `DayPlanner.tsx:739`: the cap of 3 is enforced only on Add. A drop from Tasks into the Top 3 does not check it. Observed: a drop left `mustDo=[L2,T2,T3,T1]`, four items.
4. `src/hooks/useTaskHandlers.ts:437-443`, `DayPlanner.tsx:526-534`: "Fill from yesterday" exists but never copies the Top 3 (`sectionId !== 'mustDo'` filtered out) and shows only while today has no non-Top-3 task. If yesterday held only Top 3 tasks the button renders and does nothing (`:447`).
5. `src/domain/taskUtils.ts:62-65`: `cloneTasksForDay` is called without `resetTimes` (`useTaskHandlers.ts:448`). A copied task keeps `scheduledAt` as a chip, but no calendar event exists for it (the calendar link is keyed on the task id). `e2e/copy-from-day.spec.ts` pins this as intended ("keep scheduledAt").
6. The same spread copies the legacy `Task.manualLoggedMinutes` (`types.ts:54`), so a copied row shows faded "logged" progress never worked today.

## 1. Drag and drop as built

**Mouse (fine pointer), Top 3.** `MustDoPinnedHeader.tsx:548-571`: each root row is `draggable={canReorder ? true : undefined}`; `canReorder` is true because `DayPlanner.tsx:737-739` passes `onDragStart` and `onDropAt`. `onPointerDownCapture` records where the pointer went down. `handleRowDragStart` (`:101`) cancels the drag if the origin is inside `input, select, textarea, button, a` or is a `LABEL` (the title text still drags). `handleRowDragOver` (`:123`) calls `preventDefault` and sets `dropIndex` from a half-height hit test. `handleRowDrop` (`:135`) calls `onDropAt(orderedIndexForRank(dropIndex))` → `handleDropOrRefuse("mustDo", i)`. `useTaskHandlers.ts:361-418` reorders within the section or calls `handleMoveTask` across sections, with a ref payload (no stale closure). An empty Top 3 has `data-testid="top3-empty-drop"` (`:677-704`). No drop zone exists between sections: a row drops on any row of either list or on an empty list's placeholder. Handle: the whole row; the grip (`:569-588`, `role=button`) is also the Alt+Arrow and Enter-menu target.

**Mouse, Tasks.** `SectionColumn.tsx:375-396` wires `TaskItem` (`TaskItem.tsx:524-533`, `draggable={isReorderable}`) to `handleDragStart`, `handleDragOver`, `handleDrop`. Empty list zone at `:281-289`.

**What blocks a drop.** Subtasks never leave their parent: `handleDrop` returns `refusedSubtask` and a toast says "Subtasks stay inside their task. Use Move to another parent." (`DayPlanner.tsx:342-345`). If `useCoarsePointer()` is true the mouse path is not rendered. Done tasks are not blocked.

**Touch.** `useTouchReorder.ts`: enabled only when `isCoarsePointer` (`DayPlanner.tsx:350-352`); only `pointerType==='touch'` and `isPrimary` start a gesture (`:322`); `HOLD_MS` 300, slop 8 px, edge auto-scroll; the drop goes through the same `handleDragStart`/`handleDrop` (`DayPlanner.tsx:353-356`).

**Keyboard and sheet.** Alt+ArrowUp/Down on the grip; Enter or context menu on the grip. `TaskActionSheet` offers "Move to Top 3" / "Move to Tasks" (`DayPlanner.tsx:346-348`, to the end) and Move up / down. Phone-width mouse layouts (below `sm`) show ArrowUp/ArrowDown buttons (`MustDoPinnedHeader.tsx:589-606`).

**Gates run.** `npx playwright test e2e/touch-reorder.spec.ts --reporter=line --retries=0`: **12 passed (28.6 s)** (6 phone, 6 desktop 1280x900, including "a task dropped on an empty Top 3 lands in it" and Alt+Arrow). No desktop test for Top 3 → Top 3 mouse drag except `e2e/dnd-sleep-sidebar.spec.ts:162`. `e2e/copy-from-day.spec.ts`: 1 passed.

**Extra script** (`C:\Users\kinlo\AppData\Local\Temp\claude\96a3126d55f0ebd2\23d27ef4-5fc3-423f-8c32-4231a83b8a12\scratchpad\dnd-desktop.spec.ts`, Chromium 1280x800, no touch, localStorage seed of three Top 3 and two Tasks rows):

```
before                          mustDo=[T1,T2,T3] list=[L1,L2]
T3->T1 top half (mouse, title)  mustDo=[T3,T1,T2] list=[L1,L2]
dragTo T2->T1                   mustDo=[T3,T2,T1] list=[L1,L2]
grip drag T3->T1                mustDo=[T2,T3,T1] list=[L1,L2]
L2->Top2 (mouse)                mustDo=[L2,T2,T3,T1] list=[L1]
```

Every path moved the order correctly, including Tasks → Top 3 (and past the cap). The grip box was 14x14 px at x=277. Last commits touching these files: `f759df7`, `ed3c557` (2 Nov 2026).

## 2. Duration

**Desktop today.** `TaskDurationPicker.tsx` is a native `<select>`: "Not set", 10m, 15m, 20m, 30m, 45m, 60m, 90m, 2h … 8h (`durations.ts:17-19`, `durationOptions` `:28`); a stored off-ladder value is inserted in order. Set: a small bordered pill. Unset: `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 touch:opacity-100` (`:30`), invisible with a mouse until hover or focus. In rows with `onSchedule` it is `hidden sm:block` (`MustDoPinnedHeader.tsx:639`, `TaskItem.tsx:631`).

**Phone today.** `TaskItem.tsx:373-380`: one chip showing `scheduledAt`, or the duration if set, opening `ScheduleSheet`, which has the ladder (`ScheduleSheet.tsx:71-72`, rendered `:118`) plus Next free slot or a time. No free typing.

**First version.** `201c295` (27 Feb 2026) had no per-task duration. `725dd53` (28 Feb) added a `<select>` with —, 15m, 30m, 45m, 60m, 90m, 120m (`TaskItem.tsx:159-179`) beside `<input type="time">`. `4494597` (April) widened it to 5m–480m. `3ae0f9e`^ had the focus-block picker ("3 blocks · 2h15"). `git log -S'type="number"' -- src/components/planner` returns nothing: **no version ever had free-typed hours.** The user's answer ("Both": a visible field on every row that accepts typed hours and minutes) settles the design.

**Title parsing.** `AddTaskInput.tsx:20-26` trims and calls `onAdd(trimmed)`; no "2h"/"90m" parsing. `parseClockRangeMinutes` in `taskProgress.ts` exists only for the manual log.

## 3. Fill from yesterday

**Exists today.** `DayPlanner.tsx:526-534` (`copySource`) and `:748-758` (the button, between the Top 3 and the Tasks list). Shown only when `dayState.tasks.some(t => t.sectionId !== "mustDo")` is false. Source order: yesterday ("Fill from yesterday"), same weekday last week ("Fill from last week"), then `getLastDayWithTasks` ("Copy from <date>"). Wrapped in `undoable.run("Copied …")`. Handler `useTaskHandlers.ts:426-459`: skips roots already present (same section and lowercased title), keeps subtasks of copied roots, appends; excludes `mustDo` and `sideQuest` (comment: "MUSTs are a daily intention, not a template — never copy them from another day"; widened to Side Quests in `9cd18d7`, 24 Apr).

**History.** `725dd53` (28 Feb) introduced `handleCopyFromPreviousDay`/`handleFillFromLastWeekday`; `4125927` (6 Mar) reworked the options; `d799778` "Copy task times on day fill". Carry-forward of incomplete tasks: added `4494597`, removed `a361f1e` (22 Jun) "per the move-on / anti-procrastination intent".

**Fields for a copy.** `cloneTasksForDay(tasks, date, {resetTimes?})` (`taskUtils.ts:51-71`) sets a new `id`, `date`, `isDone:false`, remaps `parentId` through `idMap`; spreads everything else (`durationMinutes`, `scheduledAt`, `isShallow`, `isPrivate`, `manualLoggedMinutes`). A parent filtered out leaves its subtask with `parentId: undefined` (a root); the handler avoids this by selecting by root id. `deepWorkSessions` and `habitCompletions` live on `DayState` and are not copied.

**Sync.** `useTaskSync.ts` has no bulk cap; it sends the open day's `id`, `title`, `isDone`, `parentId` 1.2 s after the last edit in one `syncDayTasks` call. New ids become new Google Tasks. `scheduledAt` is not sent, so no calendar event is created for a copy.

**Empty-day states.** `MustDoPinnedHeader.tsx:677-714` "No priorities set. Add up to 3 for today." (inside `top3-empty-drop`); `SectionColumn.tsx:273-292` "Nothing here yet."; the Fill button's slot is `DayPlanner.tsx:748-758`.

## 4. Tests to extend

Vitest: `src/domain/taskUtils.test.ts` 23 (`cloneTasksForDay` at `:130`, `reorderTasks`, `getDescendantIds`); `dayCompletion.test.ts` 16; `taskProgress.test.ts` 58; `workSafety.test.ts` 37; `useCoarsePointer.test.ts` 6. No `durations.test.ts`, no `useTouchReorder` test, no `useTaskHandlers` test.

Playwright: `e2e/touch-reorder.spec.ts` 12; `e2e/dnd-sleep-sidebar.spec.ts` 4 (Top 3 reorder `:162`); `e2e/copy-from-day.spec.ts` 1; `e2e/minimal-today.spec.ts` 8; `e2e/day-completion.spec.ts` 4; `e2e/mobile-today.spec.ts` 13; `e2e/work-safety.spec.ts` 11; `e2e/completion-claim-blocks.spec.ts` 4. Reusable: `seedDesktop`, `openDesktop`, `mouseDrag` in `e2e/touch-reorder.spec.ts:269-312`; `seedRichDay`, `PHONE` in `e2e/helpers/mobile.ts`.

Gaps: no e2e for Top 3 → Top 3 mouse drag with a seeded Tasks list, none for the 3-task cap on a drop, none for duration discoverability.
