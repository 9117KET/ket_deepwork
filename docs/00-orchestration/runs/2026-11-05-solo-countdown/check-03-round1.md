# Check 03, round 1 (scout, Mode B): spec 03 client

Filed by the supervisor from the scout's final message. Worktree `agent-af6c9401b0b4ec83f`, no servers, no edits.

Overall: no FAIL. Criteria 1 to 7 and 11 PASS with file:line; 8 partial (tsc, eslint, both vitest suites clean: 371 unit, 180 convex; vite build and Playwright left to the supervisor); 9 UNCHECKED (findings live in the builder's report).

Findings:
- New user-visible strings, all sentence case: "With a partner", "Just me", "You can invite someone later.", "Shown to a partner if one joins.", "Your name", "Invite a partner", "Your season", "Just you", "Solo". Two not in the contract: the legend "Who is taking part" and the solo helper "Optional. You can change them any time."
- `useSecondTick` is called once (`ChallengeDetail.tsx:144`) with `kind === 'lock' || kind === 'checkin'`; false for done, closed, idle. The arming decision uses the minute clock, so the tick can stay armed up to 60 s past a deadline; the text uses `max(secondNow, now)` and stays right.
- A challenge past its end date whose status is still active is not read-only, so it shows "Season over" and no timer.
- Two-person challenge with no partner: every branch falls through to the old block (`soloAlone = challenge.solo && !partner`; `partnerWho` tested).
- No new colour or type token; nothing under `convex/`, `challengeCountdown.ts` or `useSecondTick.ts`.
