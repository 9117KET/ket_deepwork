# Check 01, round 2

*Filed by the supervisor from the check scout's final message. Worktree `.claude/worktrees/agent-ae2b7026e3f8da523`, HEAD 07067a5; no files changed.*

## Suites
- `npm run test:convex` → 8 files, 108 passed
- `npm test` → 20 files, 296 passed
- `npm run lint` → clean
- `npx tsc -b` → clean
- Not run (by instruction): build, Playwright. The supervisor ran build on the merged head: ok.

## Acceptance criteria
| AC | met? | evidence |
|---|---|---|
| 1 | met | `convex/challengeCommitments.test.ts:96-114`: lists moved to the challenge row; creator resolves them (:107), invitee gets `[]` (:108) |
| 2 | met | :118-138 edited dont keeps id (:130); omitted dont still present with `archivedAt` (:135, length 3 at :129); unknown id throws (:153-155, :158-166) |
| 3 | met | :191-207 partner's id → `/unknown don't/`; caller's archived id accepted (:200-201), stored and resolved with `archivedAt` (:203-206) |
| 4 | met | `invitePreview` :211-218 (active texts, no auth), :220-234 (full carries lists; used/notFound none); `acceptInvite` with lists :85-94 |
| 5 | met | :70-71 `challenge` has no `goals`/`donts`; `me`/`partner` carry them (:72-73, :92-93) |
| 6 | met (code read) | `ChallengeDashboard.tsx:171` two columns only with partner; Edit :173-183; sheet :212 → `updateMyCommitments` (`CommitmentsSheet.tsx:41`); each `MemberDayCard` gets its member's donts (:148, :150) |
| 7 | met | `MemberDayCard.tsx:51` `resolveDontTexts` over the full list; unit test :19; convex test :206 |
| 8 | partly | convex/unit/lint/tsc here; build by the supervisor; e2e by the builder (32 passed, round 1) |
| 9 | met | additive fields only; legacy columns kept |

## Findings
### C1. Blank dont rows count toward the cap — low — `convex/challenges.ts` `updateMyCommitments` (`args.donts.length > MAX_LIST` before blanks are dropped)
Client strips blanks via `rowsToDontPayload`; only a direct API caller is affected. → handed to builder 03 (same file).
### C2. Share-text fallback now "a don't" instead of `''` — trivial, as specified.

## Confirmed sound
Unknown/duplicate id throws; omitted dont archived in place; archived ones pass through and do not count against the cap (:153-155); minted ids unique (:151); goals through `cleanList`; `commitmentsUpdatedAt` set (:137); handler patches only `me._id`. `memberCommitments` fallback exact; `createChallenge` writes `[]` on the challenge row (:74-76). No `challenge.goals`/`challenge.donts` left in `src/`. Both `CheckinSheet` mounts pass `activeDonts(me.donts)` (`ChallengePage.tsx:118`, `DayPlanner.tsx:850`); `ChallengeCard.tsx:71`, `ChallengeReviewSection.tsx:83` resolve against the full list. `withDraft` on all three submit paths; `commitDraft` null on blank/full; `add` reads the ref; three unit tests (:44-68). Diff: 21 files, `nudgePartner`/`dayCards` untouched, no e2e files changed.
