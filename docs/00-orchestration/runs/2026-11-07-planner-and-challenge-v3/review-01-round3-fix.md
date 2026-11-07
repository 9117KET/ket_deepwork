# Review 01, round 2 → FIX list for round 3 (from `check-01-round1.md`)

Round 2 was APPROVE on the timing item; the scout check found three small gaps worth one last round.

## FIX

1. `docs/data-safety.md` (the register of actions that can touch recorded work): update the "copy from day" entries (around lines 43 and 53) to the new behaviour — the fill copies Top 3 and list roots unticked, clears `scheduledAt`, drops `manualLoggedMinutes`, never touches `deepWorkSessions`; name the guard (`cloneTasksForDay`) and the gate (`e2e/fill-from-yesterday.spec.ts`).
2. A fill where nothing is new must not push an empty undo entry: either `copySource` is null when every source root is already present today (so the button does not render), or the click shows the status toast "Nothing new to copy" and records no undo. Pin with one e2e case.
3. Criterion 3 asked for the sheet path: add an e2e case where the ⋮ sheet's "Move to Top 3" on a full Top 3 shows "Top 3 is full. Move one out first." and the Top 3 keeps 3 (phone viewport, `PHONE` fixture).

`npx tsc -b`, `npm run lint`, `npx playwright test e2e/fill-from-yesterday.spec.ts e2e/drag-handle.spec.ts --retries=0` green. Same worktree; touch only `docs/data-safety.md`, `DayPlanner.tsx` or `useTaskHandlers.ts` (for item 2), and the two e2e files.
