# Common rules and the contract for this run

Every spec in this run points here. Read it before the spec.

## Setup in a worktree

1. The harness makes your worktree from `main` (`a23ab7c`). The work of this run builds on the unmerged local branch `run/2026-11-05-solo-countdown` (`752119f`: solo challenges, the countdown, the calendar callback timeout). **Your first command in the worktree is `git merge run/2026-11-05-solo-countdown`** (fast-forward, no conflict expected). Say in your report that you did it and what `git log --oneline -1` printed.
2. The run folder lives only in the main tree: `C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-07-planner-and-challenge-v3\`. Read specs and scout files from there by absolute path.
3. Do not `npm install`. Link the main tree's `node_modules` as a junction from your worktree root:
   ```
   cmd /c mklink /J node_modules C:\Users\kinlo\code\personal\ket_deepwork\node_modules
   ```
   Never commit it; it is gitignored.
4. No `.env` in a worktree. **Added 7 Nov:** copy the main tree's `.env` into the worktree (gitignored) before `npm test` or Playwright: `src/hooks/useWorkLog.test.ts` and the Vite app both fail with "Provided address was not an absolute URL" without `VITE_CONVEX_URL`. Convex tests do not need it. Do not start `npx convex dev`. If port 5173 is busy, another builder's Playwright is using it: set `PORT`/`baseURL` through a scratch Playwright config in your worktree (do not commit it), or wait and retry; never kill a process you did not start.
5. Windows: `npm run build` fails under PowerShell 5 because of `&&`. Run `npx tsc -b` then `npx vite build` separately. Prefer the Bash tool.
6. Green today (main tree at `752119f`): `npx tsc -b` no output; `npm run lint` no output; `npm test` passes (`src/**/*.test.ts`); `npm run test:convex` passes (`convex/**/*.test.ts`); `npx vite build` builds with one existing chunk-size warning; `npx playwright test e2e/touch-reorder.spec.ts` 12 passed. From the main tree while worktrees exist, add `--exclude ".claude/**"` to vitest.
7. Edit `.ts`/`.tsx` with the Edit tool, not `sed`: the repo has CRLF files.
8. Convex: read `convex/_generated/ai/guidelines.md` first. Every public function derives the caller from the identity; refusals go through `fail()` as `ConvexError({ code, message })` (a plain `Error` is redacted to "Server Error" in production); the partner's `userId` is never returned.
9. UI work follows the three user-wide skills named in the spec (`apple-design`, `frontend-design`, `web-design-guidelines`) and the 15 design rules summarised in `scout-challenge.md` §4. Copy is sentence case; buttons say what happens; typographic apostrophes.
10. Report: your final message is the report, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`. Do not write it to a file. Do not commit, push or deploy. Leave your worktree with the changes in the working copy (unstaged or staged, not committed) and say its path.

## The contract

### A. Backend (spec 03 produces, spec 04 consumes). All in `convex/`.

Validators (`convex/_shared/challengeValidators.ts`):

```ts
export const commitmentValidator = v.object({ id: v.string(), text: v.string(), archivedAt: v.optional(v.number()) })
export type Commitment = Infer<typeof commitmentValidator>
export const dontValidator = commitmentValidator   // kept as an alias; existing imports keep working
export type Dont = Commitment

// summaryValidator gains, both optional (old rows and old clients lack them):
plannedMinutes: v.optional(v.number()),   // whole minutes planned for the day, every root task, private ones included
doneMinutes: v.optional(v.number()),      // whole minutes earned by ticks (rounded down), same rule as computeDayCompletion
```

Schema (`convex/schema.ts`):
- `challengeMembers.goals: v.optional(v.array(v.union(v.string(), commitmentValidator)))`. A string is a legacy goal (every row written before this run).
- `challengeDays.goalsKept: v.optional(v.array(v.string()))` — ids of the member's goals kept that day. Absent reads as `[]`.

Reads:
- `normalizeGoals(goals): Commitment[]`: a string at index `i` becomes `{ id: "goal-legacy-" + i, text }`; objects pass through. Exported from `challenges.ts` or `_shared`, used by `memberCommitments` and `memberView`.
- **Amended 7 Nov after report 03:** `memberView.goals` **stays `string[]`** (the texts of the active goals, exactly as today, so the client that is live keeps rendering during the deploy window) and `memberView` gains **`goalItems: Commitment[]`** (archived included, like `donts`). `updateMyCommitments` returns the same two fields. Spec 04 reads `goalItems` everywhere it needs ids and may ignore `goals`. `memberView.donts: Commitment[]` unchanged.
- `dayView` and `myDayView` gain `goalsKept: string[]` (`row.goalsKept ?? []`). Nothing else is added to the partner view.
- `challengeView` is unchanged (it already returns `startDate`, `endDate`, `planDeadline`, `checkinDeadline`, `createdBy`-equivalent `isCreator`; spec 03 confirms the field name the client uses for "am I the creator" and keeps it).

Mutations:
- `updateMyCommitments({ challengeId, goals: Array<string | { id?: string; text: string }>, donts: Array<{ id?: string; text: string }> })`. Goals follow the don'ts rule: an item with a known id keeps it (text updated), an item without an id (or a bare string) is minted `goal-<now>-<n>`, a goal missing from the list is archived (`archivedAt`), never deleted. A legacy-string row is converted to objects on this first write; ids `goal-legacy-<i>` sent back by the client are honoured as known ids for the member's current legacy goals, so marks made before the first edit survive it.
- `updateSpan({ challengeId, startDate, endDate, planDeadline?, checkinDeadline? })` → the new `challengeView`. Rules, each a `fail()` sentence:
  1. caller is a member and the challenge is active (`requireMember` write);
  2. caller is the creator: "Only the creator can change the dates";
  3. the span checks shared with `createChallenge`, extracted into one helper (`assertSpan` or similar): ISO format, start ≤ end, at most 366 days ("A challenge can run for at most a year"), deadlines as in create when given;
  4. `endDate` is not before any member's local today: "The end date can't be before today";
  5. `startDate` is not after the earliest date on which any member has a row with `planSetAt` or `checkinAt`: "The start can't move past <d Mon>, when the first lock-in or check-in was recorded" (one indexed read per member, ascending, limit 1 among rows with either stamp);
  6. `challengeDays` rows are never deleted or modified; `status` is untouched.
- `markDay({ challengeId, date, goalsKept?: string[], dontsBroken?: string[] })` → `{ goalsKept: string[], dontsBroken: string[] }`. Rules: `requireMember` write; `date` in span and today or yesterday on the member's own clock (the `checkIn` rule, same sentences); every id a known goal / don't of the member (archived counts), else "Unknown goal" / "Unknown don't"; de-duplicated. Only the fields given are written; a field left out is left as it was. A missing row is inserted with `emptySummary()` and no `planSetAt`/`checkinAt`; an existing row is **patched on those fields only** (never `summary`, `checkinAt`, `planSetAt`, `note`, `remindersSent`). It does not call `recordAct`: a mark is not one of the two daily acts and does not touch inactivity.
- `checkIn` gains `goalsKept: v.optional(v.array(v.string()))`: when given it is validated and written; when absent the row's existing `goalsKept` is kept. `dontsBroken` keeps its current semantics (the sheet sends the full set, seeded from the row, so the latest explicit save wins).

Everything else (`syncDaySummary`, `lockInPlan`, reminders, inactivity, nudges) is untouched. Two-sided deploy: backend first (`npx convex deploy`), then `main`. The new fields are optional so an old client keeps working against the new backend.

### B. Domain (spec 04 produces, in `src/domain/`)

```ts
// src/domain/challenge.ts
export interface ChallengeSummary { ...existing; plannedMinutes?: number; doneMinutes?: number }
// buildChallengeSummary(day, habits) sets both from computeDayCompletion(day.tasks): plannedMinutes = Math.round(plannedMinutes), doneMinutes = Math.floor(doneMinutes), capped at plannedMinutes.
export function dayCompletionPercent(summary: ChallengeSummary | undefined): number | null
// null when plannedMinutes is undefined or 0; else Math.floor(100 * doneMinutes / plannedMinutes), 0..100.
export function seasonCompletion(rows: { summary?: ChallengeSummary }[]): { planned: number; done: number; percent: number | null }
// sums over the rows given (the caller passes the reached days); percent null when planned is 0.

// src/domain/challengeCommitments.ts
export interface Commitment { id: string; text: string; archivedAt?: number }
export function activeCommitments(list: Commitment[] | undefined): Commitment[]
export function resolveCommitmentTexts(ids: string[], list: Commitment[] | undefined, fallback: string): string[]
// activeDonts / resolveDontTexts stay as thin wrappers so existing callers compile.
export function keptLine(goalsKept: string[], goals: Commitment[]): string | null
// "Kept 2 of 3 goals" over the active goals (an id of an archived goal still counts as kept); null when there are no active goals.
```

Words, fixed so the copy is one voice:
- Header action beside Rename: **"Edit dates"**. Sheet title "Dates and deadlines"; fields "Starts", "Ends", "Plan by", "Check in by"; verb **"Save dates"**. Helper under the dates when any day already has a record: "Days with a lock-in or check-in stay in the season."
- Today surface block under your `MemberRow`, heading (Caption style) **"Today's commitments"**; each goal row toggles ✓ with the spoken label "Kept: <goal>" / "Not yet: <goal>"; each don't row toggles ✕ with "Broke: <don't>" / "Kept: <don't>". Empty state when the member has no commitments: nothing rendered (no placeholder).
- Check-in sheet: "Which goals did you keep today?" above the existing "Which did you break today?".
- `MemberRow` meta: **"Kept 2 of 3 goals"** (from `keptLine`), and **"64% of planned time"** when `dayCompletionPercent` is not null; the percentage carries a thin `role="meter"` bar with `aria-valuenow`.
- Head to head: a third row **"Planned time done"** with each member's season percentage ("64%", or "–" when null); the note under the table becomes "A full day is a locked plan and a check-in. Planned time done is minutes done of minutes planned, weighted by each task's length."
- Error sentences come from the server (`challengeErrorMessage`); the client pre-validates only format and order with `seasonStepError` split so the deadlines part can be reused.

### C. Planner (specs 01 and 02; shared files, different hunks)

- Spec 01 owns in `TaskItem.tsx` and `MustDoPinnedHeader.tsx`: the grip element, the `draggable` wiring, pointer handlers, the Move up / down buttons, the empty-Top-3 zone. Spec 02 owns: the duration chip and its placement, `TaskDurationPicker` → `DurationChip`, `ScheduleSheet`, `AddTaskInput`, `durations.ts`. Neither touches the other's hunks; both say in the report which lines they changed in the two shared files.
- New tests go in new files: 01 → `e2e/drag-handle.spec.ts`, `e2e/fill-from-yesterday.spec.ts` (replacing `e2e/copy-from-day.spec.ts`'s one case, which 01 may rewrite), `src/domain/taskUtils.test.ts` additions are allowed (01 only). 02 → `src/domain/durations.test.ts`, `e2e/duration-chip.spec.ts`.
- Words: the drag handle's spoken label is "Drag to move <title>" (desktop and phone); the cap toast is **"Top 3 is full. Move one out first."**; the fill button keeps "Fill from yesterday" / "Fill from last week" / "Copy from <date>" and its undo toast "Copied from yesterday". The duration chip reads "1h 30m" / "45m" when set and **"Time"** (dim) when unset; the typed field's placeholder is "2h 30m, 45m or 1:30".
