# Report: spec 02, round 2 — filed by the supervisor from the builder's final message

All three fixes done; `npx tsc -b` and `npm run lint` clean; `e2e/duration-chip.spec.ts --retries=0` 13/13; `e2e/day-completion.spec.ts` 6 passed (re-run because the popover's keyboard handling changed). Only `src/components/planner/DurationChip.tsx` and `e2e/duration-chip.spec.ts` touched; nothing committed.

1. The chip handles Escape while the popover is open: closes, saves nothing, focus on the chip. Also: Tab at the popover's edges — Shift+Tab off the field returns to the chip; Tab off the last control goes to what follows the chip; a valid typed length is saved either way. Needed for "does not trap focus", since the portalled popover sits at the end of `<body>`.
2. Five new e2e cases: outside click with "2h 30m" saves 150; outside click with "soon" closes, stored 45 kept, chip "45m"; Tab forward with "45" saves 45, focus on the page; Shift+Tab with "1:30" saves 90, focus on the chip; Escape from the chip saves nothing; Top 3 add line ("+ Add" → "Add a top priority for today…") with "Deep work 2h 30m" → `mustDo` "Deep work" at 150 (if spec 01 changes that button, the first step may need updating).
3. `playwright.scratch02.config.ts` deleted after the runs (it used port 5182 and the main tree's `VITE_CONVEX_URL`).
