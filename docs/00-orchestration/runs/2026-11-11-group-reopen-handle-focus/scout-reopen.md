# Scout: how a challenge ends and what a reopen must do (Mode A, read-only, 2026-11-11)

Condensed by the supervisor; `leaveChallenge`, `deleteChallenge` and the sweep were re-read by
the supervisor at `cae99e5`.

## The five ways a challenge ends (each one patch on `challenges`; nothing else is touched)

| Where | `endedReason` |
|---|---|
| `leaveChallenge`, creator, `convex/challenges.ts:1001-1004` | `creatorLeft` with a partner, else `allLeft`. Both member rows kept |
| `leaveChallenge`, last non-creator, `:1006-1008` | `allLeft`. The leaver's row is deleted first |
| `challengesInternal.endChallenge`, `convex/challengesInternal.ts:102-107` | `manual` (internal, no app caller) |
| season-over sweep, `challengesInternal.ts:146-150` | `seasonOver`; any `warning` left on the row |
| inactivity close, `challengesInternal.ts:185-189` | `inactive`; `warning` left on the row as the record |

Written: `status`, `endedReason`, `endedAt`. `deleteChallenge` (`challenges.ts:1023-1047`)
requires `ended` and purges everything.

## What a non-creator leaving loses today

`ctx.db.delete(me._id)` (`:1006`) removes `displayName`, `timezone`, `joinedAt`, `joinedDate`,
`lastActedAt`, and the goals and don'ts with their ids. Their `challengeDays` rows stay
(keyed `challengeId, userId, date`) but nobody can read them, and their `dontsBroken` and
`goalsKept` ids resolve to no text. Rejoining by invite inserts a fresh row (`:836-846`): the
old days are found again, the lists and name are not.

## Guards

`requireMember(..., { write: true })` refuses an ended challenge ("This challenge has ended",
`:171`): `createInvite :794`, `updateMyCommitments :912`, `updateSpan :942`,
`renameChallenge :979`, `leaveChallenge :999`, `lockInPlan :1095`, `checkIn :1141`,
`markDay :1182`, `nudgePartner :1221`. Also `acceptInvite :825`; `lockInPlan` without an id and
`syncDaySummary` go through `activeMemberships` (`:135`, `:1063`); `assertBelowCap :175-179`.

Reads that accept an ended one: `myChallenges :484-495`, `dayCards :502`, `history :573`,
`adminListChallenges :677`. `todayCards` skips it (`:549`). `allMemberships` reads only the
newest 50 member rows (`:54,120`), so a very old ended challenge is not listed.

## What would end a reopened challenge again

1. **Season over** (`challengesInternal.ts:146-148`): every member's local today is past
   `endDate`. `updateSpan` has the check a reopen needs (`challenges.ts:946-948`) but refuses a
   non-active challenge. `assertSpan` (`:370-387`) caps a span at 366 days from the start.
2. **Inactivity** (`challengesInternal.ts:152-190`, `convex/_shared/challengeInactivity.ts:39-98`):
   `countableDates(joinedDateOf(member), startDate, today, CLOSE_AFTER_DAYS)` looks back four
   full local days from today, no earlier than the later of join and start. A day with no row
   is missed, so the closed gap counts. A reopened challenge would warn within 15 minutes and
   close about a day later; a stale `warning` left on the row makes it close sooner.
3. **Cap**: `assertBelowCap` is checked on create and join only.
4. **Banner**: the client hides the warning only while ended (`ChallengeDetail.tsx:309`).

## Client

- `src/components/challenge/ChallengeDetail.tsx:98` `readOnly = detail.status === 'ended'`;
  everything hangs off it (`:284,286,288,306,309,316,514,525`); creator-only Delete at
  `:532-538` with `deleteOpen` / `remove` (`:106-108,245-255`). A Reopen action sits beside it.
- `src/hooks/useChallenges.ts:70,97-122`: status comes from `myChallenges`; a patch flips both
  clients live.
- `src/pages/ChallengeListPage.tsx:44,85-91,159`; ended sentences in
  `src/domain/challengeList.ts:183-199`.
- `src/services/challengeService.ts:132-135`: `deleteChallenge` wrapper; a reopen wrapper goes
  beside it.

## Existing tests on ending

`convex/challenges.test.ts:271-293`; `convex/challengesMulti.test.ts:209,227-259,291-316`;
`convex/reminders.test.ts:111,121`; `convex/challengeInactivity.test.ts:100,144,190,202`;
`convex/_shared/challengeInactivity.test.ts`; `src/domain/challengeList.test.ts:100`. None
covers a reopen.
