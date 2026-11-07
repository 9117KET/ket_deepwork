# Review 02, round 1 — APPROVE (scout check pending, `check-02-round1.md`)

Ran myself in the worktree: `npx tsc -b` clean; `npm test` 373 passed (the builder's 378 included the `useWorkLog` suite, which needs `VITE_CONVEX_URL`; the main tree run at integration will have it). Read `durations.ts` 38-59 (the rules read as the spec wrote them, plus the two sensible additions).

Open questions answered:
- Saving a valid typed length when the popover closes on an outside click: **accepted** (HIG; a tap elsewhere after typing "2h" should not throw the 2h away). The scout checks that an *invalid* text is dropped silently, not saved.
- A trailing h:mm needs a one-digit hour: **accepted**; "Standup 10:30" is a time.
- `day-completion.spec.ts` edits: accepted; spec 01 does not touch that file.

Integration notes: exclude `playwright.scratch02.config.ts` from the patch; `02_COMMON.md` step 4 gains the `VITE_CONVEX_URL` note for future runs; the e2e suite runs again on the integrated head (01 + 02 share two files).
