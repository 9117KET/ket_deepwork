# Review 02, round 1: countdown rules and the days-left headline

*Reviewer:* supervisor (main session) · *Scout check:* none (the supervisor read both modules in full and re-ran the tests; the builder also ran them under `TZ=America/New_York` and `TZ=Asia/Kolkata`)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met | `src/domain/challengeCountdown.ts` has every contract function plus `nextTickDelay` in the hook file; 19 + 2 tests cover each branch, each sentence, both boundary sets, the local-time flip at exactly 10:00, and the whole-day story; `git status` showed only the four new files |
| 2 | No invented facts | met | – |
| 3 | Consistent with CLAUDE.md and decisions | met | pure module, time as an argument; `role="timer"` left to spec 03 |
| 4 | Internal vs public; no outward action | met | – |
| 5 | Builds and tests pass | met | tsc, lint clean; 366/366 on the merged head |
| 6 | Writing rules | met | the sentences match `02_COMMON.md` word for word |
| 7 | No scope creep | met | – |

## Verdict
**APPROVE**

## Notes for the summary
- The hook cannot be rendered in a test: vitest runs in `node` and `@testing-library/react` is not installed. `nextTickDelay` is tested instead, as the spec allowed.
- The builder's open question: `owedAct` says "lock" when a check-in exists but no plan, while `countdownState` says "done". Spec 03 replaces `owedLabel` in the Today row with the countdown line, so the row will say "Done for today"; the plan-missed day still shows as a dot in the season grid. Carried into spec 03 as a note.
- `src/hooks/useWorkLog.test.ts` fails to load in any worktree without `.env` (`VITE_CONVEX_URL` unset). Pre-existing; both builders worked around it with a dummy URL. Suggested follow-up outside this run.
