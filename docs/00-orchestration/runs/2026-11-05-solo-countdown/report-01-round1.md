# Report 01, round 1: the `solo` flag (backend)

Filed by the supervisor from the builder's final message (the harness returns reports as text).

## Done
- `challenges.solo: v.optional(v.boolean())` in `convex/schema.ts`.
- `createChallenge` takes `solo?: boolean`; writes `solo: true` only when true.
- `acceptInvite` sets `solo: false` in the same mutation that inserts the partner's member row, only when the row had `solo === true`.
- `challengeView` returns `solo: c.solo === true`; `dayCards`, `todayCards` and `history` now also return `challenge: challengeView(...)` (the builder's decision, flagged; accepted in review).
- `AdminChallengeRow.solo`.
- `CLAUDE.md`: one paragraph, "A challenge may be solo."

## Files
- `convex/schema.ts`, `convex/challenges.ts`, `convex/challengesSolo.test.ts` (new, 9 tests), `CLAUDE.md`.

## Verification
- `npx tsc -b` clean; `npm run lint` clean; `npm run test:convex` 15 files, 180 tests; `npm test` 345 with `VITE_CONVEX_URL` set (the worktree has no `.env`).

## Open questions
- Keep the added `challenge` field on the three day queries? (Review: kept.)

## Known gaps
- Two-sided deploy: backend first.
