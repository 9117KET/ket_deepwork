# Spec 01: Per-member, editable goals and don'ts

*Run:* `docs/00-orchestration/runs/2026-10-23-challenge-v2/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 90 minutes of agent work

## Goal
Each member of a challenge owns their own goals and don'ts, sets them when they create or join,
and can edit them at any time from the challenge page. The partner sees the other person's
lists and cannot change them. A dont that was ever broken keeps resolving to its text in the
season's record, even after the member removes it. Challenges created before this change keep
working with no migration: the creator's existing lists become the creator's.

## Inputs (read all of these first)
- `CLAUDE.md`, section "Accountability challenge": the privacy model and the tables.
- `convex/_generated/ai/guidelines.md`: Convex rules (validators, indexes, no `filter`).
- `scout-code-map.md` in the run folder: every reader of goals / donts / dont ids, the client
  type derivation, the test harness, the e2e gates on `/challenge`, the docs to keep in step.
- `convex/challenges.ts`, `convex/schema.ts`, `convex/_shared/challengeValidators.ts`.
- `src/components/challenge/ChallengeDashboard.tsx`, `ChallengeCreateForm.tsx` (the
  `ListEditor`), `MemberDayCard.tsx`, `CheckinSheet.tsx`, `ChallengeCard.tsx`,
  `ChallengeReviewSection.tsx`, `src/pages/ChallengeJoinPage.tsx`, `ChallengeJoinPanel.tsx`.
- `convex/challenges.test.ts` lines 1–45: the `convex-test` setup shape to copy.
- `docs/data-safety.md`: the rule that recorded work is never destroyed; a broken dont in a
  check-in is recorded work.

## Design (decided; do not reopen)

### Data
- `challengeMembers` gains three optional fields (additive, no migration):
  `goals: v.optional(v.array(v.string()))`, `donts: v.optional(v.array(dontValidator))`,
  `commitmentsUpdatedAt: v.optional(v.number())`.
- `dontValidator` gains `archivedAt: v.optional(v.number())`. Removing a dont archives it; the
  id and text stay, so `challengeDays.dontsBroken` ids resolve forever. Editing a dont's text
  keeps its id. Adding one mints a new id (`dont-${now}-${i}`, as today). Goals are plain strings
  with no history link and are replaced wholesale.
- `challenges.goals` / `challenges.donts` stay in the schema and are never written again
  (`createChallenge` writes `[]` to both). A pure helper
  `memberCommitments(challenge, member)` resolves a member's lists:
  `member.goals ?? (member.userId === challenge.createdBy ? challenge.goals : [])`, same for
  donts. This is the whole backward-compatibility story.

### Functions (`convex/challenges.ts`)
- `challengeView` **drops** `goals` and `donts`; `memberView` **adds** `goals` and `donts`
  (resolved, including archived donts with their flag). Dropping them from `challengeView` is
  deliberate: TypeScript then points at every consumer that must move to the member.
- `createChallenge`: unchanged args; writes the lists on the creator's member row, `[]` on the
  challenge row.
- `acceptInvite`: new optional args `goals: v.optional(v.array(v.string()))`,
  `donts: v.optional(v.array(v.string()))`; cleaned with `cleanList`, written on the new member
  row (ids minted). Omitted → the member starts with empty lists.
- New `updateMyCommitments({ goals: string[], donts: { id?: string, text: string }[] })`:
  caller's own row only. Rules: `cleanList` limits apply to the active lists; every supplied
  `id` must be one of the caller's current dont ids (else `Unknown don't`); a current dont whose
  id is not supplied is archived (`archivedAt: now`), not deleted; an already-archived dont stays
  archived and is not counted against `MAX_LIST`; a supplied dont with no id gets a new id.
  Sets `commitmentsUpdatedAt`. Returns the resolved lists.
- `checkIn`: validates `dontsBroken` against the **caller's** resolved donts (active or archived
  — a check-in edited later may still name a dont archived in between).
- `invitePreview`: when `status === "ok"` or `"full"`, also returns `inviterGoals: string[]` and
  `inviterDonts: string[]` (active texts only); `[]` otherwise. Still no auth required.

### Client
- Extract `ListEditor` from `ChallengeCreateForm.tsx` into
  `src/components/challenge/ListEditor.tsx` (same behaviour and classes) and use it from the
  form, the join page and the new sheet.
- New `src/components/challenge/CommitmentsSheet.tsx`: the `CheckinSheet` shell (z-[80], bottom
  sheet on phones, Escape closes), two `ListEditor`s ("Goals", "Don'ts") seeded from `me.goals`
  and the active `me.donts`, Save calls `updateMyCommitments`; errors via
  `challengeErrorMessage`. Editing a dont's text in place must keep its id (the editor works on
  `{ id?, text }` rows for donts).
- `ChallengeDashboard`: the "Goals and don'ts" section becomes two columns — the viewer's
  ("Yours", with an "Edit" button opening the sheet, and an empty state "Set your goals and
  don'ts" when both lists are empty) and the partner's (read-only; empty state
  "<Name> hasn't set theirs yet"). Only the viewer's column before a partner joins. Each
  `MemberDayCard` receives that member's own `donts`.
- `ChallengeJoinPage`: under the inviter's name and span, show the inviter's goals and don'ts
  (from `invitePreview`), then two optional `ListEditor`s for the joiner's own lists with the
  line "Yours to set — you can change them any time on the challenge page." Pass them to
  `acceptInvite`.
- `CheckinSheet`: receives the viewer's active donts at **both** mounts
  (`src/pages/ChallengePage.tsx:117` and `src/components/planner/DayPlanner.tsx:849`).
  `ChallengeCard.tsx:70` share text and `MemberDayCard.tsx:48` resolve `dontsBroken` ids against
  the member's full list (archived included) via `resolveDontTexts`.
- `ChallengeReviewSection.tsx:37-40, 70-84`: `brokenCounts` resolves against `me.donts`; the
  line hides when the viewer has no donts at all (active or archived).
- `src/pages/PrivacyPage.tsx:48`: the "Challenge data" bullet says each member sets their own
  goals and don'ts and the partner can read them. Leave line 62 (nudges) alone; spec 02 edits it.
- In-code headers that say the lists belong to the challenge: `convex/challenges.ts:1-15`,
  `convex/schema.ts:206` comment on `dontsBroken`.
- `src/domain/challengeCommitments.ts` (pure, unit-tested in `challengeCommitments.test.ts`):
  `activeDonts(list)`, `resolveDontTexts(ids, list)` (falls back to "a don't" for an unknown id),
  and the `{ id?, text }` row ↔ list conversion the sheet uses.
- `src/services/challengeService.ts`: `updateMyCommitments`, `acceptInvite(token, displayName,
  goals, donts)`.

## Deliverables (exact paths)
- `convex/schema.ts`, `convex/_shared/challengeValidators.ts`, `convex/challenges.ts` as above.
- `convex/challengeCommitments.test.ts` (new; do **not** append to `convex/challenges.test.ts`,
  another builder is editing that area in parallel): legacy fallback, invitee starts empty,
  update keeps ids and archives removed donts, unknown id rejected, caps, `checkIn` validates
  against own donts, `invitePreview` carries the inviter's lists, `acceptInvite` with lists,
  `memberView` of the partner carries their lists and `challengeView` no longer carries any.
- Existing assertions that read `challenge.goals` / `challenge.donts` are updated in place
  (minimal edits, no new tests there): `convex/challenges.test.ts:63-64` and `:187-210`;
  `convex/reminders.test.ts:29-30` still passes lists to `createChallenge`, whose args do not
  change, so `pair()` in both files keeps working.
- `src/domain/challengeCommitments.ts` + `.test.ts`.
- `src/components/challenge/ListEditor.tsx`, `CommitmentsSheet.tsx`; edits to the components
  and pages listed above; `src/services/challengeService.ts`.
- `CLAUDE.md`, "Accountability challenge": the paragraph on tables and the summary updated to
  say lists are per member, archived not deleted, legacy fallback. Three or four sentences.
- Commits on the worktree branch; nothing pushed.

## Acceptance criteria (each one checkable by a scout)
1. A challenge seeded with `challenges.goals/donts` and a creator member row without lists
   resolves the creator's lists from the challenge row; the invitee's resolve to `[]`.
2. `updateMyCommitments` with a dont's id and new text keeps the id; omitting an id archives
   that dont (`archivedAt` set, row still present); an unknown id throws.
3. `checkIn` with an id from the partner's donts throws `Unknown don't`; with the caller's own
   archived dont id succeeds.
4. `invitePreview` returns the inviter's active goal and dont texts; `acceptInvite` with lists
   stores them on the joiner.
5. `myChallenge().challenge` has no `goals`/`donts` keys; `me` and `partner` do.
6. The dashboard shows two columns with the partner present, one without; Edit opens the sheet;
   Save persists and the column updates (verify by reading the code path and the convex test).
7. `MemberDayCard` renders the text of an archived dont in "Broke: …".
8. `npm run test:convex`, `npm test`, `npm run lint`, `npx tsc -b`, `npx vite build` all pass;
   `npx playwright test e2e/mobile-panels.spec.ts e2e/mobile-responsive.spec.ts` still passes
   (they only render the signed-out form on `/challenge`, so a pass is expected; report a skip
   with the reason if the port is busy).
9. No migration script, no deploy, no table or field removed.

## Constraints
- Project rules from `CLAUDE.md` apply; read `convex/_generated/ai/guidelines.md` first.
- Run `npx convex codegen` to refresh `convex/_generated`; never `npx convex dev` or
  `npx convex deploy` (two-sided deploy is the human's step). Codegen may need
  `CONVEX_DEPLOYMENT` from the main checkout's `.env.local`; copy that file into the worktree
  first. If codegen still cannot run, say so in the report and keep `_generated` as it is
  (`convex-test` loads modules by glob, so the convex suite runs regardless; only `api.<module>`
  typing of a *new* module needs codegen, and this spec adds no new module).
- Worktree setup: `npm ci`, copy `.env` and `.env.local` from the main checkout
  (`C:\Users\kinlo\code\personal\ket_deepwork\`) if e2e or codegen needs them. Playwright reuses any
  server on 5173; if the main tree's dev server is up, run e2e on a private port via a scratch
  config, or skip e2e and say so in the report.
- Copy: short, plain English, no exclamation marks; match the existing card copy.
- 44px touch targets on every new button (`.touch-target` / `.touch-target-coarse`); 16px inputs
  on coarse pointers come from `src/index.css` already.
- Do not touch `nudgePartner`, `dayCards`, or anything about nudges — spec 02 owns those.

## Out of scope
- Editing the challenge name, span or deadlines.
- Comments on a partner's lists or days.
- Any UI for un-archiving a dont.

## Verification the builder must run
`npx convex codegen && npm run test:convex && npm test && npm run lint && npx tsc -b && npx vite build`
(on Windows PowerShell run them one at a time). Then the `/challenge` e2e specs named in the
code map.

## Report to
Return the report as your final message using `~/.claude/skills/orchestrate/templates/REPORT.md`;
the supervisor files it as `report-01-round1.md`. Include the worktree branch name and commit
hashes.
