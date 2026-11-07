# Plan: planner and challenge v3 (7 Nov 2026)

Supervisor: Fable 5.1 (main session). Base: `run/2026-11-05-solo-countdown` at `752119f` (8 commits ahead of `main` `a23ab7c`, not yet merged; builders start by merging that local branch into their worktree, see `02_COMMON.md`).

## What the user asked for, and what the code already has

| Ask | State at intake | Workstream |
|---|---|---|
| Drag and drop, "even within the Top 3" | Built 2 Nov and deployed (live bundle checked). Engine works in Chromium with a mouse (scout ran it). The user cannot find it: no visible handle, 300 ms hold on a phone, mouse path absent on coarse-pointer devices. Top 3 cap not enforced on drop. | 01 |
| "Fill from yesterday" for the Top 3 and the tasks | Exists for the list only; the Top 3 is filtered out on purpose (an old anti-template rule); keeps `scheduledAt` without an event; copies legacy logged minutes. | 01 |
| Duration "like the hours, as in the first version" | A select ladder exists (10m–8h) but is invisible until hover on desktop and lives in the schedule sheet on a phone. No version ever had free typing. User chose "Both": visible on every row, accepts typed hours and minutes. | 02 |
| Edit a challenge's range after creation | No mutation; only rename. | 03 backend, 04 client |
| Tick goals kept and cross don'ts broken each day, always visible | Don'ts broken only inside the check-in sheet; goals have no ids and no per-day state. | 03, 04 |
| Visual completion rate, time allocated weighing in | `computeDayCompletion` exists for the day gauge; the summary carries no minutes; the validator is strict. | 03, 04 |

## Workstreams

- **Spec 01 — Move a task, fill a day** (worktree; planner): a visible drag handle on every root row at every width; a touch drag that starts from the handle at once; the Top 3 cap of 3 enforced on drop; "Fill from yesterday" copies the Top 3 into empty Top 3 slots and the list, unticked, times reset, legacy logged minutes dropped. e2e gates for all of it.
- **Spec 02 — Duration on every row** (worktree; planner): `parseDurationInput` in `durations.ts`; a `DurationChip` always visible on every row (desktop) opening a popover with a typed field and the ladder; the same typed field in `ScheduleSheet` (phone); a trailing unit token in the add-task line sets the duration. Unit tests and e2e.
- **Spec 03 — Challenge backend** (worktree; convex only): `updateSpan` (creator, active, guarded), goals with ids (legacy strings normalised), `markDay`, `goalsKept` on days and in both day views, `checkIn` accepting `goalsKept`, optional `plannedMinutes`/`doneMinutes` on the summary. convex-test coverage.
- **Spec 04 — Challenge client** (worktree; src only): Edit dates sheet; commitments with ✓ and ✕ toggles on the Today surface and in the check-in sheet; partner marks in `MemberRow`; the summary builder sends planned and done minutes; per-day percentage in `MemberRow`, season percentage in head to head.

Dependencies: 04 consumes 03 through the contract in `02_COMMON.md` (shapes fixed up front, precedent 2 Nov run). 01 and 02 both edit `TaskItem.tsx` and `MustDoPinnedHeader.tsx` in different hunks (01: grip and drag; 02: the duration chip); each routes new tests into its own files; the supervisor merges. 03 and 04 share `convex/_shared/challengeValidators.ts` types only through the contract; 04 does not edit `convex/`.

## Out of scope (this run)

- Reordering goals, extending an ended season, carry-forward of unfinished tasks only, a season percentage in the `SeasonGrid` cells, weekly completion on `/review`. Proposed to the user in `99_SUMMARY.md`.
- Deploying, pushing, committing. The backend (spec 03) must be deployed before `main` is pushed.

## Agents

| Spec | Agent | Worktree | Rounds |
|---|---|---|---|
| 01 | builder-01, worktree `agent-ab9edc63d9abae73c` | yes | 3 (timing test; register + no-op fill + sheet test) → APPROVE |
| 02 | builder-02, worktree `agent-aed4a71d5e2743845` | yes | 2 (Escape from the chip + e2e gaps) → APPROVE |
| 03 | builder-03, worktree `agent-a7e4d3cbadd913359` | yes | 2 (contract amended: `goalItems`) → APPROVE |
| 04 | builder-04, worktree `agent-a4a05e1e13db12b16` | yes | 3 (`keptLine`; labels + Enter + field) → APPROVE |

Integration: `.claude/worktrees/int-2026-11-07`, branch `run/2026-11-07-planner-and-challenge-v3` from `origin/main`; patches applied 03 → 04 → 02 → 01 with `git add -A` after each; one hand-merge (`TaskItem.tsx` header comment). Full suites green on that head; see `99_SUMMARY.md`.

Scouts: `scout-planner.md` (DnD, duration, fill), `scout-challenge.md` (span, commitments, completion).

## Checks

SCOUT_CHECK applies to all four (tests and user-facing text). A signed-in two-account browser pass cannot run in e2e; the summary lists it as the human's step, as in the 5 Nov run.
