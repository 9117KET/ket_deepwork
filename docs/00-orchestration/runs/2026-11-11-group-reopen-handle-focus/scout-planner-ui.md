# Scout: drag handle position and Focus mode exit (Mode A, read-only, 2026-11-11)

Condensed by the supervisor from the scout's report. Line numbers are the scout's, read at
`cae99e5`; a builder re-reads before editing.

## A. Drag handle

- `src/components/planner/DragHandle.tsx:30-52`: a `span role="button" data-drag-handle`
  labelled "Drag to move <title>". It sets no position; placement is the caller's DOM order.
  `touch-target-coarse` makes it at least 44x44 on a coarse pointer; `touch-none` is on it.
- Desktop rows already render it **first**: `TaskItem.tsx:543-555`, `MustDoPinnedHeader.tsx:596-612`.
- Phone rows render it **last**, after the ⋮:
  - `TaskItem.tsx:462-468`, row at `:392` (`group flex items-center gap-1`): checkbox (393),
    title (396-428), chip (429-447), ⋮ (448-458), handle (462).
  - `MustDoPinnedHeader.tsx:411-417` in `renderPhoneRow`, row at `:343`: checkbox (344), title
    with rank (349-368), chip (370-388), ⋮ or X (389-408), handle (411).
- Subtasks are `TaskItem` with `isSubtask` (phone wrapper `ml-6 border-l-2 ... pl-1`, `:387`).
- The phone progress bar wrapper is `pl-11 pr-2` (`TaskItem.tsx:471`,
  `MustDoPinnedHeader.tsx:420`), sized to sit under the title past a 44px checkbox. It must be
  re-aligned once a 44px handle precedes the checkbox.
- `useTouchReorder.ts` does not depend on the handle's position: hit testing is by
  `[data-reorder-row]` rects (196-254), the handle is found by selector (135, 337-338), there is
  no ghost offset and no pointer capture.
- No test asserts left or right. To re-check for hard-coded x positions near the right edge:
  `e2e/drag-handle.spec.ts:182-190` and the phone cases in `e2e/touch-reorder.spec.ts`.
- The 7 Nov run put the phone handle trailing on purpose (iOS reorder position,
  `2026-11-07-planner-and-challenge-v3/review-01-round1.md:8`). The user now reverses that.
- Text to update: `TaskItem.tsx:13` header comment, `DragHandle.tsx` header, `CLAUDE.md`
  "Responsive foundations" (phone anatomy).

## B. Focus mode

- Desktop: `src/components/timer/FocusMode.tsx`, rendered by `DayPlanner.tsx:887-895` while a
  block runs or is paused and `focusDismissed` is false (`DayPlanner.tsx:400-406`). `hidden ...
  lg:flex`, so desktop only. Exit today: Esc (70-81), or a top-left button (110-119) reading
  "Leave focus", `text-sm`, `text-share-onSurfaceVariant/70`, no border or fill. Footer hint
  286-288 mentions Esc. After leaving there is no way back in until the next block.
- Phone: `src/components/timer/MobileFocusPanel.tsx` is a tab (`DayPlanner.tsx:807-814`), not
  an overlay. Running state 93-227 (`data-testid="mobile-focus-running"`): Discard, Pause or
  Resume, Finish early. **No exit control**; you leave by tapping another tab. `mobileTab`
  state at `DayPlanner.tsx:139`.
- Tests: `e2e/crawl.spec.ts:341-345` and `e2e/work-safety.spec.ts:134-140` leave by Escape.
  Nothing clicks "Leave focus". Phone: `e2e/mobile-redesign.spec.ts:171-`,
  `e2e/mobile-panels.spec.ts:35,62,66`.
