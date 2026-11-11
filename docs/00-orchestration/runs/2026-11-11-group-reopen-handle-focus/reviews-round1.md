# Reviews, round 1 (supervisor read every `src/` diff for 04, 05, 06)

Supervisor note: the user switched the session to Opus 5.5 mid-run and then said "All findings adjusted and fixed" (2026-11-11). Read as: continue, fix every finding, and accept the recommendation to measure `updateSpan`'s 366-day cap from the latest reopen. The loop continues with Opus as supervisor; recorded here as a departure from the skill's SUPERVISOR knob.

## 04 drag handle left: APPROVE
Diff matches the report. Handle first on phone rows; `PhoneHandleSpacer` keeps titles in one column; progress bar `pl-[92px]` measured. The one test locator change keeps the assertion. `useTouchReorder`/`DragHandle` untouched. Integration run will cover the full 8-file set that was not rerun after the locator fix.

## 05 Focus exit: APPROVE
"Exit focus" only calls `onLeave` / `setMobileTab("today")`; "Back to focus" only `setFocusDismissed(false)`, passed only while `timerRunning && focusDismissed`. Nothing touches the block. Tokens only. `DeepWorkTimer.tsx` was outside the list but is the right home for criterion 5: accepted. CLAUDE.md line on Exit/Back to focus: add at integration.

## 06 sweep fixes: APPROVE round 1, round 2 sent
Stored day is `blockDayIso(startedAt, …)` everywhere, UTC fallbacks gone, claims from old records re-derived from the start instant; `titleFromPrompt` returns null on cancel or blank. Round 2 (the user asked for every finding fixed):
1. A block keeps the task it was worked against when the planner is paged to another day mid-block, whether it lands live or is claimed later; the `test.fixme` in `e2e/away-block-day.spec.ts` becomes a passing test.

## 01 group backend: FIX (round 2)
Read the report and the list of changed files; a scout check (Mode B) runs on the worktree for privacy, data loss and the live-client contract.
1. `updateSpan` measures the 366-day cap from `reopenedDate` when the challenge has been reopened (from the start otherwise), so a reopened season whose end lies more than 366 days past the original start can still have its dates and deadlines edited; it still refuses an end more than 366 days after the reopen day. Tests for both.
2. A test for the group nudge refusal when the target has no email address.
3. Then: the scout check's findings, if any, in the same round.

Patch of round 1 exported: `patch-01-round1.patch` (21 files, `convex/`, `CLAUDE.md`, `docs/DEPLOYMENT.md`), for spec 02's builder to apply.

## 01, rounds 2 and 3: APPROVE
Round 2: `updateSpan` cap from `reopenedDate` ("A season runs at most 366 days from the day it was reopened"); group no-email nudge test. Round 3 (scout check `a98ca…`, no High): `invitePreview` returns `notFound` for a former member's link and names nobody (supervisor read `challenges.ts:748-772`); `acceptInvite` refuses it ("This invite link is no longer valid", `:990`); `openInvite` skips invites from non-active makers (the builder found `createInvite` handing back a dead token); successor gets `[]` lists on hand-over; 64-row bound says "This challenge cannot take new members" (`:1012`). Convex suite 245 passed three runs in a row. Known limits recorded in CLAUDE.md. Final patch: `patch-01-final.patch`.
