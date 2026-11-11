# Spec 05: a clear button to leave Focus mode

*Run:* `docs/00-orchestration/runs/2026-11-11-group-reopen-handle-focus/` · *Builder:* builder ·
*Worktree:* yes · *Playwright port:* 5195 · *Time box:* 60 minutes of agent work

## Goal

Someone in Focus mode can see at a glance how to get out, on a desktop and on a phone, without
knowing about Esc or the tab bar, and leaving never costs them the running block.

Today: on a desktop the exit is a dim text link "Leave focus" (70% opacity, no border) and
Esc; on a phone the running Focus panel has no exit control at all.

## Inputs (read all of these first)

- `02_COMMON.md` (run folder): setup, rules, checks, report.
- `scout-planner-ui.md` (run folder), part B.
- `docs/data-safety.md`: worked minutes are sacred. Leaving Focus is not stopping the block.
- `src/components/timer/FocusMode.tsx`, `src/components/timer/MobileFocusPanel.tsx`,
  `src/components/planner/DayPlanner.tsx` (the `focusDismissed` and `mobileTab` state and the
  two render sites), `src/components/ui/TextButton.tsx`.
- `e2e/work-safety.spec.ts` (`seed()` puts a block mid-run without waiting),
  `e2e/mobile-panels.spec.ts`, `e2e/mobile-redesign.spec.ts`, `e2e/helpers/mobile.ts`.
- Skills: `apple-design`, `frontend-design`, `web-design-guidelines`.

## Deliverables

- `src/components/timer/FocusMode.tsx`: the exit is a clearly visible button.
- `src/components/timer/MobileFocusPanel.tsx` and the one prop it needs from `DayPlanner.tsx`:
  an exit button in the running state.
- A way back in on a desktop (see criterion 5).
- A new e2e file `e2e/focus-exit.spec.ts`.

## Acceptance criteria

1. Desktop, block running: Focus mode shows a button named "Exit focus" that reads as a button
   at rest (a visible border or fill, text at full contrast against its background, at least
   4.5:1), in the top-left where the old link was. Clicking it hides Focus mode and shows the
   planner.
2. After clicking it the block is still running: the sidebar timer shows the countdown still
   going, and no session was recorded or discarded. The same when the block was paused: it
   stays paused.
3. Esc still leaves Focus mode, and still cancels the discard confirmation first when that is
   open. The footer hint stays true.
4. Phone (coarse pointer, 390px), block running, Focus tab open: an "Exit focus" button of at
   least 44x44 is visible without scrolling. Tapping it shows the Today tab with the block
   still running. It is not placed where a thumb reaching for Pause, Discard or Finish early
   could hit it by mistake, and it is not confusable with Discard: it never stops, discards or
   finishes the block.
5. Desktop, after leaving Focus while the block still runs: the timer card in the sidebar
   offers a "Back to focus" control that brings Focus mode back. (Today there is no way back
   until the next block.) It is absent when no block is running.
6. No existing test is weakened; `e2e/work-safety.spec.ts`, `e2e/crawl.spec.ts`,
   `e2e/mobile-panels.spec.ts`, `e2e/mobile-redesign.spec.ts` and `e2e/mobile-responsive.spec.ts`
   pass.
7. The new e2e file covers criteria 1, 2 (running and paused), 3, 4 and 5.

## Constraints

- Do not change what Stop, Discard, Finish early or Pause do, the timer hook's state machine,
  or `src/storage/activeBlock.ts`.
- In `DayPlanner.tsx` touch only the Focus render sites and the state they need. Do not touch
  task rows, `TaskItem.tsx`, `MustDoPinnedHeader.tsx`, anything under `convex/` or
  `src/components/challenge/` (other builders own them).
- Colours come from the existing tokens where one fits; say in the report where you used a raw
  value and why.

## Out of scope

- A keyboard shortcut to enter Focus, a Focus overlay on the phone, any redesign of the timer.

## Verification the builder must run

The checks in `02_COMMON.md`, plus Playwright on port 5195 for the five files in criterion 6
and the new file.

## Report to

Your final message; the supervisor files it as `report-05-round1.md`.
