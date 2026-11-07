# Review 02, round 1 → FIX list for round 2 (from `check-02-round1.md`)

Round 1 was APPROVE pending the check; the check found one keyboard gap and four untested contract behaviours.

## FIX

1. Escape closes the popover whenever it is open, including when focus is on the chip (handle `keydown` Escape on the chip while `open`, or a document-level listener while open); no change is saved; focus ends on the chip.
2. `e2e/duration-chip.spec.ts` gains four cases: outside click with valid typed text saves it; outside click with invalid text closes and saves nothing (stored value unchanged); Tab away with valid text saves it and does not trap focus; the Top 3 add line ("Add a top priority…") with "Deep work 2h 30m" creates a Top 3 task titled "Deep work" with 150 minutes.
3. Delete `playwright.scratch02.config.ts` from the worktree once your run is done (or leave it and say so; the supervisor excludes it either way).

`npx tsc -b`, `npm run lint`, and `npx playwright test e2e/duration-chip.spec.ts --retries=0` green (use a scratch config on a free port as before, since builder 01 may be on 5173). Same worktree; touch only `DurationChip.tsx` and the e2e file.
