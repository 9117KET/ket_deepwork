# Check 03, round 1

*Filed by the supervisor from the check scout's final message. Main checkout, `challenge-v2` at 5ff4b87; no files changed.*

## Suites
- `npm run test:convex` → 11 files, 139 passed
- `npm test` → 21 files, 304 passed
- `npm run lint` → clean
- `npx tsc -b` → clean
- Not run (read-only brief): build, Playwright. Builder: build ok, e2e 5 + 27 passed; supervisor: build ok on the previous head.

## Acceptance criteria
| AC | met? | evidence |
|---|---|---|
| 1 | met | `grep "throw new Error"` → only `convex/challenges.ts:73` (`requireUser`); all else via `fail()` → `ConvexError({code,message})` |
| 2 | met | `src/services/challengeService.test.ts`: object data → message + code; string data → string, code null; dev multi-line → "Unknown don't" (`s` flag); "Server Error" and empty → "Something went wrong" |
| 3 | met | `currentMembership` (:102) used by `myChallenge`/`dayCards`/`history`; test: ended season returned with status `ended`, history rows, `dayCards` non-null, `invite` null; `lockInPlan` refused `/not in a challenge/`; `createChallenge` then succeeds. Client: `useChallenge` status `"ended"`; `ChallengePage` read-only dashboard + "Start a new challenge" (`touch-target`, `min-h-11`); dashboard hides invite, Edit, Leave, sheet |
| 4 | met | Tokyo row on 22 Oct returned with `partnerToDate`, absent without; dashboard passes `addDays(partnerDate,-1)`; hook sends it only when it differs |
| 5 | met | `reviewWeekElapsed` tests (start, end, out of span); `jointStreak` 3 from week end, 0 from a later today; component uses `includeToday ? today : until` |
| 6 | met | +3 sync writes no row; −1/0/+1 do; lock-in yesterday → "You can only lock in today" (exact); check-in yesterday ok; two days ago and tomorrow refused |
| 7 | met | 367 refused, leap-year 366 accepted; 21:00 and 21:30 refused, 21:31 accepted; form `min="21:31"` |
| 8 | met (no UI test) | waits on `mine.status === "loading"`; `member` branch "You're in" + link; `storeToken(null)` on any non-`ok`; server "member" test |
| 9 | partly verified | convex/unit/lint/tsc here |
| 10 | met | extras: `ChallengeCard.tsx` (code-keyed refusal, hook import, local hook removed), `challengeNudges.ts` (`NUDGE_RULE_CODE`), small clock-pinning edits in three test files; the don't-cap addendum |

## Findings
none. Observations: `lockInPlan`/`checkIn` judge today on `me.timezone` only (spec required the args timezone for sync only); the join page's `ended` status falls through to the join form, consistent with writes seeing only active challenges.

## Confirmed sound
F6 safety: no mutation uses `currentMembership`; `activeMembership` at :398 (`createChallenge`), :489 (`acceptInvite`), inside `requireMembership` (:119) used by `createInvite`, `updateMyCommitments`, `leaveChallenge`, `syncDaySummary`, `lockInPlan`, `checkIn`, `nudgePartner`. F11: `DayPlanner.tsx:226` `enabled: challengeActive && !isHydrating && isToday`. F1 client: code checked first, regex fallback; `nudgePartner` rule refusals carry `NUDGE_RULE_CODE`; "Nobody has joined" / "no email" keep the default code. `invitePreview` auth optional; non-member and signed-out still get `used` (tested). `useMinuteTick` clears interval and timeout; used by `ChallengePage`, `ChallengeReviewSection`, `ChallengeCard`. CLAUDE.md sentences present.
