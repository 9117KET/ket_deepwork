# Check 02, round 1 (scout, Mode B)

*Filed by the supervisor from the scout's final message. Checked `mobile-ux` at 534734a (the spec 02 merge) in a detached worktree, removed afterwards. No file edited. The branch moved on to 9374404 (spec 03's two-line fix and doc edits) after the check started; the supervisor re-runs the full suite on the final head.*

## Verification re-run
- `npm run lint` clean; `npx tsc -b` clean; `npx vite build` `✓ built in 4.49s` (579 kB chunk warning only).
- `npm test` 19 / 287 passed; `npm run test:convex` 7 / 96 passed.
- Playwright, all seven spec files named by the spec: `91 passed (1.4m)` (port 5173 free).

## Acceptance criteria
1. Met (`mobile-today.spec.ts:57`). 2. Met (`:78`). 3. Met (`:84`; remaining hover uses are fine-pointer only). 4. Met: `TaskActionSheet.tsx` rendered from `TaskItem.tsx:417` and `MustDoPinnedHeader.tsx:~306`; Top 3 phone rows via `renderPhoneRow(...,'menu')` (`:431`); test `:110`. 5. Met (check 1; test `:154`). 6. Met (`:119`). 7. Met (`:90`, `:190`). 8. Met (wider grep shows no sky/teal/violet in the four files). 9. Met: `z-[80]` on `TaskProgressSheet.tsx:100`, `ScheduleSheet.tsx:77`, `TaskActionSheet.tsx:156`, move picker `DayPlanner.tsx:883`; `toast-dock` on `UndoToast.tsx:24`, `CompletionClaimPrompt.tsx:72`, `DayPlanner.tsx:786,794`; test `:130`. 10. Met with a deviation: `?tab=` followed by render-time state adjustment (`DayPlanner.tsx:134-141`), not a `useEffect`; tested at `:198`. 11. Met. 12. Met (`:148`).

## Supervisor's five checks
1. Met: phone branch `if (isCoarse) {` early return at `TaskItem.tsx:314`; `draggable` (435), `onContextMenu` (448), `onDoubleClick` (506, 518), arrows (476, 483) below it; `MustDoPinnedHeader.tsx` phone rows via `renderPhoneRow` (431), desktop block `!isCoarse && <div…` (433) holding `draggable` (440), grip (456), arrows (467, 474) and the duration picker; `TaskActionSheet.tsx` has none. No duration `<select>` on phones.
2. Met: `TaskItem.tsx:462` after the early return; `MustDoPinnedHeader.tsx:373,523,534` desktop only.
3. Met: `TaskProgressSheet.tsx` diff is imports, the `useCoarsePointer` call, `TaskProgressBar` on phones, z-index/max-height/padding, title wrap, teal → primary, `touch:min-h-11`, caption 10 → 11px; no logging or undo line changed.
4. Grep hits: `AwayBlockClaim.tsx:42,45,47,50,61` (sky); `CalendarTimeline.tsx:80`, `DayPlanner.tsx:685,687,691` (error block), `ScheduleSheet.tsx:158`, `SectionColumn.tsx:212` (desktop drop target) (amber). `ChallengeCard.tsx` clean.
5. Met: sheet Delete → `onDelete` (`TaskActionSheet.tsx:152`) → `onDeleteTask` (`SectionColumn.tsx:255`) / `onDelete(task.id)` → `handleDeleteTaskGuarded` (`DayPlanner.tsx:448`, props 601 and 702), which prompts on loss and runs `undoable.run`; `work-safety.spec.ts` passes incl. "deleted task comes back with Undo".

## Findings, most serious first
1. Minor, out of spec scope: sky in `AwayBlockClaim.tsx:42-61`; amber in the planner files listed above.
2. Minor: `SectionColumn.tsx:212` amber drop-target highlight (desktop drag only).
3. Minor: `?tab=` via render-time adjustment rather than an effect; works and is tested.
4. Caveat: commits after 534734a not covered by this check.
