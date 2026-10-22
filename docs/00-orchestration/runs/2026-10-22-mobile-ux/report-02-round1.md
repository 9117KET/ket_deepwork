# Report 02, round 1: Today on a phone

*Filed by the supervisor from the builder's final message. Branch `worktree-agent-a99d740f54a18a71d`, commit `a871408`, one commit on top of `mobile-ux` @ 3292f00 (worktree fast-forwarded from `main` first; clean). `.env` copies untracked.*

## Done
On a coarse pointer every Today row (list and Top 3) has four parts: a 24px checkbox in a 44x44 hit area; a 15px title clamped to two lines by CSS; one 32px chip (schedule time, else duration); a 44x44 ⋮ opening the new `TaskActionSheet` (48px rows with icon and label, full title in the header, Delete last in red through the existing undoable delete). Under each trackable task one full-width 44px button holds an 8px segmented bar and a caption ("45m / 1h30") and opens `TaskProgressSheet`. The phone branch never renders arrows, grip, duration `<select>`, `draggable`, `onContextMenu` or `onDoubleClick`. Fine pointer: desktop row, popup menu (now `z-[70]`), hover affordances and drag unchanged apart from tokens.
Other: Top 3 header `.overline` "Top 3", primary/hairline pips, 12px percent; section header one 44px button; add field 48px; date `.page-title`, stepper drops its capsule on touch; progress sheet and move-subtask picker `z-[80]` with `pb-safe-nav` and 44px controls; `blockNotice`/`doneOffer` on `.toast-dock` with 44px buttons; `?tab=` followed after mount; tab-bar spacer `calc(4.5rem + env(safe-area-inset-bottom))` (bar is 68px, old `h-16` was 64); ChallengeCard in the quoted-card shape in three lines.

## Files
- `src/components/planner/TaskActionSheet.tsx` (new): `z-[80]`, backdrop/Escape close, drag handle, `pb-safe-nav`, `max-h-[85dvh]`; portalled to `body` (the Top 3 card had a backdrop filter that would trap a fixed child); rows `role="menuitem"` (spec 01's undo-toast test still passes).
- `src/components/planner/TouchCheckbox.tsx` (new, not in the list): stretches a native checkbox to 44x44, transparent, with a drawn 24px box; still a real checkbox for keyboard, screen readers and `getByRole('checkbox')`; needed because `undersizedTouchTargets` measures `input[type=checkbox]`.
- `TaskItem.tsx`: phone branch on `useCoarsePointer()`; desktop untouched; menu `z-[70]`; sky/amber → tokens; subtask rail `border-share-hairline`; `data-task-id` on the phone row.
- `MustDoPinnedHeader.tsx`: same anatomy and sheet for Top 3; rank as a 12px dim prefix; overline header, pips, 12px percent, 44px "+ Add"; all-done banner keeps emerald with a visible 44px Remove on phones; Eye/Remove in the sheet on phones; new optional `onAbandon`; stale "sticky" comment rewritten; desktop card lost leftover `backdrop-blur-sm`/`/95`, now `rounded-2xl`.
- `TaskProgressBoxes.tsx`: new export `TaskProgressBar` (button or readout); desktop chips teal/sky → primary, amber → tertiary.
- `SectionColumn.tsx`: header one 44px button under the row (`h3` kept outside for the existing specs); name 15px, summary 12px dim, overload badge tertiary 11px.
- `AddTaskInput.tsx`: `min-h-12 rounded-xl`, placeholder `onSurfaceDim`.
- `DayHeader.tsx`: `.page-title`; `touch:border-0 touch:bg-transparent touch:p-0` stepper; flame on tertiary; challenge pill 12px with a 44px hit box on touch.
- `TaskProgressSheet.tsx`: `z-[80] max-h-[85dvh] overflow-y-auto pb-safe-nav`; 44px close; full title; 44px inputs/mode toggles/Log on touch; "fills faded" 11px; teal → primary; phones show `TaskProgressBar`; logging/undo untouched.
- `SessionAttributionPanel.tsx`, `BlockAmountPicker.tsx`: `touch:min-h-11`, caption contrast, amber → tertiary.
- `DayPlanner.tsx`: toasts, picker, `?tab=` sync (adjusted during render), spacer, `onAbandon` to Top 3.
- `src/components/challenge/ChallengeCard.tsx`: `bg-share-surfaceContainerLow border-l-2 border-share-primary`; line 1 name, day, today's status; line 2 act pair `min-h-11 flex-1`; line 3 partner + Nudge; emerald/red → primary/tertiary; "Edit" → "Edit check-in".
- `e2e/mobile-today.spec.ts` (new): 11 tests, 10(a)–(j) plus `?tab=habits` while mounted.
- `CLAUDE.md`: one sentence in Deep Work item 6 describes `TaskProgressBar`.

## Verification (in the worktree; e2e via a scratch config on port 5247, `reuseExistingServer: false`, otherwise identical to the repo's)
- `npm run lint` clean; `npx tsc -b` exit 0; `npx vite build` `✓ built in 2.49s`.
- `npm test` 19/287 passed; `npm run test:convex` 7/96 passed.
- `npx playwright test e2e/mobile-today.spec.ts e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts e2e/work-safety.spec.ts e2e/completion-claim-blocks.spec.ts e2e/session-attribution.spec.ts --reporter=line` → `89 passed (1.7m)`, no retries.
- Criterion 3 grep: four hover hits remain (TaskItem.tsx:443, MustDoPinnedHeader.tsx:367, :517, :528), each in the desktop branch under a "Fine pointer only" comment. Criterion 8 grep empty; emerald only on the all-done banner. Today with the rich seed is 989px tall at 390x844 (gate 1,800).
- Screenshots (viewport shots; a full-page capture drops touch emulation and shows desktop rows): scratchpad `b02/390-today-top.png`, `390-today-bottom.png`, `390-sheet.png`, `390-progress.png`; `390-today-full.png` kept as evidence of the full-page problem. Viewed by the builder and the supervisor.

## Open questions
- Segments per block, not per 30 minutes: `computeTaskProgress` builds one slot per block (`blockMinutes`, default 45) and the desktop chips draw one per block; the bar follows the same slots so bar, chips and sheet agree.
- All-done Top 3 rows on phones: visible 44px Remove in place of the ⋮.
- Subtask duration on a phone: the phone row has no picker and the sheet's Schedule… is root-only, so a subtask's duration cannot be set by touch (before, phones showed the bare `<select>`). Options: allow the schedule sheet for subtasks; add a "Set duration…" action.
- Title tap: plain text on phones; editing is "Edit title" in the sheet; the Top 3 click-to-edit is desktop only.

## Known gaps
- Criterion 11 ran through the private-port config rather than the repo config (5173 may be held by another worktree).
- `ChallengeCard` and the challenge pill are not e2e-covered (need a signed-in user with an active challenge).
- Four toasts share `.toast-dock` and still overlap when two show at once (pre-existing).

## Suggestions
- `docs/design/README.md` and the header of `mobile-redesign.spec.ts` still describe a NOW card.
- Phone specs needing a full-page shot should take scrolled viewport shots; full-page capture silently drops touch emulation.
- `playwright.config.ts` reuses any server on 5173; a `PW_PORT` override would make parallel worktrees safe.
