# Report: spec 03, challenge backend (round 2) — filed by the supervisor from the builder's final message

**Worktree:** `.claude\worktrees\agent-a7e4d3cbadd913359`. Nothing committed.

## Fixes

1. `memberView` returns `goals: string[]` (active texts, the shape from before this run) and `goalItems: Commitment[]` (archived included); `updateMyCommitments` returns `{ goals, goalItems, donts }`; `invitePreview.inviterGoals` stays `string[]` through the same `activeGoalTexts` helper.
2. The "goals with ids" test in `challengeEdits.test.ts` pins: a legacy member's `goals` equal `['Read','Run']` for both viewers; `goalItems` carries `goal-legacy-0/1`; after the first edit `goals` is `['Read daily','Swim']`, `goalItems` has the archived "Run", the stored row holds objects. The rest of the file reads ids from `goalItems`.
3. `npx tsc -b` from the worktree root: no output, exit 0.
4. CLAUDE.md "Daily marks" names both fields.

Round-1 edits to `challengeCommitments.test.ts` reverted (passes unchanged); `challenges.test.ts` keeps one change (`goalsKept: []` in the partner day-view `toEqual`).

## Verification (builder)

`npm run test:convex` 16 files, 193 passed; `npm run lint` clean; `npx tsc -b` clean; `npx tsc -p convex/tsconfig.json --noEmit` clean.

## Files

`convex/challenges.ts`, `convex/challengeEdits.test.ts`, `convex/challenges.test.ts` (one line), `CLAUDE.md`; unchanged since round 1: `convex/_shared/challengeValidators.ts`, `convex/schema.ts`.

## Public functions whose args or returns changed (backend first, then `main`)

New `updateSpan`, `markDay`; `updateMyCommitments.goals` takes `string | {id?, text}` and returns `goals`, `goalItems`, `donts`; `checkIn` optional `goalsKept`; summaries accept optional `plannedMinutes`, `doneMinutes`; `memberView` gains `goalItems`; `dayView`/`myDayView` gain `goalsKept`.

## Open questions

An old client saving its lists sends bare strings, so each save mints new ids and archives the old; marks keep resolving; stops once spec 04 ships.

## Known gaps

Rule 5 walks each member's rows ascending until the first stamped one (may pass unstamped rows). The "end not before any member's today" test checks the creator's clock only.
