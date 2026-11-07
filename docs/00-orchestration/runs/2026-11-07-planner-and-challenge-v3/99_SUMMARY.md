# Summary: planner and challenge v3 (7 Nov 2026)

Supervisor Fable 5.1; 4 Opus builders in worktrees; 6 Sonnet scouts (2 research, 4 checks). Rounds: spec 01 → 3, spec 02 → 2, spec 03 → 2, spec 04 → 3. Nothing committed, pushed or deployed by the loop.

## Where the result is

Integration worktree `.claude/worktrees/int-2026-11-07`, branch **`run/2026-11-07-planner-and-challenge-v3`** (from `origin/main` `3ea502e`), all four patches applied and **staged, not committed**: 43 files, +3,473 / −578. One hand-merge: the header comment of `TaskItem.tsx` (specs 01 and 02 rewrote adjacent lines). Patches kept as `patch-0N.diff` in this folder.

Verified on that head by the supervisor: `npx tsc -b` clean · `npm run lint` clean · `npm test` 26 files / **401** passed · `npm run test:convex` 16 files / **193** passed · `npx playwright test --retries=0` **183 passed** (1.7 min) · `npx vite build` built (the pre-existing chunk-size warning).

## What was built and approved

**Spec 01 — move a task, fill a day** (`review-01-round3.md`, APPROVE)
- `src/components/planner/DragHandle.tsx`: one drag handle on every root row, both lists, every width, both pointers ("Drag to move <title>", 44 px on a coarse pointer, `cursor-grab`). Replaces the 14 px / 40 % / hidden-below-`sm` grip that made Move up / down look like the only way.
- `src/hooks/useTouchReorder.ts`: a finger on the handle lifts the row at once (the 300 ms hold stays for the row body, so swiping still scrolls); a mouse or pen on the handle drags on a coarse-pointer device too (a touch laptop can now drag).
- Top 3 cap of 3 enforced on every path (mouse drop, finger drop, ⋮ sheet and grip menu "Move to Top 3"; `wouldOverfillTop3` in `taskUtils.ts`) with the toast "Top 3 is full. Move one out first."
- "Fill from yesterday" (`planCopyFromDay` in `useTaskHandlers.ts`, `cloneTasksForDay` in `taskUtils.ts`): copies yesterday's Top 3 into today's free Top 3 slots (leftovers to Tasks) and the list, subtasks with their root, all unticked, `scheduledAt` cleared (no event exists for a copy), legacy `manualLoggedMinutes` dropped, planned lengths kept; never touches `deepWorkSessions`; offered only when something new would land, so no empty Undo. `docs/data-safety.md` row 9b records it.
- Tests: `e2e/drag-handle.spec.ts` (10), `e2e/fill-from-yesterday.spec.ts` (4), `taskUtils.test.ts`; `e2e/copy-from-day.spec.ts` removed (it pinned the old keep-`scheduledAt` behaviour). `CLAUDE.md` rule 1 rewritten.

**Spec 02 — a duration on every row, typed or picked** (`review-02-round2.md`, APPROVE)
- `src/domain/durations.ts`: `parseDurationInput` ("2h", "2h 30m", "1.5h", "90m", "1:30", "45"; a bare integer ≥ 10 is minutes, below 10 or with a decimal is hours; null for 0, > 24 h or nonsense) and `extractTrailingDuration` (only a trailing token with a unit or a one-digit-hour h:mm, so "Call 911" and "Standup 10:30" stay titles; "2h" alone is not a task).
- `src/components/planner/DurationChip.tsx` (replaces `TaskDurationPicker.tsx`): a chip on every desktop row without hover — "Time" dim when unset, the length when set — opening an anchored popover (`role="dialog"`, `#root` not inert, no focus trap) with a typed field, the ladder as pills, Clear; Enter saves, Escape closes without change (from the field or the chip), outside click or Tab away saves a valid typed length and drops an invalid one.
- `ScheduleSheet.tsx`: the same typed field above the ladder on a phone; the phone row chip now reads "Time" when unset.
- `AddTaskInput.tsx` + `handleAddTask` + `MustDoPinnedHeader.handleAdd`: "Write report 2h" creates "Write report" with 2h, in both add lines.
- Tests: `durations.test.ts` (all spec examples), `e2e/duration-chip.spec.ts` (13), `e2e/day-completion.spec.ts` rewritten for the chip (and a selector broken since `37e989f` fixed). `CLAUDE.md` item 7 updated.

**Spec 03 — challenge backend** (`review-03-round2.md`, APPROVE; `check-03-round2.md` no break)
- `updateSpan({challengeId, startDate, endDate, planDeadline?, checkinDeadline?})`: creator only, active only; shared `assertSpan` with `createChallenge`; the end may not be before any member's local today; the start may not move past the first recorded lock-in or check-in ("The start can't move past 24 Oct, when…"); day rows never touched.
- Goals get ids: `challengeMembers.goals` is a union of legacy strings and `{id, text, archivedAt?}`; `normalizeGoals` gives legacy strings `goal-legacy-<i>`; `updateMyCommitments` accepts strings or `{id?, text}`, keeps ids, archives removed goals, mints new ones. **`memberView.goals` stays `string[]`** (the live client keeps rendering through the deploy window) and `memberView.goalItems: Commitment[]` carries the ids — the contract was amended after builder 03 showed the original shape change would crash the live dashboard.
- `markDay({challengeId, date, goalsKept?, dontsBroken?})`: today or yesterday on the member's clock, ids validated, patches only the lists given, never the summary, the acts, the note or the reminders; **not** one of the two daily acts (inactivity unchanged). `checkIn` accepts optional `goalsKept`. `dayView`/`myDayView` gain `goalsKept` (ids only).
- `summaryValidator` gains optional `plannedMinutes` and `doneMinutes`.
- `convex/challengeEdits.test.ts` (13 tests, every criterion); CLAUDE.md "Editing the dates" and "Daily marks".

**Spec 04 — challenge client** (`review-04-round3.md`, APPROVE; `check-04-round1.md`)
- `ChallengeDetail.tsx`: "Edit dates" beside Rename (creator, running) → "Dates and deadlines" sheet (Starts, Ends, Plan by, Check in by, "Save dates"; client pre-validation names the right field, Enter saves, server sentence in `ErrorLine`). "Today's commitments" under your row while the season runs: a circle ✓ per goal (kept today), a square ✕ per don't (broke today), 44 px `aria-pressed` toggles, optimistic with rollback, one kind per `markDay` call. Head to head gains "Planned time done" (season, duration-weighted: minutes done of minutes planned over reached days) and the note explaining it.
- `MemberRow.tsx`: "64% of planned time" with a thin `role="meter"` and "Kept 2 of 3 goals" for you and your partner; "Broke:" shows as soon as a don't is marked; "Kept all don'ts" only after a check-in with active don'ts (an archived-don'ts bug fixed on the way).
- `CheckinSheet.tsx`: "Which goals did you keep today?" above the don'ts. `CommitmentsSheet` edits goals with stable ids.
- `src/domain/challenge.ts`: the summary carries `plannedMinutes`/`doneMinutes` from `computeDayCompletion` (private tasks included as minutes, never titled); `dayCompletionPercent`, `seasonCompletion`. `challengeCommitments.ts`: `Commitment`, `goalItemsOf`, `keptLine` (denominator = active goals + archived goals kept that day, so it never reads "2 of 1" and never claims every goal kept). `challengeList.ts`: `seasonStepError` split into dates and deadlines.
- `challengeService.ts`: `updateSpan`, `markDay`, `checkIn({goalsKept})`, goals sent with ids; one `contractApi` type assertion marked `// contract: spec 03` to drop after codegen.

## What is still open, and why

1. **Deploy order is a hard rule here.** `buildChallengeSummary` now always sends `plannedMinutes`/`doneMinutes`, and the backend's validator is strict: a client shipped before the backend fails every lock-in, check-in and summary sync. **Backend first** (`npx convex deploy` from your own terminal, as on 5 Nov), **then** push `main`. The reverse order is the 2026 sync-outage shape.
2. **Regenerate the Convex types and drop the assertion.** After `npx convex dev` (or `codegen`) refreshes `convex/_generated/api.d.ts`, remove the `contractApi` block in `src/services/challengeService.ts` and call `api.challenges.updateSpan` / `markDay` directly. It compiles and runs as is; the assertion is only a type shim.
3. **A signed-in browser pass was not possible** (guest-only e2e, no two-account fixture; same as the 5 Nov run). The new dashboard surfaces — Edit dates, Today's commitments, the meter, the head-to-head column — are checked by types, lint, 73 domain tests and the scout's read, not by eyes. Suggested: open a running challenge on dev with both accounts and tick a goal, cross a don't, edit the dates, and watch the partner's row.
4. **Follow-up from round 3 of spec 04:** `ChallengeCreatePage` still maps a blank *start* date error to its end-date slot (that page was out of scope); give it a start slot too (small).
5. Accepted low findings, recorded not fixed: a start moved past a mark-only day (no lock-in or check-in) hides that row from `history` (acts only count as "recorded"); `updateSpan`'s first-recorded-row walk may pass unstamped rows (bounded by a season per member); an old client saving goals before the new client ships churns goal ids (archived, never deleted; marks still resolve); a desktop with a fine primary pointer plus a touchscreen still cannot finger-drag (HTML5 path, as before); the fill copies direct children only (subtasks are one level deep).

## Decisions taken in the run (overrule any of them)

See `00_BRAIN_DUMP.md` "Decisions taken during the run" (8 items) plus: a goal tick is not a daily act for inactivity; the completion percentage includes private tasks as minutes (a partner can infer private minutes, never titles — the same rule as "N private"); planned lengths survive a fill, times do not; the commitments block sits after the next-act button so the first screen stays row, one button, partner row; "Planned time done" is a head-to-head column.

## Proposals: what a user is likely to ask for next

Things the run deliberately left out that fit the app's aim (a private planner, a public record of two daily acts, worked minutes sacred). None is started; say which you want.

1. **"Bring over what's left"** — a second fill variant copying only yesterday's unticked tasks. The June 2026 removal called carry-forward anti-procrastination, so this stays opt-in. Small: `planCopyFromDay` already takes the source list.
2. **Goal and don't marks on Today (`/`)** — the toggles live on the dashboard only; the Today block could show them under each running challenge's row, one tap away from the plan. Medium.
3. **Completion in the season grid** — a fifth, shape-safe channel per cell (a ring segment for planned time done), so the grid shows effort, not only acts. Medium; design review needed.
4. **Weekly planned-time-done on `/review`** — the same `seasonCompletion` over the last 7 days next to the deep-work goal. Small.
5. **Reopen or extend an ended season** — `updateSpan` refuses ended challenges by design; a creator-only "Extend" on a `seasonOver` challenge would need the status flipped back and reminders re-armed. Medium; decide whether a finished season should ever reopen.
6. **Reorder goals and don'ts** — ids make it possible now; the editor has no ▲▼. Small.
7. **An "unestimated" nudge** — the gauge counts a task with no length as 30 m; a quiet "3 tasks have no length" line under the Top 3 would make the new chip pay off. Small.

## Run records

`00_BRAIN_DUMP.md`, `01_PLAN.md`, `02_COMMON.md` (contract, amended twice), `scout-planner.md`, `scout-challenge.md`, `spec-01…04`, `report-NN-roundK.md`, `review-NN-roundK.md`, `check-NN-roundK.md`, `patch-0N.diff`.
