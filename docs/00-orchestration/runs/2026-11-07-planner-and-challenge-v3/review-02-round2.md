# Review 02, round 2 — APPROVE

Builder's round-2 report (filed as `report-02-round2.md`): the chip handles Escape while the popover is open (closes, saves nothing, focus stays on the chip); Tab at the popover's edges now lands on the page (Shift+Tab back to the chip, Tab forward to what follows the chip), saving a valid typed length — needed because the portalled popover sits at the end of `<body>`; five new e2e cases (outside click valid → 150 saved; outside click "soon" → stored 45 kept, chip "45m"; Tab forward "45" → saved, focus on the page; Shift+Tab "1:30" → 90 saved, focus on the chip; Escape from the chip → nothing saved; Top 3 add line "Deep work 2h 30m" → `mustDo` "Deep work" at 150); `playwright.scratch02.config.ts` deleted. `npx tsc -b` clean; `npm run lint` clean; `e2e/duration-chip.spec.ts --retries=0` 13 passed; `e2e/day-completion.spec.ts` 6 passed. Only `DurationChip.tsx` and the e2e file changed.

Note for integration: the Top 3 add-line case opens the add line through the "+ Add" header button; spec 01 did not change that button (its hunks are the grip and the phone handle), so no clash is expected; the integrated e2e run will tell.

Verdict: APPROVE. Rounds used: 2 of 3.
