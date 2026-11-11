# Report 04, round 1 (filed by the supervisor from the builder's final message)

Builder worktree branch: `worktree-agent-aaa38aae92f409347`. Nothing committed.

## What changed
- `src/components/planner/TaskItem.tsx`: phone row renders `DragHandle` first (`-mr-1`); new exported `PhoneHandleSpacer` (`aria-hidden`, `w-11 -mr-1`); progress wrapper `pl-11` → `pl-[92px]`; comments say "leading".
- `src/components/planner/MustDoPinnedHeader.tsx`: `renderPhoneRow` renders the handle first, or `PhoneHandleSpacer` when not draggable; progress wrapper `pl-[92px]`.
- `e2e/drag-handle-left.spec.ts` (new, 7 tests): phone 390 order and 44x44 for Tasks, Top 3, subtask; one line; progress bar within 1px of title; no-handle Top 3 row aligned; body swipe scrolls, checkbox swipe lifts nothing; 280px no overflow; desktop order.
- `e2e/drag-handle.spec.ts`: one locator changed. "the same quick gesture on the row body does not move it" used `getByRole('button', { name: /Tthree/ }).first()`, which now matches the leading handle ("Drag to move Tthree"); it now targets the title button. Assertion unchanged.
- `CLAUDE.md` "Responsive foundations": phone anatomy starts with the handle.

`useTouchReorder.ts` and `DragHandle.tsx` unchanged.

## Criteria (builder's evidence)
1 met (4 of 7 new tests fail with the components reverted). 2 met (desktop already handle-first). 3 met: rows that had the trailing handle gain 4px of title; Top 3 all-done rows give 40px to the spacer; progress bar 48px narrower. 4 met (was 4px off before). 5 met with the one locator change above. 6 met. 7 met via `PhoneHandleSpacer`.

## Commands
- lint: clean. `npx tsc -b`: exit 0. `npm test`: 401 passed. `npm run test:convex`: 193 passed. `npx vite build`: ok (chunk-size warning only).
- Playwright port 5194, `--retries=0`, 8 files: 96 passed, 1 failed (the locator above); after the fix `drag-handle.spec.ts` 10/10. The full 8-file set was not rerun after the fix.

## Design
`apple-design`: no findings (24px grip-to-checkbox spacing, `accessibility.md › Spacing`); leading position departs from the iOS trailing reorder convention, by the user's request. `web-design-guidelines`: no findings. `frontend-design` not loaded (reorder of existing controls).

## Open
No real-device test. Suggestion: the Top 3 all-done state could drop the spacer.
