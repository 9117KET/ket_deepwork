# Report: spec 04, round 2 — filed by the supervisor from the builder's final message

Fix 1 done: `keptLine` counts the active goals plus any archived goal kept that day; it can no longer read "2 of 1". One active + one archived, both kept → "Kept 2 of 2 goals" (new test), only the archived one kept → "Kept 1 of 2 goals". Nothing else changed.

Decision raised: with this formula criterion 3's example gives "Kept 2 of 3 goals", not "2 of 2" (2 active + 1 archived kept = 3, of which 2 kept). `max(active, kept)` would give "2 of 2" but would claim every goal kept when b was not, so it was not used. The test pins "Kept 2 of 3 goals" with a comment. **Supervisor:** accepted; the spec's criterion 3 is amended.

`npx tsc -b` clean; `npm test` 25 files / 389 passed. Files: `src/domain/challengeCommitments.ts`, `src/domain/challengeCommitments.test.ts`. Worktree `.claude\worktrees\agent-a4a05e1e13db12b16`, nothing committed.
