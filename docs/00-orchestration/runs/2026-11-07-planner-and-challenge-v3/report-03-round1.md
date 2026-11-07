# Report: spec 03, challenge backend (round 1) — filed by the supervisor from the builder's final message

**Worktree:** `.claude\worktrees\agent-a7e4d3cbadd913359`, branch `worktree-agent-a7e4d3cbadd913359`. Changes in the working copy, not committed.

## Read first: the contract breaks the client that is live now

Contract §A changes `memberView.goals` from `string[]` to `Commitment[]`. The client in production renders goals as text (`ChallengeDetail.tsx:575` `goals.map((g) => … {g} …)`; `CommitmentsSheet` calls `textsToRows(initialGoals)`). If this backend is deployed before spec 04's client, React gets objects as children and throws, so the dashboard crashes for every member who has goals. "An old client keeps working against the new backend" holds for the summary fields, `goalsKept` and the new functions; not for `memberView.goals`. Built as written; not changed. Options: deploy and push back to back, or keep `goals: string[]` and add `goalItems: Commitment[]`.

## Done

- Setup: `git merge run/2026-11-05-solo-countdown` printed "Already up to date" (`main` holds it through PR #39; `git log --oneline -1` → `3ea502e Merge pull request #39 …`). `node_modules` junction linked.
- Validators: `commitmentValidator`, `Commitment`; `dontValidator`/`Dont` kept as aliases; `summaryValidator` gains optional `plannedMinutes`, `doneMinutes`.
- Schema: `challengeMembers.goals` union of string and commitment; `challengeDays.goalsKept` optional string array.
- Goal reads: exported `normalizeGoals`, `legacyGoalId`; `memberCommitments` and `memberView` return `Commitment[]` (archived included); legacy challenge-row goals also get `goal-legacy-<i>` ids; `invitePreview.inviterGoals` stays `string[]`.
- Day views: `dayView`, `myDayView` gain `goalsKept: row.goalsKept ?? []`, nothing else; `dayCards.mine` is the raw row and carries it.
- `createChallenge`, `acceptInvite` store goals as objects `goal-<now>-<n>`; args unchanged.
- `updateMyCommitments`: goals accept a bare string or `{id?, text}`; one `reconcileList` helper for goals and don'ts (known id kept, blank or missing archived, no id minted; bad id → "Unknown goal"/"Unknown don't"); legacy rows converted on first edit, `goal-legacy-<i>` honoured; returns objects. Blank goal rows no longer count against the cap of 10 (same as don'ts).
- `assertSpan`: one helper for `createChallenge` and `updateSpan`, same sentences.
- `updateSpan`: `requireMember` write → "Only the creator can change the dates" → `assertSpan` → end not before any member's local today → start not after either member's first stamped row ("The start can't move past 24 Oct, when the first lock-in or check-in was recorded"); patches only the dates and the deadlines given; returns `challengeView`; `isCreator` unchanged.
- `markDay`: date, span and id checks in `cleanMarks`, shared with `checkIn`; writes only the lists given; a missing row inserted with `emptySummary()` and no acts; no `recordAct`.
- `checkIn`: optional `goalsKept`; when absent, existing marks kept.
- CLAUDE.md: "Editing the dates", "Daily marks", the summary fields and `goalsKept` in Tables.

## Public functions whose args changed (backend first, then `main`)

New: `updateSpan`, `markDay`. `updateMyCommitments.goals` → `Array<string | {id?, text}>`. `checkIn` adds optional `goalsKept`. `syncDaySummary`, `lockInPlan`, `checkIn` summaries accept optional `plannedMinutes`, `doneMinutes`. Return shapes: `memberView.goals`, `updateMyCommitments` result, `dayView`/`myDayView` (+`goalsKept`).

## Files

`convex/_shared/challengeValidators.ts`, `convex/schema.ts`, `convex/challenges.ts`, `convex/challengeEdits.test.ts` (new, 13 tests), `convex/challengeCommitments.test.ts` (goals now objects in four tests), `convex/challenges.test.ts` (`setup` goals assertion maps to `.text`; partner day view `toEqual` adds `goalsKept: []`), `CLAUDE.md`.

## Verification

- `npm run test:convex`: 16 files, 193 tests passed (180 + 13). Criteria 1–7 each have a test; criterion 5's inactivity case: the sweep after three days with only marks still warns (`missedSince: '2026-10-18'`).
- `npm run lint`: clean. `npx tsc -p convex/tsconfig.json --noEmit`: clean.
- `npx tsc -b`: 4 errors, all in `src/` from the goals shape (`ChallengeDetail.tsx` 468, 479, 513; `challengeService.ts:86`); not edited per spec.
- `npm test`: 366 passed; `src/hooks/useWorkLog.test.ts` fails to load with "Provided address was not an absolute URL" (no `.env` in the worktree; nothing in `src/` changed).

## Open questions

1. The old-client crash on `memberView.goals`.
2. An old client's `updateMyCommitments` sends bare strings, so each save mints fresh ids and archives the old (up to 10 archived goals) until spec 04 ships; marks still resolve.

## Known gaps

- Rule 5 walks rows ascending to the first stamped one (one indexed read per member, may pass unstamped rows; no index on the stamps).
- The partner leg of "end not before any member's today" is covered by code; the test exercises the creator's clock only.

## Suggestions

- Keep the contract and deploy/push within minutes, or add `goalItems`. Spec 04's `CommitmentsSheet` should send goals back with their ids.
