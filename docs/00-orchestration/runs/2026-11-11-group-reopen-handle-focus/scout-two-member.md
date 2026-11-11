# Scout: every two-member assumption (Mode A, read-only, 2026-11-11)

Condensed by the supervisor from the scout's report; the core citations were re-read by the
supervisor at `cae99e5`. A builder re-reads before editing.

## Core mechanism (`convex/challenges.ts`)

- `:50` `const MAX_MEMBERS = 2`.
- `membersOf` `:181-186`: `.take(MAX_MEMBERS + 1)`.
- `partnerOf` `:188-191`: `members.find((m) => m.userId !== userId) ?? null`, the first other
  member. With three or more it returns an arbitrary one, so raising the constant alone is
  unsafe.
- `convex/challengesInternal.ts:64-69`: a second `membersOf` with a hard-coded `.take(3)`,
  feeding `listActiveChallenges` (`:90`) and `claimDueReminders` (`:144`). Past three members
  the sweep would silently skip people.

## Backend sites

| Site | What | Change |
|---|---|---|
| `challengeEntry` `:294-303` | `partner: memberView \| null`; invite hidden once a partner exists | add `others`; invite stays while seats remain |
| `dayCards` `:502-521` | args `{challengeId, myDate, partnerDate}`; one partner day | add per-member dates and `others` |
| `todayCards` `:528-562` | `cards: [{challengeId, partnerDate}]`; `partner: DayView \| null` | same, per card |
| `history` `:573-600` | args `{challengeId, toDate, partnerToDate?}`; `partner: DayView[]` | add per-member `toDate` and `others`; `HISTORY_CAP` 400 rows per member |
| `invitePreview` `:603-637` | `full` when `members.length >= MAX_MEMBERS` (`:634`); `used` (`:622`) | cap |
| `createInvite` `:790-805` | fails "The challenge already has two members" (`:796`) | cap, copy |
| `acceptInvite` `:808-852` | same message `:830`; a member accepting again is a no-op `:827`; `solo: false` on join `:849`; inserts the member row `:836-846` | cap, copy, rejoin |
| `leaveChallenge` `:995-1011` | creator: ends it (`creatorLeft` if a partner exists, else `allLeft`); other: deletes own row, ends `allLeft` when none remain | hand-over, soft leave |
| `nudgePartner` `:1217-1250` | args `{challengeId}`; targets `partnerOf`; cap on the nudger's day row (`nudgesSentAt`) | optional target |
| `challengeView` `:228-246` | `warning: {forMe, missedSince, issuedAt}`, no name | add who |
| `memberView` `:288-291` | `{displayName, timezone, joinedAt, goals, goalItems, donts}`, no key | add a key |
| `challengesInternal.ts:153-190` | one `challenge.warning` slot; a "close" ends the challenge for all | group rule |
| `pushAboutEmails` `challengesInternal.ts:266-295` | already loops over members | none |
| `reminders.ts:39,45,55,67`, `challenges.ts:1246`, `email.ts:8` | "your partner" copy | copy |
| `adminListChallenges` `:677-728` | `members` already an array, truncated by `membersOf` | cap |
| `updateSpan` `:944-960` | loops over members | cap |

Already safe: `syncDaySummary`, `lockInPlan`, `checkIn`, `markDay`, `updateMyCommitments` (own
row only), `deleteChallenge` (by index), the season-over test (`members.every`), the schema
indexes (`challengeMembers.by_challenge`, `challengeDays.by_challenge_user_date`).

## Return shapes today (fields may be added, never retyped)

```
myChallenges → Array<{
  challenge: { id, name, startDate, endDate, planDeadline, checkinDeadline, createdAt, status,
               endedReason|null, endedAt|null, warning: {forMe, missedSince, issuedAt}|null,
               isCreator, solo },
  me:      { displayName, timezone, joinedAt, goals: string[], goalItems: Commitment[], donts: Dont[] },
  partner: (same as me) | null,
  invite:  { token, expiresAt } | null }>
dayCards   → null | { challenge, mine: Doc<challengeDays>|null, partner: DayView|null }
todayCards → Array<{ challengeId, challenge, mine: myDayView|null, partner: DayView|null }>
history    → null | { challenge, mine: DayView[], partner: DayView[] }
DayView    = { date, summary, summaryUpdatedAt, planSetAt|null, checkinAt|null, note|null,
               dontsBroken[], goalsKept[] }     (key set pinned by challengeEdits.test.ts:352)
myDayView  = { planSetAt, checkinAt, note, dontsBroken, goalsKept, nudgesSentAt, nudgeSentAt }
invitePreview → status ok|full|used|expired|ended|member|notFound, challenge, inviterName,
                inviterGoals, inviterDonts
```

The client types come from `FunctionReturnType` (`src/hooks/useChallenges.ts:42-57`), and the
live client renders `partner` during a deploy, so `partner` stays populated.

## Client sites

| File:line | What |
|---|---|
| `src/hooks/useChallenges.ts:49-57,78-81,97-121,124-150,160-167` | single-partner types, `partnerDateOf`, detail, today cards, history |
| `src/services/challengeService.ts:168-169` | `nudgePartner(challengeId)` |
| `src/domain/challenge.ts:243-276` | `bothLockedDays`, `jointStreak` take two row lists |
| `src/domain/challengeList.ts:91-97,183-198,211-222` | `partnerWho`, `endedSentence`, `warningSentence` |
| `src/components/challenge/ChallengeDetail.tsx:96-130,158-163,181-198,267-271,374-431,445-484,494-499,521,574` | single partner throughout: rows, owes, nudge, leave copy, Today surface, head to head, grid, commitments, delete copy |
| `src/components/challenge/SeasonGrid.tsx:4-16,61,89-92,103,136-140,150-153,163,174-177` | two marks per day, legend, sr-only text |
| `src/components/challenge/MemberRow.tsx:102` | copy only; the row is already per member |
| `src/components/challenge/ChallengeTodayBlock.tsx:150,171,192` | one partner status per row |
| `src/components/challenge/ChallengeReviewSection.tsx:48-55,110,120` | two week rows |
| `src/pages/ChallengeListPage.tsx:101-141,159` | You plus one partner mark |
| `src/pages/ChallengeDetailPage.tsx:38` | one partner history date |
| `src/pages/ChallengeJoinPage.tsx:102,127-129`, `ChallengeJoinPanel.tsx:26,39`, `CheckinSheet.tsx:105`, `CommitmentsSheet.tsx:53`, `ChallengeCreatePage.tsx:9,35-37,65,314,335,349`, `AdminChallengesPage.tsx:163` | copy |

## Tests that pin two members

`convex/challenges.test.ts:99,129` (third person finds it full, `/two members/i`),
`convex/challengesSolo.test.ts:141-152`, `convex/challengeCommitments.test.ts:243`
(`status: 'full'`), `convex/challengeInactivity.test.ts:48,101`,
`convex/challengesMulti.test.ts:97,127-130,228,235,256`, `convex/challengeFixes.test.ts:103,136-139`,
`convex/challengeNudges.test.ts`, `src/domain/challenge.test.ts:301`,
`src/domain/challengeList.test.ts:33-43`. `e2e/challenge-guest.spec.ts` has no partner
assertions.

## Privacy rules that must hold with N members

1. Nobody reads `plannerDays`; others see only the published `summary`.
2. Private tasks are counted, never titled.
3. No `userId` is returned; others' day views carry no reminder or nudge bookkeeping (tests
   assert `not.toHaveProperty('userId')`, `remindersSent`, `nudgesSentAt`).
4. Nothing returned for one challenge says a member is in any other.
5. Every read and write goes through membership.
6. Email addresses reach admins only.
7. `invitePreview` is unauthenticated: it must not list the members.
