# Report 02, round 1: nudges

*Filed by the supervisor from builder-02's final message.*

**Branch:** `worktree-agent-ab3b7b0e44fb5f226` (worktree `.claude/worktrees/agent-ab3b7b0e44fb5f226`, forked from `challenge-v2` = main @ 95ec54a) · **Commit:** `edb00ad`. Nothing pushed; no `convex dev` / `deploy`.

## Done
- Pure rules in `convex/_shared/challengeNudges.ts`: `NUDGE_DAILY_CAP = 3`, `NUDGE_MIN_GAP_MS = 1h`, `nudgeTimes` (legacy `nudgeSentAt` merged, sorted, no mutation), `nudgeAvailability` (notOwed → spent → cooling → ready), `nudgeLabel`, `partnerOwesToday`, `nudgeLeftCaption`, `nudgeRefusal`, `minutesUntil`, `NUDGE_RULE_REFUSAL` (client regex for rule refusals).
- Schema: `challengeDays.nudgesSentAt: v.optional(v.array(v.number()))`; legacy `nudgeSentAt` kept, commented as never written.
- `nudgePartner`: span check first ("The challenge is not running today"); owes via `partnerOwesToday`; cap/gap refusals "You have nudged them 3 times today" / "You can nudge again in <n> min"; appends to `nudgesSentAt` (legacy copied in on first write); returns `{ left, nextAt }`. `dayCards` unchanged (raw `mine` carries both fields).
- Client: `challengeService.nudgePartner` returns the result; new `isEveningIn(timezone, now)`; `ChallengeCard` drops the device-clock `isEvening()`, computes availability from `mine` plus a local `useMinuteTick` (minute interval plus one wake when the cool-down ends); partner date outside the span counts as not owed; button states ready / cooling (disabled, `aria-disabled`, quiet style) / spent / hidden; caption `N left today` (`role="status"`) once a nudge is spent; notice "Nudge sent to <Name> · N left today" or "· that was the last one today"; rule refusals become a quiet status; unrecognised errors are suppressed when the refreshed state is no longer ready, otherwise an alert.
- Docs: card header, `CLAUDE.md` reminders paragraph, `PrivacyPage.tsx:62`.
- Tests: `convex/_shared/challengeNudges.test.ts` (16), `convex/challengeNudges.test.ts` (5 convex-test cases: 3 nudges an hour apart with `left` 2/1/0 and 3 emails; 4th refused, no email; 10-min retry refused "again in 50 min"; legacy stamp refused at +30 min then allowed with `[legacy, now]`; locked-in partner not owed, no row created; outside span refused). Minimal edits to `reminders.test.ts` (second nudge at 11:10 expects `/again in/i`) and `challenges.test.ts:219` (+ no `nudgesSentAt` in partner view).

## Files
`convex/_shared/challengeNudges.ts` (new), `convex/_shared/challengeNudges.test.ts` (new), `convex/challengeNudges.test.ts` (new), `convex/challenges.ts` (import + `nudgePartner`), `convex/schema.ts`, `convex/_generated/api.d.ts` (codegen), `convex/reminders.test.ts`, `convex/challenges.test.ts`, `src/components/challenge/ChallengeCard.tsx`, `src/services/challengeService.ts`, `src/pages/PrivacyPage.tsx`, `CLAUDE.md`. `useChallenge.ts` untouched.

## Verification
- `npx convex codegen`: ok (with `.env.local` copied in; "Uploading functions to Convex..." is analysis, nothing deployed; line-ending-only changes to four `_generated` files reverted).
- `npm run test:convex`: 9 files, 117 passed. `npm test`: 19 files, 287 passed. `npm run lint`: clean. `npx tsc -b`: exit 0. `npx vite build`: ok.
- e2e `mobile-panels` + `mobile-responsive`: 32 passed (1.2 m) on private port 5287 via a temporary config, deleted afterwards.
- Acceptance 7: diff touches no goals/donts/`checkIn`/`acceptInvite`/`invitePreview`/dashboard lists.

## Open questions
- Caption semantics: `N left today` shows in ready and cooling; spent shows only the disabled label.
- "Nudge sent" copy where the email is only queued (spec's wording; comment notes it).

## Known gaps
- F1 (production redaction) not fixed: rule refusals are still plain `Error`; the card blocks before a refusal in nearly every case, and an unrecognised error with a non-ready refreshed state shows nothing, but the cross-device race would still show "Server Error" in prod.
- `convex/challengeNudges.test.ts` calls `createChallenge` with `goals: [], donts: []`; if spec 01 changes that signature the `setup`/`pair()` there need the same edit at merge.
- No component test for the card's rendered states.

## Suggestions
- Fix F1 across `challenges.ts` and key the nudge refusal on a code instead of the regex.
- A light component/e2e test for `ChallengeCard` states.
- Two-sided deploy: the client destructures `{ left }` from `nudgePartner`; against the old backend it gets `null` and throws after the email went out. Deploy Convex before or with Vercel.
