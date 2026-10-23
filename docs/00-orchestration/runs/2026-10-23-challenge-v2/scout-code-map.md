# Scout: code map for challenge commitments and nudges (2026-10-23)

*Filed by the supervisor from the scout's final message. Read-only; nothing was run.*

## A. Goals / don'ts / dont ids

Backend:

| file:line | symbol | reads/writes | challenge-level? | note |
|---|---|---|---|---|
| convex/schema.ts:163-164 | `challenges.goals`, `challenges.donts` | table definition | YES | Goals are plain strings with no id. Donts are `{id,text}`. |
| convex/_shared/challengeValidators.ts:16 | `dontValidator` | `v.object({ id, text })` | n/a | |
| convex/schema.ts:176-184 | `challengeMembers` | `challengeId,userId,timezone,displayName,joinedAt` | n/a | No goals/donts fields yet. Indexes `by_user`, `by_challenge`. |
| convex/schema.ts:206-207 | `challengeDays.dontsBroken` | stores dont ids | comment says "Ids from `challenges.donts`" | |
| convex/schema.ts:210 | `challengeDays.nudgeSentAt` | nudge bookkeeping | n/a | See B. |
| convex/challenges.ts:99-112 | `challengeView` | reads `c.goals`, `c.donts` | YES | Feeds `myChallenge().challenge`. |
| convex/challenges.ts:114-116 | `memberView` | `{displayName,timezone,joinedAt}` | n/a | Adding lists here changes `ChallengeInfo.me` / `.partner` types automatically. |
| convex/challenges.ts:119-129 | `dayView` | `dontsBroken: row.dontsBroken` (:127) | n/a | Partner card in `dayCards` and both members in `history`. |
| convex/challenges.ts:30-31, 144-151 | `MAX_LIST=10`, `MAX_ITEM=200`, `cleanList` | validates and trims | n/a | Only `createChallenge` uses it. Drops blank items, keeps order. |
| convex/challenges.ts:274-293 | `invitePreview` | `{name,startDate,endDate}` + `inviterName` | NO | Never exposes goals or donts. |
| convex/challenges.ts:297-344 | `createChallenge` | args `goals`, `donts` (:302-303); `cleanList` :325-326; ids minted :328 `dont-${now}-${i+1}`; lists on the `challenges` row :333-334; member insert :341 carries none | YES | |
| convex/challenges.ts:364-388 | `acceptInvite` | inserts member (:384) | n/a | Joiner has no lists today. |
| convex/challenges.ts:441-472 | `checkIn` | validates `dontsBroken` against `challenge.donts` :455-458 ("Unknown don't"); dedupes :459 | YES | |
| convex/challenges.ts:165-190 | `upsertDay` | new rows `dontsBroken: []` (:185) | n/a | |
| convex/challengesInternal.ts:107 | `claimDueReminders` | inserts rows with `dontsBroken: []` | n/a | |
| convex/reminders.ts:35 | reminder body | "own up to any don'ts" | generic | `convex/email.ts` has no mention. |

Client:

| file:line | symbol | reads/writes | challenge-level? | note |
|---|---|---|---|---|
| src/services/challengeService.ts:37-38, 46-48 | `CreateChallengeInput.goals/donts` | pass-through | YES | |
| src/services/challengeService.ts:72 | `checkIn` arg `dontsBroken` | | | |
| src/components/challenge/ChallengeCreateForm.tsx:74-75, 87, 127, 132 | `goals`/`donts` state, `ListEditor` (`idPrefix` "goal"/"dont") | no client-side count/length validation on submit (:87); server does it | YES | `ListEditor` defined above :60 in the same file. |
| src/components/challenge/ChallengeDashboard.tsx:99, 101 | `MemberDayCard donts={challenge.donts}` | same list to both cards | YES | |
| src/components/challenge/ChallengeDashboard.tsx:122-150 | "Goals and don'ts" section | `challenge.goals` (:128, keyed by index), `challenge.donts` (:141); hidden if both empty | YES | Not editable. |
| src/components/challenge/MemberDayCard.tsx:22, 29, 46, 48 | `dontsBroken`, `donts` prop | unknown id → literal "a don’t" | YES | |
| src/components/challenge/CheckinSheet.tsx:17, 26, 28, 54, 70, 106-112 | `donts` prop | checkbox list; submits ids (:54); share text maps unknown to `''` (:70) | YES | |
| src/components/challenge/ChallengeCard.tsx:70 | share text | `info.challenge.donts.find(...)?.text ?? ''` | YES | Unknown id → "Broke: , x". |
| src/components/challenge/ChallengeReviewSection.tsx:37-40, 70-84 | `brokenCounts` over `myWeek` | resolves via `challenge.donts`; line hidden if `challenge.donts.length === 0` | YES | |
| src/components/challenge/HistoryGrid.tsx | none | `dayCellState` only | n/a | |
| ChallengeJoinPanel.tsx, src/pages/ChallengeJoinPage.tsx | none | join page shows name and dates only (:111-113) | n/a | |
| src/pages/ChallengePage.tsx:117 | `CheckinSheet donts={state.info.challenge.donts}` | | YES | |
| src/components/planner/DayPlanner.tsx:849 | `CheckinSheet donts={challenge.info.challenge.donts}` | | YES | Second mount. |
| src/domain/challenge.ts:46, 126, 148 | `ChallengeDayLike.dontsBroken?`, `buildShareText` takes text | | n/a | No change needed. |
| src/pages/PrivacyPage.tsx:48 | "Challenge data" bullet | "its name, dates, goals and don'ts" | stale once per-member | |

### Client type derivation
- `ChallengeInfo = NonNullable<FunctionReturnType<typeof api.challenges.myChallenge>>` (src/hooks/useChallenge.ts:17); `ChallengeDayCards` from `dayCards` (:18); `ChallengeHistory` from `history` (:19). `ChallengeState.mine` is `ChallengeDayCards["mine"]`, `partnerCard` is `["partner"]` (:30-31).
- No hand-written `MemberDayView` type apart from the local interface in `MemberDayCard.tsx:22`; `ChallengeDayLike` (domain/challenge.ts:41-47) is a structural subset. `dayView` exports `ChallengeDayView` (challenges.ts:130).
- Changing `challengeView`, `memberView` or `dayView` changes the client types automatically. `MemberDayCard`, `CheckinSheet` and `ChallengeCard` take `{id,text}[]` and are the compile-time break points. `challengeService.ts` imports `api` from `convex/_generated/api`, so stale `_generated` gives stale types.

## B. Nudge path
1. ChallengeCard.tsx:57-61 `nudge` → `run('nudge', …)` → `nudgePartner()`; success notice `Nudged ${name} by email.` (:60).
2. ChallengeCard.tsx:43-54 `run`: catch → `setError(challengeErrorMessage(e))`, rendered at :172-176 as `text-share-tertiary role="alert"`. This is the red error.
3. Button :165-169, rendered only when `partner && partnerOwes && progress.phase === 'active'`; `disabled={busy === 'nudge'}`; label `Sending…` / `Nudge`.
4. `partnerOwes` (:77) = `!(partnerCard?.checkinAt || (partnerCard?.planSetAt && !isEvening()))`; `isEvening()` (:187-190) uses the **viewer's** device clock (≥ 21:30). The server judges on the partner's clock, so the two can disagree. Card is mounted in ChallengePage and DayPlanner (`compact`).
5. challengeService.ts:77-79 `nudgePartner()` → `convex.mutation(api.challenges.nudgePartner, {})`, returns void.
6. convex/challenges.ts:479-508 `nudgePartner`: :484-485 "Nobody has joined yet"; :487-491 partner local date/minutes, `evening = minutes >= CHECKIN_START`, `owes`; not owed → "They have already checked in" / "They have already locked in their plan"; :492-494 nudger's own row on the nudger's local date, `nudgeSentAt` → **"You have already nudged them today"** (the once-a-day rule); :495-497 partner email via `normalizeId("users")`; :498-499 upsert own row with `emptySummary()` and patch `nudgeSentAt: now`; :501-505 `scheduler.runAfter(0, internal.email.sendEmail, {to, subject, text})`, link `${SITE_URL}/challenge`.
7. `internal.email.sendEmail` in convex/email.ts (`"use node"` nodemailer).

Client knowledge of today's nudge: `dayCards` returns `mine: mine ?? null` (:234), the **raw** `challengeDays` doc including `nudgeSentAt`, `remindersSent`, `userId`. No client code reads `nudgeSentAt`. Partner side is `dayView`, which omits it; test challenges.test.ts:219 asserts the partner view lacks `nudgeSentAt`.

Shapes differ: `mine` is the full `Doc<"challengeDays">` (`planSetAt`/`checkinAt`/`note` undefined when absent); `partner` is `dayView` (null when absent, no `nudgeSentAt`).

Caveats: allowance keyed on the nudger's local date while "owes" is on the partner's; a nudge creates a nudger row with an empty summary; existing tests expect once-a-day.

## C. Harness
- Scripts (package.json:14-21): `test` = `vitest run` (vitest.config.ts: node, `src/**/*.test.ts`); `test:convex` = `vitest run --config vitest.convex.config.ts` (edge-runtime, `convex/**/*.test.ts`, inlines convex-test) — new `convex/*.test.ts` files are picked up automatically; `test:e2e` = `playwright test --reporter=line`. convex-test ^0.0.53. CI (.github/workflows/ci.yml:22-28) runs only lint and build.
- Setup block convex/challenges.test.ts:7-43: `convexTest(schema, modules)` with `modules = import.meta.glob('./**/*.*s')`; `signUp` inserts a `users` row and uses `t.withIdentity({ subject: \`${id}|s1\` })`; `pair()` creates, invites, accepts (Kin/Berlin, Sam/New York). Direct DB via `t.run`.
- Time (convex/reminders.test.ts): `afterEach(() => vi.useRealTimers())` (:56); `vi.useFakeTimers({ now: at(date, 'HH:MM', tz) })` with `at = zonedWallTimeToUtc(date, hhmm+':00', tz).getTime()` from `./_shared/calendarTime` (:23); `vi.setSystemTime(...)` advances (:166); `await t.finishAllScheduledFunctions(vi.runAllTimers)` (:156).
- Email mock (reminders.test.ts:14-17, 49-54): `vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))`, env `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `SITE_URL` set in `beforeEach`; assertions on `sendMail.mock.calls[0][0]`. challenges.test.ts does not mock email.
- Existing nudge tests to update: reminders.test.ts:150-181 (:162 `/already nudged/i` on the second nudge; :168-170 next-day nudge succeeds; :173-180 `/already locked in/i`); challenges.test.ts:219 (partner view lacks `nudgeSentAt`); :267 unauthenticated rejects.
- Existing goals/donts assertions: challenges.test.ts:22-23, 63-64 (`mine.challenge.goals`, `.challenge.donts.map(d => d.text)`); :162, 187-210 (`checkIn` with 'made-up' rejected, duplicate id deduped, `again?.partner` shape); reminders.test.ts:29-30 (`goals: []`, `donts: ['No doomscrolling']`); src/domain/challenge.test.ts:134 passes dont text to `buildShareText`.
- Codegen: no convex.json, no `codegen` script. `npx convex codegen` is the usual command; whether it works offline here is *to verify* (may need `CONVEX_DEPLOYMENT` from `.env.local`). `convex/_generated/api.d.ts`, `server.d.ts`, `server.js` already show as modified in git status (unrelated).
- E2E gates touching challenge (all guest-only): e2e/mobile-panels.spec.ts:164-178 (`/challenge` and `/challenge/join?invite=x` after `seedRichDay`: tab bar visible, no controls under 44px — these render the signed-out sign-in form); e2e/mobile-responsive.spec.ts:338, 438-452 (same routes, sign-in form 44px); e2e/crawl.spec.ts:473 crawls both routes. No e2e spec mentions nudge, goals or donts; ChallengeCard, ChallengeDashboard and CheckinSheet are never rendered in e2e.

## D. Docs to update
- CLAUDE.md "Accountability challenge": first paragraph ("goals, 'don'ts'"); tables paragraph (`challenges` (span, goals, donts…), `challengeMembers`); `challengeDays` list (no `nudgeSentAt`); reminders paragraph ("`nudgePartner` schedules one email a day"); tests paragraph (new test files).
- docs/data-safety.md: no challenge section; no update strictly required.
- docs/DEPLOYMENT.md:64-82: no challenge-specific two-sided-deploy note; general rule in CLAUDE.md applies.
- src/pages/PrivacyPage.tsx:48 ("its name, dates, goals and don'ts") and :62 ("a nudge your partner may send once a day").
- In-code docs: convex/challenges.ts:1-15 header, :474-478 nudge docblock, schema.ts:206 comment, ChallengeCard.tsx:6-7 header.
- docs/USER_GUIDE.md: no challenge nudge mention.

## Risks the specs should name
1. Legacy data: existing `challenges` rows hold the lists; no member row has them; `dontsBroken` ids point at challenge-level donts. Required new member fields would fail validation on existing rows.
2. Whose list resolves a partner's `dontsBroken`: every client resolver uses the viewer's `challenge.donts` for both people (ChallengeDashboard.tsx:99-101). `memberView` must expose the partner's list, or `dayView` must carry text.
3. `checkIn` validation (:455-458) must switch to the caller's list; deletions need a rule (stable ids, soft delete).
4. Two-sided deploy: `challengeView`/`memberView` shape changes alter client types; a client reading `me.donts` against the old backend gets `undefined`.
5. `createChallenge` signature is used by ChallengeCreateForm.tsx:87, challengeService.ts:46-48 and `pair()` in both test files; `acceptInvite` takes no lists.
6. Nudge keyed on the nudger's own local date; `dayCards.mine` is the only channel for a new field; `partner` must not leak it (test :219).
7. Client `isEvening()` uses the viewer's clock; server uses the partner's timezone. The button's state must come from one source.
8. Nudge tests need `vi.useFakeTimers`, `vi.setSystemTime`, `finishAllScheduledFunctions` and the nodemailer mock from reminders.test.ts, or `sendEmail` will try SMTP.
9. CI runs only lint and build; convex, unit and e2e suites are run by hand; the challenge UI has no e2e gate beyond signed-out 44px checks.
10. Privacy copy and CLAUDE.md assert challenge-level lists and once-a-day nudges.
11. Not verified: `challengeErrorMessage`, convex/email.ts, `challengeReminders.ts` internals, whether `npx convex codegen` works offline.
