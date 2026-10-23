# Spec 02: Capped, spaced nudges with a button state instead of an error

*Run:* `docs/00-orchestration/runs/2026-10-23-challenge-v2/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 60 minutes of agent work

## Goal
A member can nudge their partner up to three times on a local day, at least an hour apart, and
only while the partner still owes the day something. The Nudge button always says what it can
do next ("Nudge · 2 left today", "Nudge again in 42 min", "Nudged 3/3 today") instead of
throwing a red error on the second tap, which is what happens today
(`convex/challenges.ts:494`, "You have already nudged them today"). The server still enforces
every rule.

## Inputs (read all of these first)
- `CLAUDE.md`, section "Accountability challenge" (reminders paragraph) and "Responsive
  foundations" (touch targets).
- `convex/_generated/ai/guidelines.md`.
- `scout-code-map.md` (Part B: the nudge path; Part C: harness, how `Date.now` is controlled in
  convex tests) and `scout-bug-audit.md` (the "Nudge diagnosis" section) in the run folder.
- `convex/challenges.ts` (`nudgePartner`, `dayCards`, `upsertDay`), `convex/schema.ts`
  (`challengeDays`), `convex/_shared/challengeReminders.ts` (the pure-rules module to mirror:
  it is imported by the client too, via `src/services/challengeService.ts`).
- `src/components/challenge/ChallengeCard.tsx` (the button, `partnerOwes`, `isEvening`),
  `src/hooks/useChallenge.ts` (the `now` tick), `src/services/challengeService.ts`.
- `convex/challenges.test.ts` lines 1–45 and its existing `nudgePartner` tests.

## Design (decided; do not reopen)

### Data
- `challengeDays` gains `nudgesSentAt: v.optional(v.array(v.number()))` (additive). The legacy
  `nudgeSentAt` stays in the schema and is read as one entry when `nudgesSentAt` is absent;
  it is never written again.

### Rules — pure module `convex/_shared/challengeNudges.ts`
- `NUDGE_DAILY_CAP = 3`, `NUDGE_MIN_GAP_MS = 60 * 60 * 1000`.
- `nudgeTimes(row: { nudgesSentAt?: number[]; nudgeSentAt?: number } | null | undefined): number[]`
  — merges the legacy field, sorted ascending.
- `nudgeAvailability({ nowMs, times, partnerOwes }): NudgeAvailability` where
  `NudgeAvailability = { state: 'ready', left: number } | { state: 'cooling', left: number, nextAt: number }
  | { state: 'spent' } | { state: 'notOwed' }`. Order of precedence: `notOwed` → `spent`
  (times.length ≥ cap) → `cooling` (now − last < gap) → `ready`.
- `nudgeLabel(a: NudgeAvailability, nowMs): string` — the button copy:
  ready → `Nudge` (with `left` for the caption), cooling → `Nudge again in <n> min`
  (ceil, at least 1), spent → `Nudged 3/3 today`, notOwed → `''` (button hidden, as today).
- Unit tests in `convex/_shared/challengeNudges.test.ts` (cap, gap, legacy merge, label text,
  precedence, the boundary at exactly `gap`).

### Mutation (`convex/challenges.ts`, `nudgePartner`)
- Add the missing span check first (audit F18): if the partner's local date is outside
  `[startDate, endDate]` throw `The challenge is not running today` (`inRange` exists at :140).
- Keep the existing partner-owes logic and the "nudger's own local day" row. Replace the
  `nudgeSentAt` check with `nudgeAvailability`. On `spent` throw
  `You have nudged them 3 times today`; on `cooling` throw `You can nudge again in <n> min`;
  on `notOwed` keep the two existing messages. Append `now` to `nudgesSentAt` (migrating the
  legacy value into the array on first write). Return `{ left: number, nextAt: number | null }`.
- `dayCards.mine` must carry `nudgesSentAt` and `nudgeSentAt` to the client (it returns the
  raw row today; keep that, or shape it explicitly — either way these two fields arrive).

### Client (`ChallengeCard.tsx`, `useChallenge.ts`, `challengeService.ts`)
- `challengeService.nudgePartner` returns the mutation's result.
- `ChallengeCard` computes `nudgeAvailability` from `mine` (via `nudgeTimes`) and a `now` that
  ticks each minute while the card is mounted (`useChallenge(now)` already takes a tick from
  the caller; reuse whatever the page passes, or add a local `useMinuteTick` in the card — the
  code map says where `now` comes from today). The button:
  - `ready`: enabled, label `Nudge`, with a caption under or beside it `2 left today` (only when
    `left < NUDGE_DAILY_CAP`, so the first tap of the day shows no caption).
  - `cooling` / `spent`: rendered, disabled, with the `nudgeLabel` text; `aria-disabled`,
    `role="status"` on the caption, no red.
  - `notOwed`: hidden (unchanged).
- After a successful nudge: notice `Nudge sent to <Name> · 2 left today` (or `· that was the
  last one today` when `left === 0`). "Sent" means scheduled: the mutation only queues the
  email (audit F3); do not promise delivery in the copy.
- `partnerOwes` (`ChallengeCard.tsx:77`) currently decides "evening" on the **viewer's** device
  clock (`isEvening()`, :187-190) while the server judges on the partner's timezone. Replace
  `isEvening()` with the partner's local minutes from `localDateAndMinutes(now, partner.timezone)`
  (already reachable on the client through `src/services/challengeService.ts`, which imports
  `convex/_shared/challengeReminders.ts`) and `CHECKIN_START`, so the button and the server agree.
- Server rule errors (another device nudged a minute ago) are shown as the quiet status line,
  not the `text-share-tertiary role="alert"` error: match on the messages above, or better,
  re-derive availability from the refreshed `mine` row after the mutation settles. Network and
  unknown errors stay alerts.
- The card's header comment ("one email a day") and `CLAUDE.md`'s reminders paragraph
  (`nudgePartner` schedules one email a day) are updated to the new rule.

## Deliverables (exact paths)
- `convex/schema.ts` (one field), `convex/_shared/challengeNudges.ts` (new),
  `convex/_shared/challengeNudges.test.ts` (new), `convex/challenges.ts` (`nudgePartner`,
  `dayCards` if shaped).
- `convex/challengeNudges.test.ts` (new, `convex-test`; do **not** append to
  `convex/challenges.test.ts`): three nudges an hour apart succeed and schedule three emails;
  the fourth is refused with the `3 times` message; a second nudge 10 minutes after the first
  is refused with the `again in` message; a row holding only legacy `nudgeSentAt` counts as
  one; a partner who has locked in is still "not owed"; the returned `left` counts down 2, 1, 0.
  Existing nudge tests are updated in place with minimal edits: `convex/reminders.test.ts:150-181`
  (:162 expects `/already nudged/i` on the second nudge — now the second nudge ten minutes later
  expects `/again in/i`; :168-170 next-day nudge still succeeds; :173-180 unchanged) and
  `convex/challenges.test.ts:219` (partner view lacks `nudgeSentAt` — also assert it lacks
  `nudgesSentAt`). Copy the nodemailer mock, env `beforeEach`, `vi.useFakeTimers` /
  `vi.setSystemTime` / `t.finishAllScheduledFunctions(vi.runAllTimers)` pattern from
  `reminders.test.ts:14-56, 150-181`.
- `src/pages/PrivacyPage.tsx:62` ("a nudge your partner may send once a day") → up to three a
  day, an hour apart. Leave line 48 alone; spec 01 edits it.
- In-code docs: `convex/challenges.ts:474-478` docblock, `ChallengeCard.tsx:6-7` header.
- `src/components/challenge/ChallengeCard.tsx`, `src/services/challengeService.ts`,
  `src/hooks/useChallenge.ts` only if the tick has to be threaded.
- `CLAUDE.md` reminders paragraph: one sentence on the cap and gap.
- Commits on the worktree branch; nothing pushed.

## Acceptance criteria (each one checkable by a scout)
1. `nudgeAvailability` unit tests cover cap, gap, legacy merge, precedence and the exact-gap
   boundary, and pass.
2. The convex test file proves 3 allowed / 4th refused / gap refused / legacy counted / not-owed
   refused, and that `internal.email.sendEmail` is scheduled once per accepted nudge.
3. `ChallengeCard` renders the disabled state texts from `nudgeLabel` for `cooling` and `spent`
   and hides the button for `notOwed`; no `role="alert"` is used for a rule refusal.
4. The first nudge of the day shows no "left" caption; the second shows `1 left today`.
5. Legacy rows (`nudgeSentAt` only) still work end to end without a migration.
6. `npm run test:convex`, `npm test`, `npm run lint`, `npx tsc -b`, `npx vite build` pass; the
   e2e gates the code map names for Today / `/challenge` still pass or are reported as skipped
   with the reason.
7. Nothing in goals / donts / `checkIn` / `acceptInvite` / `invitePreview` / the dashboard's
   lists was touched — spec 01 owns those.

## Constraints
- Project rules from `CLAUDE.md` apply; read `convex/_generated/ai/guidelines.md` first.
- `npx convex codegen` only; never `convex dev` or `convex deploy`.
- Worktree setup as in the run plan (`npm ci`, copy `.env` and `.env.local` from
  `C:\Users\kinlo\code\personal\ket_deepwork\` if needed; private Playwright port if 5173
  is busy, or skip e2e and say so). Codegen may need `CONVEX_DEPLOYMENT` from `.env.local`;
  if it cannot run, say so and continue — `convex-test` loads modules by glob, and this spec adds
  no new public module (`challengeNudges.ts` is a `_shared` helper, not an `api.*` entry).
- The cap is judged on the nudger's own local day (as the once-a-day rule is today). Decided.
- The e2e gates that matter are `e2e/mobile-panels.spec.ts` and `e2e/mobile-responsive.spec.ts`
  (signed-out form on `/challenge`); `ChallengeCard` is never rendered in e2e.
- New helpers go in the new modules named above, not in `src/domain/challenge.ts` or
  `challengeReminders.ts`, so the parallel builder's branch merges cleanly.
- 44px targets; the button stays `touch-target-coarse`; copy short, no exclamation marks.

## Out of scope
- Changing which side's local day the cap is judged on (stays the nudger's).
- Reminder cron rules, email templates beyond the subject/body already there.
- Push or WhatsApp delivery.

## Verification the builder must run
`npx convex codegen`, `npm run test:convex`, `npm test`, `npm run lint`, `npx tsc -b`,
`npx vite build`, one at a time on PowerShell; then the e2e specs the code map names.

## Report to
Return the report as your final message using `~/.claude/skills/orchestrate/templates/REPORT.md`;
the supervisor files it as `report-02-round1.md`. Include the worktree branch name and commit
hashes.
