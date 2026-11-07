# Review 03, round 1 — FIX

Report: `report-03-round1.md`. Worktree `.claude/worktrees/agent-a7e4d3cbadd913359`.

The builder built the contract as written and found that it breaks the live client: `memberView.goals` changing from `string[]` to `Commitment[]` makes `ChallengeDetail.tsx:575` render objects as React children, so every member with goals gets a crashed dashboard between `npx convex deploy` and the Vercel build. That is the one thing the contract promised not to do. The builder was right to report rather than change it. Contract amended in `02_COMMON.md` (§A, "Amended 7 Nov"): `goals` stays `string[]`, `goalItems: Commitment[]` is added.

Checked myself: `npm run test:convex` claim (193) to be re-run on the integrated head; `useWorkLog.test.ts` failing in the worktree is the missing `.env` (`VITE_CONVEX_URL`), not a defect — noted for the other builders.

## FIX

1. `memberView.goals` returns the active goal texts as `string[]` exactly as before this run; `memberView.goalItems` returns `Commitment[]` with archived ones included; `updateMyCommitments` returns both fields the same way. `invitePreview.inviterGoals` stays `string[]`.
2. A test in `challengeEdits.test.ts` pins that `memberView.goals` for a legacy-string member equals the original strings and that `goalItems` carries `goal-legacy-<i>` ids.
3. `npx tsc -b` from the worktree root is clean (the four `src/` errors disappear once `goals` is a `string[]` again; if any remain, list them).
4. CLAUDE.md "Daily marks" paragraph names both fields.

Everything else: APPROVE pending the integrated run.
