# Check 02, round 1

*Filed by the supervisor from the check scout's final message. Worktree `.claude/worktrees/agent-ab3b7b0e44fb5f226`, commit edb00ad; no files changed.*

## Suites
- `npm run test:convex` → Test Files 9 passed, Tests 117 passed
- `npm test` → Test Files 19 passed, Tests 287 passed
- `npm run lint` → clean
- `npx tsc -b` → exit 0
- Not re-run (by instruction): `npx vite build`, e2e. Builder reports both green.

## Acceptance criteria
| AC | met? | evidence |
|---|---|---|
| 1 | met | `convex/_shared/challengeNudges.test.ts`: legacy merge :30-36, gap :50-56, exact gap :58-61 (gap−1 cooling, gap ready), precedence :78-83, cap :68-71 |
| 2 | met | `convex/challengeNudges.test.ts`: 3 allowed, `left` 2/1/0, `sendMail` ×3 (:61-79); 4th refused, still 3 calls (:84-87); gap refusal "again in 50 min" (:93-103); legacy counts as one (:105-135); locked-in partner refused, no mail, no row (:137-147); outside span refused (:149-156). Count goes through the real scheduled `internal.email.sendEmail` via the nodemailer mock. |
| 3 | met | `ChallengeCard.tsx:124-127` label from `nudgeLabel`; button rendered only when non-empty (:215); `disabled` + `aria-disabled` when not ready (:225-226); caption `role="status"` (:218); `role="alert"` only wraps `error` (:236); refusals → `setNotice` (:103) |
| 4 | met | `nudgeLeftCaption(3)` → `''` (:110); after one nudge "2 left today" |
| 5 | met | `nudgeTimes` reads the legacy field (`challengeNudges.ts:31`); end-to-end legacy test :105-135; schema additive |
| 6 | partly confirmed | convex, unit, lint, tsc pass here; build and e2e per builder only |
| 7 | met | 12 files in the diff; `challenges.ts` touches only the import and `nudgePartner`; no `ChallengeDashboard`, `checkIn`, `acceptInvite`, `invitePreview`, goals or donts hunks |

## Findings
### C1. Unrecognised mutation errors can vanish silently — low — `ChallengeCard.tsx:99-104`
An error that is not a rule refusal, while local availability is no longer `ready`, shows nothing (includes a prod-redacted "Server Error" from a cross-device race). Allowed by the spec; builder lists it under F1.
### C2. Two-sided deploy hazard — low — `ChallengeCard.tsx:96`
Client destructures `{ left }`; the old backend returns `null`. Deploy Convex before or with Vercel.
### C3. Caption in `cooling` — none
Shown in ready and cooling, not spent; matches the spec examples.

## Confirmed sound
Precedence and the exact-gap boundary; legacy copied into the array on first write and `nudgeSentAt` never written in `convex/`; span check first, then owes, then cap/gap; `dayView` lists explicit fields with neither nudge field (test :219-220); hooks before the early return (:45-70); `useMinuteTick` clears interval and timeout; `isEvening()` gone, `isEveningIn(partner.timezone)` used with the span check; docs updated, `PrivacyPage:48` untouched; `api.d.ts` gains only the `_shared/challengeNudges` entry; worktree clean.
