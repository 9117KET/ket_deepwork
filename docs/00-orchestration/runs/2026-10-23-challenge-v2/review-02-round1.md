# Review 02, round 1: capped, spaced nudges

*Reviewer:* supervisor (main session) · *Scout check:* `check-02-round1.md` (dispatched; verdict holds unless it finds a defect)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met | AC1 `convex/_shared/challengeNudges.test.ts` (16 tests: cap, gap, exact-gap boundary, legacy merge, precedence, labels); AC2 `convex/challengeNudges.test.ts` (5 cases incl. 3 emails via nodemailer mock, 4th refused, gap refused, legacy counted, not-owed refused); AC3 `ChallengeCard.tsx` renders `nudgeLabel` text disabled + `aria-disabled` for cooling/spent, hides on `''`, refusals go to `setNotice` (`role="status"`); AC4 `nudgeLeftCaption` returns `''` when `left === CAP`; AC5 `nudgeTimes` reads `nudgeSentAt` as one entry, mutation copies it into the array; AC6 117 convex / 287 unit / lint / tsc / build / 32 e2e green per report; AC7 diff touches only `nudgePartner` + one import in `challenges.ts` |
| 2 | No invented facts | met | Rules match the spec's numbers; `inRange` reused at :140 for the F18 check |
| 3 | Consistent with CLAUDE.md and recorded decisions | met | Cap judged on the nudger's local day (decided); pure `_shared` module imported by the client, same pattern as `challengeReminders`; CLAUDE.md paragraph updated in the section's voice |
| 4 | Internal/public separation; no outward action | met | `dayView` unchanged, partner view test extended to `nudgesSentAt`; nothing pushed or deployed; codegen's "Uploading functions" is analysis only (builder checked) |
| 5 | Builds and tests pass | met (per report; scout re-runs) | see AC6 |
| 6 | Writing rules | met | Copy is short and plain: "Nudge again in 42 min", "Nudged 3/3 today", "Nudge sent to Sam · 2 left today" |
| 7 | No scope creep | met | `useChallenge.ts` untouched; the card keeps its own tick; no change to goals/donts |

Supervisor read: `convex/_shared/challengeNudges.ts` (whole file), the `challenges.ts`, `schema.ts`, `challengeService.ts`, `ChallengeCard.tsx`, `CLAUDE.md`, `reminders.test.ts` hunks of `edb00ad`. Hooks (`useMinuteTick`, `useRef`, `useEffect`) sit before the early `return null`, so hook order is stable. `partnerOwesToday` takes `null` as well as `undefined`, which covers both `dayView` and the raw row.

## Verdict
**APPROVE** (merge into `challenge-v2` after the scout check comes back clean)

## FIX list
none

## Notes for the summary
- The nudge "error" was the once-a-day rule thrown as a plain error; now the button carries the state. In production, any refusal that still slips through (two devices racing) shows "Server Error" until spec 03 lands `ConvexError` — spec 03 should also key `NUDGE_RULE_REFUSAL` on the error code rather than the regex.
- Two-sided deploy: the client now expects `{ left, nextAt }` from `nudgePartner`; deploy Convex before or with the Vercel push.
- Merge-time edit to expect: `convex/challengeNudges.test.ts` calls `createChallenge` with `goals: [], donts: []` — spec 01 keeps that signature, so no edit should be needed.
