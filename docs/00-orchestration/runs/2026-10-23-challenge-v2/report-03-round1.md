# Report 03, round 1: challenge bug fixes from the audit

*Filed by the supervisor from builder-03's final message.* Branch `challenge-v2` (main checkout). Commits `280c68d` (backend + convex tests), `5ff4b87` (client, docs, unit tests). Nothing pushed; codegen only.

## Done
- **F1** every expected-state throw in `convex/challenges.ts` goes through `fail(message, code = "challenge")` → `ConvexError({ code, message })`; `requireUser` keeps a plain `Error`. Nudge refusals carry `NUDGE_RULE_CODE` (`_shared/challengeNudges.ts`); `ChallengeCard` checks `challengeErrorCode(e) === NUDGE_RULE_CODE` first, regex fallback kept for an older backend. `challengeErrorMessage` reads `e.data.message` / `String(e.data)`, else the regex with the `s` flag; redacted "Server Error" → "Something went wrong".
- **F6** `currentMembership` = active, else most recent ended; used by `myChallenge`, `dayCards`, `history` only; writes keep `activeMembership`/`requireMembership`. `myChallenge` returns no invite for an ended season. `ChallengeStatus` gains `"ended"`; `/challenge` shows the dashboard read-only (no invite box, Edit or Leave) with "Start a new challenge" (44px) revealing the join and create forms; Today card and Review section stay active-only.
- **F5** `history` takes `partnerToDate?`; `useChallengeHistory(enabled, until, partnerUntil?)` sends it only when it differs; dashboard passes `addDays(partnerDate, -1)`.
- **F9** streak counts back from `includeToday ? today : until`; `elapsed = reviewWeekElapsed(weekDates, today, challenge)` in `src/domain/challenge.ts`; frozen clock replaced by `useMinuteTick()`.
- **F11** `syncDaySummary` null outside ±1 day of the member's local today (args timezone when valid, else `me.timezone`); `lockInPlan` today only; `checkIn` today or yesterday; `DayPlanner` passes `enabled: challengeActive && !isHydrating && isToday`.
- **F4/F7** `MAX_SPAN_DAYS = 366`, `HISTORY_CAP = 400`; `checkinDeadline` must be after 21:30; create form input `min="21:31"`.
- **F13/F14/F16** display-name default cut to 40 on both pages; join page waits for `mine.status !== "loading"`; `invitePreview` returns `status: "member"` for a signed-in member (auth optional) → "You're in. This is your challenge." with a link; stored token cleared on any non-`ok` status; `useMinuteTick(wakeAt?)` extracted to `src/hooks/useMinuteTick.ts` and used by the card, `ChallengePage` and the Review section.
- **Addendum** `updateMyCommitments` caps non-blank don't rows only (11 rows with one blank accepted; 11 non-blank refused).
- **Docs** `CLAUDE.md` challenge section: publish-only-today, "Refusals are sentences", 366-day cap and deadline rule, `history`'s two dates and the ended-season fallback.

## Files
`convex/challenges.ts`, `convex/_shared/challengeNudges.ts` (`NUDGE_RULE_CODE`), `convex/challengeFixes.test.ts` (new, 10), minimal clock-pinning edits in `challenges.test.ts`, `challengeCommitments.test.ts`, `reminders.test.ts`; `src/services/challengeService.ts` + `.test.ts` (new, 4); `src/hooks/useMinuteTick.ts` (new), `src/hooks/useChallenge.ts`; `src/pages/ChallengePage.tsx`, `ChallengeJoinPage.tsx`; `src/components/challenge/ChallengeDashboard.tsx` (`readOnly`, `afterCountdown`), `ChallengeReviewSection.tsx`, `ChallengeCreateForm.tsx`, `ChallengeCard.tsx` (code-keyed refusal, hook import); `src/components/planner/DayPlanner.tsx` (one line); `src/domain/challenge.ts` + test (`reviewWeekElapsed`, 4 tests); `CLAUDE.md`.

## Verification
`npm run test:convex` 11 files, 139 passed; `npm test` 21 files, 304 passed; lint clean; `tsc -b` exit 0; `vite build` ok; e2e `mobile-panels` 5 passed, `mobile-responsive` 27 passed (private port 5293, scratch config deleted). AC1 grep → only `requireUser`; AC2 four shapes; AC3 convex test (UI by code path); AC4 London/Tokyo test; AC5 `reviewWeekElapsed` + past-week streak test; AC6 today+3 no row, yesterday lock-in refused, two-days-ago check-in refused, yesterday check-in ok; AC7 367 refused / 366 accepted / 21:00 and 21:30 refused; AC8 by code path + "member" convex test.

## Open questions
- `lockInPlan`/`checkIn` judge today on the stored `me.timezone`; a member who just travelled is judged on the old zone until `syncDaySummary` refreshes it (1.2 s after the first planner edit, or on foreground).
- With the planner left open across midnight, the card's `date` can be yesterday; the server now refuses with a sentence.

## Known gaps
- Existing tests now pin the clock (fake `Date` at 22 Oct 12:00 Berlin) because they act on `2026-10-22`.
- No new e2e for the ended dashboard or the join-page states (signed-in only; seeding is guest-only).
- `ChallengeCard.tsx` was outside the deliverables list; touched for the code-keyed refusal and the hook import.

## Suggestions
- Two-sided deploy: a new client sends `partnerToDate` only when it differs, and an old backend rejects the arg; an old client against the new backend sees JSON strings in dev and "Something went wrong" in prod. Deploy Convex first.
- Still open for the human: F10, F12, F15, F17, showing deadlines on the card.
- `CLAUDE.md` "Tests" paragraph could name the new test files.
