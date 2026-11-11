# Contract: group challenges and reopening (backend ↔ client)

The backend builder (spec 01) implements this; the client builder (spec 02) reads against it.
A builder who finds a gap or a contradiction reports it and proposes the smallest change; it
does not silently depart from the contract.

**The one rule above all:** the client that is live today keeps working against the new
backend, because the backend is deployed first. So every existing argument stays accepted,
every existing return field keeps its name, type and meaning, and new things are **added**
(optional args, extra fields). `partner` in every return stays populated.

## 1. Decisions this implements (from `00_BRAIN_DUMP.md`)

1. Up to 8 members per challenge.
2. Only the creator may reopen an ended challenge.
3. A reopen whose end date has passed needs a new end date from today on; recorded days stay;
   the days it was closed count as missed for nobody.
4. In a group, the creator leaving hands the challenge to the longest-standing remaining
   member; it ends only when the last person leaves.
5. With three or more active members, a member quiet for four days drops out alone (warned on
   day 3 as now); with two or one the challenge closes as today.
6. Nothing a member recorded is ever deleted by leaving, dropping out, ending or reopening.

## 2. Schema (all new fields optional; no migration)

`challengeMembers`
- `leftAt?: number` and `leftReason?: "left" | "inactive"`. A row with `leftAt` is a **former
  member**: kept whole (name, timezone, goals, don'ts, ids), invisible to every read and write
  as a member. "Active member" below means a row without `leftAt`.

`challenges`
- `reopenedDate?: string` (ISO local date of the reopen, on the reopener's clock) and
  `reopenedAt?: number`.
- `closedSpans?: Array<{ from: string; to: string }>` (ISO dates, inclusive): the stretches the
  challenge spent ended before each reopen. `from` is the local date of `endedAt` on the
  reopener's clock, plus one day when a lock-in or check-in exists on that date; `to` is the
  day before `reopenedDate`. A reopen on the day it ended adds no span. Keep at most the
  newest 20.
- `createdBy` may now change (hand-over).

`challengeDays`
- `nudgesByMember?: Record<memberKey, number[]>` on the nudger's own row (see 6).

Shared validators live in `convex/_shared/challengeValidators.ts`, as today.

## 3. Members

- `MAX_MEMBERS = 8`, exported, and one `membersOf` shared by `challenges.ts` and
  `challengesInternal.ts` (no second copy with its own bound). It returns active members
  ordered by `joinedAt` ascending. Former-member rows make the row count exceed 8, so the read
  is bounded by a stated constant (for example 64 rows) and a join is refused when the bound
  is reached.
- `memberKey` is the member row's `_id` as a string. It is the only identifier of another
  member that leaves the server. No `userId`, no email.
- A former member is "not in this challenge" for `requireMember`, `allMemberships` and
  `activeMemberships`, and does not count toward `MAX_ACTIVE_MEMBERSHIPS`.

## 4. Return shapes (additions only)

`memberView` gains `key: string` and `isCreator: boolean`.

`challengeView` gains:
- `memberCount: number`, `capacity: number` (8).
- `warning` gains `memberKey: string` and `displayName: string` (the warned member).
- `reopenedDate: string | null`, `closedSpans: Array<{from, to}>` (empty when none).

`myChallenges` entry gains `others: MemberView[]`: every other active member, `joinedAt`
ascending. `partner` stays: `others[0] ?? null`. `invite` is now returned while the challenge
is active and `memberCount < capacity` (today: only while alone).

`dayCards`
- new optional arg `otherDates?: Array<{ key: string; date: string }>`.
- return gains `others: Array<{ key: string; day: DayView | null }>`, one entry per other
  active member in `others` order. A member with no entry in `otherDates` is read at
  `partnerDate`. `partner` stays: the day of `others[0]` at `partnerDate`.

`todayCards`: each card gains the same optional `otherDates`; each result gains the same
`others`.

`history`
- new optional arg `otherToDates?: Array<{ key: string; toDate: string }>`.
- return gains `others: Array<{ key: string; rows: DayView[] }>`. A member with no entry is
  read to `partnerToDate ?? toDate`. `partner` stays as today.

`myDayView` gains `nudgesByMember: Record<string, number[]>` (empty object when none).

`invitePreview`: `full` now means `memberCount >= 8`. It gains `memberCount` and `capacity`
and still names nobody but the inviter. New status `returning` is **not** added; a former
member previews as `ok`.

`adminListChallenges`: `members` lists active members; each challenge gains
`formerMembers: number`.

`DayView`'s key set does not change.

## 5. Mutations

`createInvite` (any active member, as today): refused at 8 with
"This challenge is full (8 members)". One seat per link, as today.

`acceptInvite`
- refused at 8 with the same sentence.
- a **former member** accepting an invite gets their own row back: `leftAt` and `leftReason`
  removed, `joinedDate` set to their local today (so inactivity counts from the return),
  `joinedAt`, name, goals and don'ts untouched. Goals and don'ts passed with the accept are
  ignored for a returning member unless their lists are empty.
- `solo: false` on any join, as today.

`leaveChallenge`
- the last active member (always the creator after hand-over): the challenge ends `allLeft`
  and their row stays active, so they can still read and reopen it. As today for a creator
  alone.
- the creator with others present: `createdBy` moves to the remaining active member with the
  earliest `joinedAt`; the leaver's row gets `leftAt`, `leftReason: "left"`. The challenge
  stays active. (`creatorLeft` is no longer written; old rows with it stay valid.)
- anyone else: their row gets `leftAt`, `leftReason: "left"`. No row is deleted.
- a `warning` naming the leaver is cleared in the same mutation.

`nudgePartner`
- new optional arg `memberKey?: string`. Absent: the target is `others[0]` (today's
  behaviour, which the live client relies on).
- the cap and the gap are **per target**: three a day, an hour apart, on the nudger's local
  day, judged from `nudgesByMember[key]`. The legacy `nudgesSentAt` list is still appended to
  on every nudge, so the live client's count stays right for two people.
- a target who is not an active member of this challenge: "They are not in this challenge".

`reopenChallenge({ challengeId, endDate?: string })` (new)
- caller must be the creator and an active member: "Only the creator can reopen a challenge".
- the challenge must be ended: "This challenge is already running".
- the creator must be below `MAX_ACTIVE_MEMBERSHIPS` ("You are in 20 challenges already").
- the end date after the reopen is `endDate ?? challenge.endDate`. It must be on or after
  every active member's local today; otherwise `fail` with code `"needsEndDate"` and the
  message "Pick an end date from today on". It must be a valid date after the start, and no
  more than 366 days after the reopen day ("A season runs at most 366 days from today").
- one patch: `status: "active"`, `endedReason`, `endedAt` and `warning` removed, `endDate`,
  `reopenedDate`, `reopenedAt`, `closedSpans` extended.
- no member row and no `challengeDays` row is changed. Former members stay former.
- every other active member is emailed once that it is running again, through the existing
  email path (scheduled from the mutation, like a nudge; `EMAIL_DELIVERY=off` on dev still
  turns it into a log line).
- returns `null`.

`updateSpan`: the creator rule now follows the current `createdBy`. Two additions: the start
cannot move past the first day holding a mark (`dontsBroken` or `goalsKept` non-empty), the
same sentence extended to say "or mark"; and the start cannot move past the first closed span.

## 6. The sweep

- Reads every active member (no `.take(3)`).
- Inactivity counts no day before `reopenedDate` (as it already counts none before the join
  date or the start). So a reopened challenge is quiet for four full days at the earliest.
- With three or more active members, a "close" decision for one member instead: marks their
  row `leftAt`, `leftReason: "inactive"`; clears the warning; hands over `createdBy` if they
  were the creator; emails every member, the dropped one included ("dropped" kind: who, and
  that an invite link brings them back with everything kept). The challenge stays active. If
  that leaves two, the two-member rule applies from then on.
- With two or one, exactly today's behaviour.
- The single `warning` slot stays (one warning at a time). Known limit: a second quiet member
  is not warned until the first is resolved. Report it; do not redesign it.
- Reminder emails: "your partner" stays for two people; with more it reads "the group" or
  names nobody. The check-in reminder names the challenge's own deadline instead of
  "midnight".

## 7. Refusal sentences (all through `fail()`)

| Case | Message |
|---|---|
| join or invite at 8 | This challenge is full (8 members) |
| reopen by a non-creator | Only the creator can reopen a challenge |
| reopen of a running one | This challenge is already running |
| reopen with a past end date | Pick an end date from today on (code `needsEndDate`) |
| reopen span too long | A season runs at most 366 days from today |
| nudge of a non-member key | They are not in this challenge |

## 8. Privacy (unchanged rules, more people)

Every member sees every other active member's `memberView` and published day, exactly what a
partner sees today. No `userId`, email, reminder or nudge bookkeeping of another member leaves
the server. Nothing returned for one challenge says a member is in any other. A former member
sees nothing of the challenge. `invitePreview` names only the inviter.
