# Report: spec 02, a duration on every row (round 1) — filed by the supervisor from the builder's final message

**Worktree:** `.claude\worktrees\agent-aed4a71d5e2743845`. Uncommitted; only `git rm TaskDurationPicker.tsx` is staged. Setup: merge "Already up to date" (`3ea502e`); `node_modules` junction.

## Done
Every desktop root row shows a duration chip without hover ("Time" dim when unset); click opens an anchored popover (portalled, `role="dialog"` "How long", `#root` not inert, nothing trapped; field focused on open; focus returns to the chip after a choice or Escape; Escape changes nothing; outside click or tabbing away closes and keeps a valid typed length, per HIG › Popovers; React events stopped from reaching the row's drag/menu handlers). Phone chip reads "Time" when unset and opens the schedule sheet, which gains the same typed field above the ladder (same parser and error line; a valid length selects the matching pill; Enter or "Save length" saves; pills use `formatMinutes` in `role="group" aria-label="Pick a length"`). `AddTaskInput`: `onAdd(title, options?: AddTaskOptions)`, trailing length split off; threaded through `SectionColumn`, `DayPlanner`, `useTaskHandlers.handleAddTask`, `MustDoPinnedHeader.handleAdd`. `TaskDurationPicker.tsx` deleted; nothing imports it.

`durations.ts`: `parseDurationInput`, `extractTrailingDuration`, rules in the file comment; two choices beyond the spec: a trailing pair "2h 30m" is one length; a trailing h:mm is split only with a one-digit hour ("Standup 10:30" stays a title).

Shared-file lines: `TaskItem.tsx` 15-16, 24, 374-388, 451-457, 642-645 (`hidden sm:block` removed); `MustDoPinnedHeader.tsx` 24-26, 44, 279-281, 308-321, 374-380, 493-496, 652-655. No grip/drag/pointer/Move lines touched.

Tests: `durations.test.ts` (new); `e2e/duration-chip.spec.ts` (8: 7 desktop, 1 phone); `e2e/day-completion.spec.ts` rewritten for the chip (old test pinned the hidden `<select>`) and its phone sheet selector fixed (broken since `37e989f`, `label` → fieldset). CLAUDE.md item 7 updated.

## Verification (builder)
`npx tsc -b` clean; `npm run lint` clean; `npm test` 378 passed with `VITE_CONVEX_URL` set (without it `useWorkLog.test.ts` fails to load); `npx vite build` ok; Playwright: duration-chip + day-completion + minimal-today + mobile-today 35 passed; extra regression (touch-reorder, mobile-responsive, mobile-panels, mobile-redesign, work-safety) 65 passed — all through an uncommitted `playwright.scratch02.config.ts` on port 5182 reading the main tree's `.env` (**delete before merging**). web-design-guidelines: fixed the sheet's submit being disabled while empty; kept: contract placeholder without "…", popover autofocus (desktop only), sentence case.

## Open questions
Saving a valid typed length on outside click; one-digit-hour rule for a trailing h:mm.

## Known gaps
No screenshots; no e2e for the Top 3 add line taking a length (same function); `useWorkLog.test.ts` needs `VITE_CONVEX_URL` in a worktree.

## Suggestions
Add `VITE_CONVEX_URL` to `02_COMMON.md` step 4; the `day-completion.spec.ts` edit is outside the listed deliverables, check for collisions.
