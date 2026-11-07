# Review 01, round 1 — FIX (one item; otherwise approved)

Read myself in the worktree: `DragHandle.tsx` (whole file), the `handleCopyFromDay` core (`useTaskHandlers.ts:460-490`: free-slot count from `TOP3_MAX`, duplicate keys judged in the landing section, `resetSchedule: true`), `e2e/drag-handle.spec.ts:184`. Ran myself: `npx tsc -b` clean; `npm test` passes.

Open questions answered:
- Keeping `durationMinutes` on a copy and clearing only `scheduledAt`: **accepted**. The length is the plan; the time was an event that does not exist for the copy. The spec's `resetTimes` was the wrong option name.
- A handle on subtask rows, phone included: **accepted**; the subtask rule (siblings only) is unchanged.
- Phone handle after the ⋮ on the trailing edge: accepted (iOS convention).

## FIX

1. `e2e/drag-handle.spec.ts:184` asserts a measured span `< 100` ms; it passed at 94 ms under four workers and will flake on a slower machine. Make the test deterministic: issue the gesture's moves within 100 ms of the pointerdown (that is the input the criterion describes), then assert only the outcome (the row moved, and the body gesture did not). Remove the wall-clock assertion.

Everything else: APPROVE pending the scout check (`check-01-round1.md`) and the integrated e2e run (01 and 02 share two files; `mobile-responsive.spec.ts` covers the 280 px row the builder asks about).
