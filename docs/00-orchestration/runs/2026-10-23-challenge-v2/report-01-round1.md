# Report 01, round 1: per-member, editable goals and don'ts

*Filed by the supervisor from builder-01's final message.*

**Branch:** `worktree-agent-ae2b7026e3f8da523` · **Commits:** `6b95360` (backend and tests), `4ed3811` (client, docs, test stability). Nothing pushed or deployed.

## Done
- Each member's goals and don'ts live on their `challengeMembers` row (optional fields; no migration). Set on create or join, changed later with `updateMyCommitments`; the partner reads, cannot write.
- Removing a don't archives it (`archivedAt`, id kept) so every `dontsBroken` id resolves; editing keeps the id.
- Older challenges: the creator's lists come from the challenge row via `memberCommitments`; everyone else starts empty.
- `checkIn` validates against the caller's own list, archived included. `invitePreview` returns the inviter's active texts.
- Dashboard: "Yours" (Edit → `CommitmentsSheet`) beside the partner's read-only column; only "Yours" before a partner joins. Join page shows the inviter's lists and takes the joiner's own (optional).

## Files
`convex/_shared/challengeValidators.ts` (`archivedAt?`, `Dont` type), `convex/schema.ts`, `convex/challenges.ts` (`memberCommitments`, `mintDonts`, `challengeView` drops lists, `memberView(challenge, m)` adds them, `createChallenge`, `acceptInvite` optional lists, `invitePreview`, `updateMyCommitments`, `checkIn`; `nudgePartner`/`dayCards` untouched), `convex/challengeCommitments.test.ts` (new, 12), `convex/challenges.test.ts` (:63-64, :100-104, :187), `src/domain/challengeCommitments.ts` + test, `src/components/challenge/ListEditor.tsx` (new, `editable` mode), `CommitmentsSheet.tsx` (new), `ChallengeCreateForm.tsx`, `ChallengeDashboard.tsx`, `MemberDayCard.tsx`, `CheckinSheet.tsx`, `ChallengeCard.tsx` (share text via `info.me.donts`), `ChallengeReviewSection.tsx`, `src/pages/ChallengePage.tsx`, `src/components/planner/DayPlanner.tsx`, `src/pages/ChallengeJoinPage.tsx`, `src/services/challengeService.ts`, `src/pages/PrivacyPage.tsx:48`, `CLAUDE.md`.

## Verification
- `npx convex codegen` ran (line-ending-only changes to `_generated`, restored).
- `npm run test:convex`: 8 files, 108 passed (new file 12/12, six runs). `npm test`: 20 files, 293 passed. `npm run lint`: clean. `npx tsc -b`: exit 0. `npx vite build`: ok.
- e2e `mobile-panels` + `mobile-responsive`: 32 passed on private port 5197 via a temporary config, deleted afterwards.
- AC 1–5 each have a test; AC6 by code path + convex test; AC7 partner-view test confirms an archived don't still carries text; AC9 no migration/deploy/removal.

## Open questions
- An archived id sent back to `updateMyCommitments` is rejected as `Unknown don't` (un-archiving is out of scope).
- A known id with blank text is treated as a removal (archived), not rejected.

## Known gaps
- One extra in-place edit at `challenges.test.ts:100-104` (exact `toEqual` on `invitePreview` needed the two new keys).
- `CheckinSheet` gets active don'ts only; editing a check-in that names a since-archived don't keeps the id but the share text says "a don't" and there is no checkbox for it.
- Don't ids are `dont-<ms>-<n>`; two members writing in the same millisecond mint equal ids (harmless, resolved per member); the new test gives the partner a distinct id.

## Suggestions
- `CheckinSheet` could list archived don'ts already in `existing.dontsBroken`.
- Random suffix on minted ids if cross-member uniqueness is ever wanted.
- CLAUDE.md "Tests" paragraph could name the two new test files.
- Text typed into an editor's "Add" field but not added is dropped on Save.
- Two-sided deploy: the client reads `me.donts`, which the old backend does not return.
