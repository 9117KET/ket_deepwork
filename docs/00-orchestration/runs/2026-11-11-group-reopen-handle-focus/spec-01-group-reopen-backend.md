# Spec 01: group challenges and reopening, backend

*Run:* `docs/00-orchestration/runs/2026-11-11-group-reopen-handle-focus/` · *Builder:* builder ·
*Worktree:* yes · *Playwright:* not needed · *Time box:* 150 minutes of agent work

## Goal

The Convex backend lets up to eight people share a challenge, lets the creator reopen an ended
one with everything it recorded intact, and never deletes what a member recorded when they
leave or drop out. The client that is live today keeps working against it unchanged, because
this backend is deployed before the new client exists.

## Inputs (read all of these first)

- `02_COMMON.md` (run folder): setup, rules, checks, report.
- `03_CONTRACT.md` (run folder): **the specification.** Schema, shapes, mutations, sweep,
  sentences, privacy.
- `00_BRAIN_DUMP.md` (run folder): the user's decisions.
- `scout-two-member.md`, `scout-reopen.md` (run folder): every site with line numbers, the
  shapes today, the tests that pin two members, the traps of a reopen.
- `scout-sweep.md` (run folder), findings 3 and 5: yours to fix.
- `convex/_generated/ai/guidelines.md`, then `convex/challenges.ts`,
  `convex/challengesInternal.ts`, `convex/reminders.ts`, `convex/email.ts`, `convex/schema.ts`,
  `convex/_shared/challengeValidators.ts`, `convex/_shared/challengeInactivity.ts`,
  `convex/_shared/challengeNudges.ts`, `convex/_shared/challengeReminders.ts`, and every
  `convex/challenge*.test.ts` and `convex/reminders.test.ts`.
- `CLAUDE.md` "Accountability challenge".

## Deliverables

- The files above, changed to the contract. Files under `convex/` and its tests only.
- New test files (new files, so they merge): `convex/challengeGroups.test.ts`,
  `convex/challengeReopen.test.ts`, and unit tests beside any new pure rule in
  `convex/_shared/`.
- `CLAUDE.md` "Accountability challenge": every sentence your change makes false, corrected
  (two members, leaving, inactivity, nudges, invites, the new mutation, the deploy order).
- `docs/DEPLOYMENT.md`: a short paragraph naming this as a backend-first deploy and why the
  live client is safe in between.

## Acceptance criteria

Each has at least one test in `npm run test:convex`; name the test in the report.

**Groups**
1. Eight people can be in one challenge; the ninth is refused by `acceptInvite` and
   `createInvite` with "This challenge is full (8 members)", and `invitePreview` says `full`.
2. With four members, `myChallenges` returns for each viewer `others` with the three others in
   join order, `partner` equal to `others[0]`, `memberCount` 4, `capacity` 8, and an `invite`
   while seats remain.
3. `dayCards`, `todayCards` and `history` return `others` per the contract, each member read at
   their own date from `otherDates` / `otherToDates`, and `partner` exactly as before.
4. Called with today's arguments only (no `otherDates`, no `memberKey`), every function
   returns everything it returns today with the same types. A test calls each public function
   the way the live client does (`src/services/challengeService.ts` and
   `src/hooks/useChallenges.ts` on `main` show the calls) on a two-member challenge and
   asserts the old fields.
5. No other member's `userId`, email, `remindersSent`, `nudgesSentAt` or `nudgesByMember`
   appears anywhere in any return, for any of four members viewing any other. `DayView` keeps
   its exact key set.
6. A member of challenge A learns nothing about another member's challenge B (the existing
   privacy tests still pass, extended to a group).
7. A nudge with `memberKey` reaches that member only; three a day and an hour apart are judged
   per target; a nudge without `memberKey` behaves as today; a key from another challenge is
   refused with "They are not in this challenge".

**Leaving and returning**
8. A non-creator leaving keeps their row (`leftAt`, `leftReason: "left"`); they no longer see
   the challenge; the others no longer see them; their `challengeDays` rows are untouched.
9. They accept a new invite: the same row is active again with the same name, goals, don'ts
   and ids, `joinedDate` is their today, and their old days are back in `history`.
10. The creator leaving a group of three: the challenge stays active, the earliest-joined
    remaining member has `isCreator: true` and can `updateSpan`; the old creator cannot.
11. The last active member leaving ends it `allLeft`, keeps their row active, and they can
    still read it.

**Inactivity**
12. Three active members, one quiet: warned on the day today's rule warns; on the day today's
    rule would close, that member is dropped (`leftReason: "inactive"`), the challenge is
    still active, the warning is gone, and each of the three got exactly one "dropped" email.
13. The dropped member was the creator: the challenge has a new creator.
14. Two active members, one quiet: closes `inactive` exactly as today (existing tests pass
    unchanged).
15. The sweep handles a challenge of eight (every member gets their own plan reminder).

**Reopen**
16. The creator reopens a challenge that ended `inactive`, `seasonOver`, `allLeft`, `manual`
    and legacy `creatorLeft`: it is active, `endedReason`, `endedAt` and `warning` are gone,
    every member row and every `challengeDays` row is byte-for-byte what it was.
17. A non-creator is refused; a running challenge is refused; a creator at 20 active
    challenges is refused, each with the contract's sentence.
18. End date in the past and no `endDate`: refused with code `needsEndDate`. With a valid
    `endDate`: reopened, `endDate` stored. More than 366 days from the reopen day: refused. A
    season whose original start is more than 366 days before the new end is accepted.
19. After a reopen, the sweep run at once, and on each of the next three days with nobody
    acting, neither warns nor closes; a member quiet for the rule's full run after the reopen
    day is warned as usual.
20. `closedSpans` records the closed stretch per the contract; a reopen the same day it ended
    records none; `challengeView` returns `reopenedDate` and `closedSpans`.
21. Every other active member gets exactly one "running again" email on a reopen, the reopener
    none, and with `EMAIL_DELIVERY=off` none is sent.
22. A challenge deleted while ended cannot be reopened ("This challenge no longer exists" or
    the not-a-member sentence).

**Sweep findings**
23. The check-in reminder's subject and body name the challenge's check-in deadline (for
    example "Check in before 22:00") and never say "midnight" unless the deadline is 23:59 or
    later; you decide the wording for 23:59 and say so.
24. `updateSpan` refuses to move the start past the first day that holds a mark, with the
    sentence saying so, and past the first closed span.

**Whole**
25. `npm run lint`, `npx tsc -b`, `npm test`, `npm run test:convex`, `npx vite build` pass. The
    client under `src/` is **not** edited and still type-checks against the new backend types.
26. Every existing test you changed is listed with the reason. A test that pinned "two
    members" is rewritten to the new rule, not deleted.

## Constraints

- Convex guidelines apply: bounded reads (`.take`, indexes, no unbounded `.collect()` on a
  growing table), validators on every arg, `internal*` for anything not public.
- No existing field retyped, renamed or removed; no existing arg made required.
- `challengeDays` rows are never deleted or rewritten by anything here.
- Pure rules go in `convex/_shared/` with unit tests, like `challengeInactivity.ts`.
- Do not edit anything under `src/`, `e2e/` or `.github/`. If a client type breaks, the
  contract has been broken; fix the backend.
- Do not run `npx convex dev` or `npx convex deploy`. `convex-test` runs everything locally.
- If `convex/_generated/` needs regenerating for a new function and cannot be regenerated
  without a deploy, say so in the report; the types are `typeof`-based and normally need no
  regeneration.

## Out of scope

- Any client work (spec 02 follows yours).
- More than one warning at a time; roles beyond creator; a member removing another member.

## Verification the builder must run

The checks in `02_COMMON.md`. No Playwright.

## Report to

Your final message; the supervisor files it as `report-01-round1.md`. Include a list of
contract gaps you hit and how you resolved each.
