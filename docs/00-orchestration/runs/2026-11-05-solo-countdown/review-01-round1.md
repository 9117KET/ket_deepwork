# Review 01, round 1: the `solo` flag (backend)

*Reviewer:* supervisor (main session) · *Scout check:* none (the supervisor ran the suites and read the whole diff; it is 30 lines)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met | `convex/challengesSolo.test.ts`, 9 tests, one per criterion 1 to 8; criterion 9: tsc, lint clean, convex 180/180, unit 366/366 on the merged head; criterion 10: `git diff --stat` touches `CLAUDE.md`, `convex/schema.ts`, `convex/challenges.ts` and the new test only |
| 2 | No invented facts | met | – |
| 3 | Consistent with CLAUDE.md and decisions | met | `acceptInvite` patches in the same mutation (`convex/challenges.ts` after the invite patch); inactivity, reminders, nudge untouched |
| 4 | Nothing internal made public; no outward action | met | the JSON check for user ids and emails passes; nothing deployed |
| 5 | Builds and tests pass | met | see 1 |
| 6 | Writing rules | met | the CLAUDE.md paragraph is in the file's voice |
| 7 | No scope creep | one addition, accepted | `dayCards`, `todayCards` and `history` now return `challenge: challengeView(...)`. The contract's wording ("it therefore appears on …") invited it; the challenge row was already in each query's read set, so no new invalidation and a few bytes more per card. Kept. Spec 03 does not depend on it. |

## Verdict
**APPROVE**

## Notes for the summary
`createChallenge` gained an optional argument, so this is a two-sided deploy: backend first. The builder's report is filed as `report-01-round1.md`.
