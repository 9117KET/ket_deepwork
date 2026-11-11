# Report 01, round 1 (filed by the supervisor from the builder's final message)

Builder worktree branch: `worktree-agent-a9f04f0243b9baaad`. Nothing committed or deployed. Nothing under `src/`, `e2e/`, `.github/` edited.

## Files
- New: `convex/_shared/challengeGroup.ts` (pure rules: `MAX_MEMBERS`=8, `MEMBER_ROW_BOUND`=64, `activeInJoinOrder`, `successorOf`, `closedSpanFor`, `appendClosedSpan`, `reopenEndProblem`, `firstClosedDate`, `nudgeTimesFor`, `checkinDeadlinePhrase`) and its test; `convex/_shared/challengeMembers.ts` (the one `membersOf`, `memberRowsOf`, `handOverIfCreator`; `normalizeGoals`, `legacyGoalId`, `memberCommitments` moved here, re-exported); `convex/challengeGroups.test.ts`; `convex/challengeReopen.test.ts`.
- Changed: `convex/challenges.ts`, `challengesInternal.ts`, `reminders.ts`, `schema.ts`, `email.ts` (comment), `_shared/challengeValidators.ts`, `_shared/challengeInactivity.ts` (`inactivityFrom`), `_shared/challengeReminders.ts` (`dropped` kind), `CLAUDE.md`, `docs/DEPLOYMENT.md`.

## Commands
lint clean; `npx tsc -b` exit 0 (client compiles unchanged); `npx tsc -p convex/tsconfig.json --noEmit` exit 0; `npm test` 401 passed; `npm run test:convex` 19 files, 239 passed (was 193); `npx vite build` ok. Playwright not run (not required).

## Criteria
All 26 have named tests (G = `challengeGroups.test.ts`, R = `challengeReopen.test.ts`). Notable: criterion 4 replays all 21 client calls found in `src/` on `main`; criterion 16 snapshots every member and day row before and after for all five end reasons; criterion 21 proves `EMAIL_DELIVERY=off` is not vacuous; criterion 23 wording for 23:59 is "Check in before midnight", otherwise the time ("Check in before 22:00").

## Existing tests changed
`challenges.test.ts` (third person needs a fresh link, then joins; preview gains `memberCount`, `capacity`); `challengesSolo.test.ts` (same); `challengeCommitments.test.ts` (seeds 8 to reach `full`); `challengesMulti.test.ts` (creator leaving hands over; admin `formerMembers: 1`; delete tests end via `internal.challengesInternal.endChallenge`); `challengeEdits.test.ts` (updateSpan sentence adds "or mark"); `challengeInactivity.test.ts` (warning gains `memberKey`, `displayName`).

## Contract gaps resolved by the builder
1. Inactivity counts from the day **after** `reopenedDate` (the reopen day was partly closed); otherwise criterion 19 fails. First warning after three full days.
2. Hand-over: legacy `challenge.goals`/`donts` are written onto the leaving creator's own row first, so they do not migrate to the new creator.
3. A returning member's `timezone` is refreshed from the accept; `joinedDate` computed in it.
4. `invitePreview` finds the inviter among all rows (a former member's link still shows their name).
5. Warned member gone: `memberKey: ""`, `displayName: "A former member"`.
6. `invitePreview` `notFound`/`ended` carry `memberCount: 0`.
7. Malformed `otherDates`: `dayCards`/`history` refuse; `todayCards` falls back to `partnerDate`.
8. `reopenChallenge` refusal order: gone, not a member, not creator, running, cap, end date.
9. `updateSpan`'s mark guard reads former members' rows too.

## Known gaps
- **The live client's leave sheet tells a creator "ends it for both", which is now false** (hand-over). Spec 02 must fix the copy; deploy backend and client close together.
- **`updateSpan` still caps 366 days from the original start**, so after a long reopen every date edit is refused. Needs a decision.
- One warning at a time (known limit).
- `convex/_generated/api.d.ts` not regenerated (no new functions in the `_shared` modules; deploy regenerates).
- Group nudge "no email address" variant not tested.

## Open questions
- `updateSpan` 366-day cap: from the latest reopen day?
- Show `closedSpans` as "closed" in the grid (spec 02, per the brain dump's assumption).
