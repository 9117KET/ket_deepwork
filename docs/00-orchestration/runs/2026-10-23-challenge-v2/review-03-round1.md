# Review 03, round 1: challenge bug fixes from the audit

*Reviewer:* supervisor (main session) · *Scout check:* `check-03-round1.md` (dispatched; verdict holds unless it finds a defect)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met | AC1 supervisor grep: `throw new Error` only at `convex/challenges.ts:73` (`requireUser`); AC2 `src/services/challengeService.test.ts` (4 shapes); AC3 `currentMembership` read in the diff — reads only, `myChallenge` returns no invite when ended, `ChallengePage` renders the dashboard with `afterCountdown` button; AC4 `history` `partnerToDate` hunk; AC5 `reviewWeekElapsed` + streak from `until`; AC6 `memberToday` window hunks in `syncDaySummary`/`lockInPlan`/`checkIn`; AC7 `MAX_SPAN_DAYS`, `daysBetween`, check-in deadline rule; AC8 `invitePreview` "member" hunk with optional auth; AC9 supervisor re-ran: 139 convex / 304 unit / lint / tsc clean, builder: build + 32 e2e; AC10 addendum only |
| 2 | No invented facts | met | Limits match the spec's numbers; audit line-number error on `ChallengeReviewSection` handled by reading the file |
| 3 | Consistent with CLAUDE.md and decisions | met | Reads/writes split exactly as decided; `ConvexError` shape matches `convex/tasks.ts`; docs updated in the section's voice |
| 4 | Internal/public; no outward action | met | `invitePreview` exposes nothing new to a signed-out visitor; nothing pushed or deployed |
| 5 | Builds and tests pass | met | supervisor's run on the final head |
| 6 | Writing rules | met | "You can only lock in today", "A challenge can run for at most a year", "You're in. This is your challenge." |
| 7 | No scope creep | met, one noted | `ChallengeCard.tsx` touched beyond the list, for the code-keyed refusal the supervisor asked for in the dispatch prompt and the extracted hook — accepted |

Supervisor read: the full backend diff of `convex/challenges.ts` (`fail`, `currentMembership`, `daysBetween`, `memberToday`, every converted throw, the today window, `partnerToDate`, the "member" preview, the don't-cap addendum); the `challengeService.ts`, `useChallenge.ts`, `ChallengePage.tsx` diffs.

## Verdict
**APPROVE**

## FIX list
none

## Notes for the summary
- Two-sided deploy is now unavoidable in three places (`me.donts`, `nudgePartner` result, `partnerToDate`): Convex first, then Vercel.
- The open question on `lockInPlan`/`checkIn` judging "today" on the stored timezone is accepted for this run: the planner refreshes it on the first edit, which precedes a lock-in.
- F10, F12, F15, F17 and showing deadlines on the card remain open by decision.
