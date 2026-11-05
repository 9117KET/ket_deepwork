# Spec 03: "Just me" challenges, the days-left headline and the live countdown (client)

*Run:* `docs/00-orchestration/runs/2026-11-05-solo-countdown/` · *Builder:* builder (Opus) · *Worktree:* yes, from `main`, then **first step** `git merge run/2026-11-05-solo-countdown` (it carries specs 01 and 02) ·
*Time box:* 90 minutes of agent work

## Goal
A person can start a challenge for themselves alone and run it with no partner talk anywhere: the create page offers "Just me", the detail page never says "Nobody has joined yet", the Today block and the list say "Just you", and one quiet "Invite a partner" action keeps the door open. Every running challenge shows how many days are left as its headline, and under it a live countdown, to the second, to the next thing the viewer owes today (lock in, then check in), on their own clock. The Today block shows the same countdown to the minute. This is UI work: the three design skills apply.

## Inputs (read all of these first)
- `C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-05-solo-countdown\02_COMMON.md`: setup, the contract, and the fixed words (section "Client").
- Design skills, in this order, as the user's global `CLAUDE.md` requires for every UI task:
  - `~/.claude/skills/frontend-design/SKILL.md`: plan tokens, type and layout for the headline before building; its writing rules apply to every string you add (sentence case; a button says what happens).
  - `~/.claude/skills/apple-design/SKILL.md`: load its always-load set plus the pages for what is on screen (segmented controls or radio groups, typography for a large numeral, live content). Cite `file.md › Heading` in your report for the two or three rules that shaped the headline and the countdown.
  - `~/.claude/skills/web-design-guidelines/SKILL.md`: run it over your changed files before you report; list its `file:line` findings and what you did with each.
- `CLAUDE.md`: "Accountability challenge" (routes, sheets, cyan only for the one primary, `share.done` for done), "Responsive foundations" (44px targets, `dvh`, coarse pointer rules). Spec 01 added a paragraph on `solo`; read it.
- `docs/00-orchestration/runs/2026-11-02-duration-dnd-multichallenge-design/scout-design-review.md` (main tree): the design rules the challenge screens were rebuilt to. The headline must sit inside them.
- `src/domain/challengeCountdown.ts` and its test (spec 02): the functions you render. Do not change their words.
- `src/hooks/useSecondTick.ts` (spec 02).
- `src/pages/ChallengeCreatePage.tsx`: step 1 (name, length, deadlines) and step 2 (goals, don'ts, display name under "Advanced"). The create call is at ~line 115.
- `src/services/challengeService.ts`: `CreateChallengeInput` and `createChallenge` (~line 55).
- `src/components/challenge/ChallengeDetail.tsx`: header and `meta` (~line 215), the Today surface (~line 248 to 340, the partner slot with "Nobody has joined yet" at ~line 320), head to head (~line 346), leave copy (~line 212), the `useMinuteTick` call (~line 110).
- `src/components/challenge/ChallengeTodayBlock.tsx`: `TodayChallengeRow` (~line 133), status line at ~line 144.
- `src/pages/ChallengeListPage.tsx`: `ActiveRow` (~line 113), "Waiting for a partner" at ~line 139.
- `src/pages/AdminChallengesPage.tsx`: the Members cell.
- `src/components/challenge/SeasonGrid.tsx` and `ChallengeReviewSection.tsx`: already handle `partner === null`; confirm, do not change unless a solo string is wrong.
- `src/domain/challengeList.ts` and its test: where any new pure string helper goes, with a test.
- `e2e/challenge-guest.spec.ts`: what e2e can reach (guests only; the create page shows the sign-in form to a guest, so the "Just me" control cannot be reached by e2e; say so in the report rather than faking it).

## Deliverables (exact paths)
- `src/pages/ChallengeCreatePage.tsx`: in step 1, under the name, a two-option choice **"With a partner"** / **"Just me"** (same radio-as-segment pattern as "How long"; default "With a partner"). Helper text under the choice when "Just me" is chosen: "You can invite someone later." Step 2 copy adapts: the goals and don'ts helper loses "Your partner can read these," for solo; the display-name label under Advanced reads "Your name" with the helper "Shown to a partner if one joins." The create call sends `solo: true` only when chosen.
- `src/services/challengeService.ts`: `CreateChallengeInput.solo?: boolean`.
- `src/components/challenge/ChallengeDetail.tsx`:
  - **Headline.** Between the title and the existing `meta` line, while the challenge is not read-only: the days-left headline from `daysLeftHeadline(progress, challenge, myDate)`: the number large (the biggest type on the challenge screens; pick the token from the design review, not a new one), the label beside or under it in the body style; when `number` is null the label alone in the section-heading style. Under it, one line from `countdownLine(state, challenge, true)` in a `<p role="timer">` with `tabular-nums`, where `state = countdownState({ nowMs, todayIso: myDate, planDeadline, checkinDeadline, planSetAt, checkinAt, running })`. `nowMs` comes from `useSecondTick(running && state is lock or checkin)`. Keep `useMinuteTick` for everything that already uses it. The `meta` line stays as the quiet line it is.
  - **Solo.** When `challenge.solo && !partner`: the partner slot shows no heading and no sentence about sending a link; it shows one quiet text action **"Invite a partner"**, which reveals the existing invite UI (the link box and "Create invite link" / "Share link" button) in place. The head-to-head section is titled **"Your season"** and has only your row. The Share action still works (it shares your plan or check-in text). Nudge is not rendered (there is no partner). Leave copy for a solo creator stays "Leaving ends this challenge. Your days stay recorded."
  - When `challenge.solo` is false and there is no partner, everything stays exactly as today.
- `src/components/challenge/ChallengeTodayBlock.tsx`: the row's status becomes `[who, countdown]` joined by " · " where `who` is `"Just you"` for solo, else the partner mark as today, else "Waiting for a partner"; and `countdown` is `countdownLine(state, challenge, false)` (minute precision, driven by the existing minute tick; add a `useMinuteTick` if the block has none) replacing `owedLabel(owed)`. When `countdownLine` returns null (not running) keep today's "Starts …" / "Ended" text.
- `src/pages/ChallengeListPage.tsx`: `ActiveRow` shows **"Just you"** instead of "Waiting for a partner" when `challenge.solo`; the day line becomes "Day 22 of 92 · 70 days left" (use `daysLeftHeadline` to get the words: "70 days left", "1 day left", "Last day").
- `src/pages/AdminChallengesPage.tsx`: "Solo" in the Members cell, as a quiet caption under the list, when `r.solo`.
- `src/domain/challengeList.ts` + `src/domain/challengeList.test.ts`: any new pure helper (for example the Today row's `who` word) with a test. The `challengePillLabel` in the day header is unchanged.
- `CLAUDE.md`: in "Accountability challenge", extend the solo paragraph with the client words ("Just me", "Just you", "Invite a partner") and add two or three sentences on the headline and the countdown: which module computes it, that the detail page ticks per second via `useSecondTick` only while a deadline is ahead and the tab is visible, that the Today block is minute-precise, and that `role="timer"` keeps screen readers quiet.

## Acceptance criteria (each one checkable by a scout)
1. Step 1 of `/challenge/new` renders a radio group with the two options "With a partner" and "Just me", "With a partner" checked by default, 44px tall options, keyboard-operable, with a `<legend>`. Choosing "Just me" shows "You can invite someone later." The create call carries `solo: true` only then (grep the file for `solo:`).
2. On a solo challenge with no partner, the detail page's HTML contains "Invite a partner" and does not contain "Nobody has joined yet" or "Send your partner a link"; the head-to-head heading reads "Your season" and has one row; no Nudge button renders. On a two-person challenge with no partner, the page is byte-for-byte as before in that slot ("Nobody has joined yet" and the link text).
3. The headline renders `daysLeftHeadline`'s number and label on every running or upcoming challenge, and not on an ended one. The countdown `<p>` has `role="timer"` and its text is exactly `countdownLine(state, …, true)`.
4. The per-second tick is only armed while the state is `lock` or `checkin` (read the `useSecondTick(active)` call: `active` is false for `done`, `closed`, `idle`). No other component gains a per-second interval.
5. The Today block row reads "Just you · Lock in by 10:00 · 2h 14m left" (solo, plan not locked) and "Sam ✓ locked in · Check in by 23:59 · 5h 2m left" (two-person); the old `owedLabel` words are gone from that row but `owedLabel` itself stays in `challengeList.ts` (other callers).
6. The list's active row reads "Day 22 of 92 · 70 days left" and shows "Just you" for a solo challenge.
7. The admin table shows "Solo" for a solo row.
8. `npx tsc -b`, `npm run lint`, `npm test`, `npm run test:convex`, `npx vite build` all clean; `npx playwright test e2e/challenge-guest.spec.ts --reporter=line` passes (it needs the Vite dev server: run it with `npx vite --port 5191 --strictPort` in the background and a scratch config copied from `playwright.config.ts` with `baseURL` and `webServer.url` on 5191 and `reuseExistingServer: false`, placed untracked at the repo root of your worktree as `playwright.sup5191.config.ts`; delete it before you report).
9. `web-design-guidelines` ran over the changed `.tsx` files; every finding is listed in the report as fixed or as deliberately kept with a reason.
10. Every new string is sentence case and in the fixed words from `02_COMMON.md`; no new colour outside the existing `share.*` tokens; cyan is still only the one primary button on challenge screens.
11. No change under `convex/` and no change to `src/domain/challengeCountdown.ts` or `src/hooks/useSecondTick.ts` (`git diff --stat main..HEAD` after your merge shows those only from the run branch's commits, not yours; simplest: `git diff --stat run/2026-11-05-solo-countdown` shows only your files).

## Constraints
- Project rules from `CLAUDE.md` apply, including the sheet, button and 44px rules.
- Do not rename or re-word anything from `challengeCountdown.ts`; the words are tested there.
- Do not touch `DayHeader`'s pill or `challengePillLabel`.
- The headline must not push the Today surface below the fold on a 390×844 phone: number and label on one line (number first), countdown on the next; check in the browser at that viewport with Playwright's `devices['iPhone 14']` or the dev tools and put the measured height of header + headline + countdown in the report.
- Edit with the Edit tool, never `sed`.
- First command in your worktree: `git merge run/2026-11-05-solo-countdown` (no conflict expected; if there is one, stop and report).

## Out of scope
- Any backend change (spec 01 did it).
- A standalone countdown to a date.
- Sounds or notifications when a deadline passes.
- Restyling anything the spec does not name.

## Verification the builder must run
- `git merge run/2026-11-05-solo-countdown` (first), then the junction for `node_modules`.
- `npx tsc -b`, `npm run lint`, `npm test`, `npm run test:convex`, `npx vite build`.
- `npx playwright test e2e/challenge-guest.spec.ts --config playwright.sup5191.config.ts --reporter=line` with the Vite server on 5191 as described; then kill the server and delete the scratch config.
- The `web-design-guidelines` skill over the changed `.tsx` files.
- `git diff --stat run/2026-11-05-solo-countdown`.

## Report to
Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`. The supervisor files it as `report-03-round1.md`. Include: the HIG citations, the web-design-guidelines findings table, the measured phone header height, and the exact test tails.

## Notes added after specs 01 and 02 (read these too)
- Spec 01 also made `dayCards`, `todayCards` and `history` return `challenge: challengeView(...)`. You may read `solo` from `entry.challenge` (as `myChallenges` returns it) or from those; do not add a new lookup.
- `owedAct` in `challengeList.ts` says "lock" when a check-in exists without a plan; `countdownState` says `done`. In the Today row the countdown line wins ("Done for today"). Leave `owedAct` as it is.
- `src/hooks/useWorkLog.test.ts` fails to load in a worktree without `.env`. Run unit tests as `VITE_CONVEX_URL=https://example.convex.cloud npx vitest run`; that is not a failure of yours. Baseline on the run branch is 25 files, 366 tests; convex 15 files, 180 tests.
