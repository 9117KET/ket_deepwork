# Scout: bug audit of the challenge feature (2026-10-23)

*Filed by the supervisor from the scout's final message. Static read of every file in scope; no two-account run. Line numbers from the working tree at 95ec54a.*

## Suites run
- `npm test` → Test Files 19 passed, Tests 287 passed
- `npm run test:convex` → Test Files 7 passed, Tests 96 passed
- `npm run lint` → clean
- Test gaps: no `nudgePartner` test beyond the unauthenticated rejection (`challenges.test.ts:267`); nothing tests `challengeErrorMessage`; no season over 200 days; no members on different dates; no signed-in e2e.

## Findings (most severe first)

### F1. Every rule violation arrives as a plain `Error`, so production shows "Server Error" — high — likely
Where: `convex/challenges.ts` (all `throw new Error`, e.g. :311-325, :373-381, :431, :452, :457, :485, :491, :494, :497); `src/services/challengeService.ts:107-109`; used in `ChallengeCard.tsx:50`, `CheckinSheet.tsx:57`, `ChallengeDashboard.tsx:48,65`, `ChallengeCreateForm.tsx:86`, `ChallengeJoinPage.tsx:67`.
Scenario: Convex redacts non-`ConvexError` messages in production, so the client gets `[CONVEX M(challenges:nudgePartner)] [Request ID: …] Server Error`. In dev the cleaner regex `^.*Uncaught Error: ` has no `s`/`m` flag so it cannot cross the newline before "Uncaught Error:" and returns the whole bracketed string. The repo already uses `ConvexError` for expected states in `convex/tasks.ts:48,58`.
Fix: throw `ConvexError({ code, message })` for expected states; read `e.data` in `challengeErrorMessage`; add the `s` flag as a fallback.

### F2. Nudge button stays live after a nudge and is decided on the wrong clock — high — confirmed
Where: `ChallengeCard.tsx:77,165-169,186-190`; `convex/challenges.ts:487-494`.
Scenario: nothing disables the button after a success, so the second tap throws "You have already nudged them today" (:494). `partnerOwes` uses the viewer's clock (`isEvening()`), the server the partner's; across 21:30 the card offers a nudge the server refuses or hides one it would allow.
Fix: use `mine.nudgeSentAt` (already returned raw by `dayCards`) for the button state; judge evening on the partner's timezone. → **spec 02**

### F3. "Nudged … by email" is shown before any email is attempted — medium — confirmed
Where: `convex/challenges.ts:501` (scheduled), `ChallengeCard.tsx:60`, `convex/email.ts:34`.
Scenario: if SMTP env vars are missing or the send fails inside the scheduled action, nothing retries and the client never hears; the allowance is already spent.
Fix: word the notice as sent/queued; optionally refund on failure. → copy in **spec 02**; refund left open

### F4. A season over 200 days loses its newest days — medium — confirmed
Where: `convex/challenges.ts:35,264` (`.take(HISTORY_CAP)` ascending); `createChallenge` :315-317 has no maximum span.
Fix: cap the span in `createChallenge` (or page history from the newest end). → **spec 03**

### F5. Partner's grid has a hole when the partner is a day ahead — medium — confirmed
Where: `ChallengeDashboard.tsx:27,38-39,157`; `convex/challenges.ts:262`.
Scenario: viewer in London on 23 Oct, partner in Tokyo on 24 Oct; history is `toDate = 22 Oct`, partner card is 24 Oct; the partner's 23 Oct row is in neither list and renders as "missed". The reverse case duplicates a row harmlessly.
Fix: fetch partner history to `partnerDate - 1`. → **spec 03**

### F6. The finished season disappears from the UI — medium — confirmed
Where: `convex/challengesInternal.ts:69-72,119` ends the challenge once every member is past `endDate`; `activeMembership` (`challenges.ts:51-62`) returns only active ones, so `myChallenge` becomes null. The "ended" branches (`ChallengeDashboard.tsx:89-91`, `ChallengeCard.tsx:102-103`) are reachable only until the next 15-minute sweep.
Scenario: the day after the season ends `/challenge` shows the create/join forms; the grid, streak and Review are unreachable though the rows exist.
Fix: `myChallenge` falls back to the most recent ended membership; create/join still check active only. → **spec 03**

### F7. Deadline validation incomplete; deadlines never shown or enforced — medium — confirmed
Where: `convex/challenges.ts:318-322` validates only `planDeadline < 21:30`; `challengeReminders.ts:78,85`.
Scenario: `checkinDeadline` ≤ 21:30 (e.g. `00:00`) passes and the check-in reminder window is empty; a check-in deadline before the plan deadline is accepted. Deadlines are reminder triggers only; the form copy implies enforcement.
Fix: require `checkinDeadline > CHECKIN_START`. → validation in **spec 03**; showing deadlines left open

### F8. Lock-in can publish a half-loaded day — medium — possible
Where: `DayPlanner.tsx:663-665` gates the card on `isToday && challengeActive && challengeSummary`, not `!isHydrating`; `useChallengeSync` is gated (:225).
Scenario: tap "Lock in" during hydration → an empty Top 3 is stamped with `planSetAt`, and the first lock-in is never overwritten (:433).
Fix: disable the acts while hydrating. → **spec 03**

### F9. Review: joint streak is 0 for any past week; denominators overcount — medium — confirmed
Where: `ChallengeReviewSection.tsx:271,281-283`.
Scenario: for a past week `until = weekEnd` but `jointStreak(…, today, …)` counts back from today, so it reads 0; `elapsed` counts week days before `startDate`, after `endDate`, and today itself.
Fix: streak up to `min(today, weekEnd)`; intersect `weekDates` with the span. → **spec 03**

### F10. Stale-device summary overwrites a newer one — low — possible
Where: `convex/challenges.ts:176` patches `summary` with no client timestamp; `useChallengeSync.ts`. Unlike `plannerDays` there is no `isStaleWrite` guard. → open

### F11. The planner syncs the browsed day, not only today — low — confirmed
Where: `DayPlanner.tsx:225` (`date: selectedDay`); `convex/challenges.ts:415`.
Scenario: browsing a future day inside the season creates an empty-summary row; editing a past day rewrites that day's partner-visible summary after the check-in. No server or client check against local today.
Fix: server restricts `syncDaySummary` / `lockInPlan` / `checkIn` to the member's local today ± 1. → **spec 03**

### F12. A Top 3 can still change after "Plan locked" — low — confirmed
`planSetAt` is a timestamp only; the partner sees live edits; an empty plan can be locked. Possibly intended. → open (design)

### F13. Default display names from a long email prefix bypass `maxLength` — low — likely
Where: `ChallengePage.tsx:89`, `ChallengeJoinPage.tsx:182`; server limit 40 (`challenges.ts:156`). Fix: slice the default to 40. → **spec 03**

### F14. Join page edge cases — low — confirmed
Where: `ChallengeJoinPage.tsx`: :215 waits on `loading` but not `mine.status === "loading"` (form can show for someone already in a challenge); stored token (:173) cleared only on success (:193) so an abandoned token resurfaces on bare `/challenge/join`; a member revisiting their own accepted link sees "already used" (server order `challenges.ts:286`). → **spec 03**

### F15. Timezone refresh only in-range and via the planner — low — confirmed
`syncDaySummary` returns before refreshing the timezone when the date is outside the span (:415-419); only the planner runs `useChallengeSync`. → open

### F16. `ChallengeReviewSection` freezes the partner's date — low — confirmed
`useState(() => Date.now())` never ticks (:267-268). → **spec 03**

### F17. Reminder spacing can delay the first check-in email — low — possible
`lastAt` shared between plan and check-in reminders (`challengeReminders.ts:74,79`); a plan reminder after 20:00 can push the 21:30 check-in email by up to 30 min. → open

### F18. The nudge ignores the challenge span — low — confirmed
`convex/challenges.ts:487-491` has no `inRange` check; a nudge can email about a day outside the season and write a row outside the span. → **spec 02**

## Checked and sound
- `upsertDay` cannot clear `planSetAt`, `checkinAt`, `note`, `dontsBroken`, `nudgeSentAt` or `remindersSent` (:176); inserts carry every required field (:179-188, `challengesInternal.ts:101-109`).
- `checkIn` with an empty note removes a stale note (:467-469); first `checkinAt` preserved (:461). `lockInPlan` idempotent (:433).
- Mutations are serialised, so `upsertDay`'s read-then-insert cannot duplicate rows.
- `localDateAndMinutes` reads the offset at the instant (DST test at `challengeReminders.test.ts:28`); `localDateIn` falls back on a bad timezone. `challengeProgress` uses UTC day arithmetic.
- `invitePreview` covers every state; `acceptInvite` returns early for an existing member (:377); `leaveChallenge` ends only when the last member leaves; a leaver rejoins only through a new invite.
- `?invite=` used consistently; token survives sign-up via `sessionStorage`.
- Cron decides and records in one transaction; `everyonePastEnd` correct across timezones; count caps correct.
- Partner view never exposes `userId` or `nudgeSentAt` (test :213-219).
- `useChallengeSync`: one request in flight, dirty re-run, gated on `!isHydrating`, payload dedupe, foreground retry.
- Keys and `aria-label`s in `HistoryGrid`, `ListEditor`, `MemberDayCard`.

## Nudge diagnosis
The second nudge on the same nudger-local day throws `Error("You have already nudged them today")` at `convex/challenges.ts:494`. The once-a-day rule is keyed on the nudger's own local date (`me.timezone`, :492-493); whether the partner owes anything is judged on the partner's clock (:487-490). The check at :491 fires first if the partner has meanwhile locked in or checked in, and also when the device's and the partner's idea of "evening" disagree (F2). The client renders the error as `<p role="alert">` (:172-176), the button stays enabled, and in production the text is redacted to "Server Error" (F1). `nudgeSentAt` is never reset except by a new local day; it is on the client in `mine` but unused; it is stamped before the email is attempted (F3). One nudge per nudger-local day regardless of kind, so a morning plan nudge blocks the evening check-in nudge.
