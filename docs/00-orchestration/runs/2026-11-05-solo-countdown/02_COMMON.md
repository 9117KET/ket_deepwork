# Common rules and the contract for this run

Every spec in this run points here. Read it before the spec.

## Setup in a worktree

1. The harness makes your worktree from `main` (`a23ab7c`, which already contains the multi-challenge work and PR #37, "delete an ended challenge"). The run folder lives only in the main tree: `C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-05-solo-countdown\`. Read specs from there by absolute path.
2. Do not `npm install`. Link the main tree's `node_modules` as a junction from your worktree root:
   ```
   cmd /c mklink /J node_modules C:\Users\kinlo\code\personal\ket_deepwork\node_modules
   ```
   Never commit it; it is gitignored.
3. The repo has no `.env` in a worktree. Unit tests and convex tests do not need one. Do not start `npx convex dev` or the Vite dev server unless the spec says so.
4. Windows: `npm run build` fails under PowerShell 5 because of `&&`. Run `npx tsc -b` then `npx vite build` separately. Prefer the Bash tool for commands.
5. Commands and what "green" is today (from the main tree at `a23ab7c`):
   - `npx tsc -b`: no output.
   - `npm run lint`: no output.
   - `npm test`: 23 files, 345 tests pass (`src/**/*.test.ts`).
   - `npm run test:convex`: 14 files, 171 tests pass (`convex/**/*.test.ts`, convex-test with mocked Google and nodemailer).
   - `npx vite build`: builds, one chunk-size warning about `index-*.js` that already exists.
   If you run a suite from the main tree while worktrees exist, add `--exclude ".claude/**"` to vitest.
6. Edit with the Edit tool, not `sed`, on any `.ts`/`.tsx` file: the repo has CRLF files and `sed` has mangled them before.
7. Convex: read `convex/_generated/ai/guidelines.md` first. Every public function derives the caller from the identity; refusals go through `fail()` as `ConvexError({ code, message })`; the partner's `userId` is never returned.
8. Report: your final message is the report, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`. Do not write it to a file (the harness refuses). Do not commit, push or deploy.

## The contract

### Backend (spec 01 produces, spec 03 consumes)

- `challenges.solo: v.optional(v.boolean())` in `convex/schema.ts`. Absent means a two-person challenge (every existing row).
- `createChallenge` takes `solo: v.optional(v.boolean())`. `true` stores `solo: true`. The creator's member row is unchanged.
- `acceptInvite` patches the challenge with `solo: false` when a second member joins, in the same mutation that inserts the member row. A solo challenge that gained a partner is from then on a two-person challenge in every view.
- `createInvite` keeps working on a solo challenge (one open invite, two seats cap). No change expected; a test pins it.
- `challengeView` returns `solo: boolean` (`c.solo === true`). It therefore appears on `myChallenges[].challenge`, `dayCards.challenge`, `todayCards[].challenge`, `history`, and `invitePreview` if that returns the view.
- `AdminChallengeRow` gains `solo: boolean`.
- Inactivity (`convex/_shared/challengeInactivity.ts`), reminders, and `nudgePartner` are untouched. `nudgePartner` on a challenge with no partner already fails with "Nobody has joined yet"; keep that.

### Domain (spec 02 produces, spec 03 consumes)

File `src/domain/challengeCountdown.ts`, pure, no React, no Convex imports (type imports from `./challenge` are fine).

```ts
export type CountdownState =
  | { kind: 'lock'; deadlineMs: number; msLeft: number }                       // plan not locked, plan deadline ahead
  | { kind: 'checkin'; deadlineMs: number; msLeft: number; planMissed: boolean } // not checked in, check-in deadline ahead
  | { kind: 'closed'; planMissed: boolean }                                    // not checked in, check-in deadline passed
  | { kind: 'done' }                                                           // checked in today
  | { kind: 'idle' }                                                           // the challenge is not running today

export function localDeadlineMs(dateIso: string, hhmm: string): number
// The instant `hhmm` on `dateIso` in the device's local time (new Date(y, m-1, d, hh, mm)). Never UTC.

export function countdownState(args: {
  nowMs: number
  todayIso: string                 // the viewer's local date, as the app already computes it
  planDeadline: string             // "HH:MM"
  checkinDeadline: string          // "HH:MM"
  planSetAt: number | null | undefined
  checkinAt: number | null | undefined
  running: boolean                 // status active and progress.phase === 'active'
}): CountdownState

export function formatCountdown(msLeft: number): string
// "2:14:33"; hours unpadded, minutes and seconds two digits; negative or zero → "0:00:00"; under an hour "0:14:33".

export function formatCountdownCoarse(msLeft: number): string
// "2h 14m left" for the Today block (minute precision); under a minute "under a minute left"; zero or negative "0m left".

export function countdownLine(state: CountdownState, deadlines: { planDeadline: string; checkinDeadline: string }, precise: boolean): string | null
// precise=true (detail page): "Lock in by 10:00 · 2:14:33 left" / "Check in by 23:59 · 5:02:11 left" / "Check in by 23:59 · 5:02:11 left · plan not locked" / "Check-in deadline passed" / "Done for today" / null for idle.
// precise=false (Today block): same words with formatCountdownCoarse.

export interface DaysLeftHeadline { number: string | null; label: string }
export function daysLeftHeadline(progress: ChallengeProgress, span: ChallengeSpan, todayIso: string): DaysLeftHeadline
// active, daysLeft >= 2 → { number: "70", label: "days left" }; daysLeft 1 → { number: "1", label: "day left" }
// active, daysLeft === 0 → { number: null, label: "Last day" }
// upcoming → { number: null, label: "Starts tomorrow" } or "Starts in N days" (N counted from todayIso to span.startDate in UTC day arithmetic)
// ended → { number: null, label: "Season over" }
```

Hook `src/hooks/useSecondTick.ts`:

```ts
export function useSecondTick(active: boolean): number
// Date.now(), updated every second while `active` and document.visibilityState === 'visible'; a visibilitychange back to visible updates at once. Inactive → the value from mount, updated on each activation.
```

### Client (spec 03)

Words, fixed so the copy is one voice:
- The choice on the create page: **"With a partner"** (default) and **"Just me"**. Helper under "Just me": "You can invite someone later."
- A solo challenge's partner slot on the detail page: no "Nobody has joined yet" heading. One quiet text action **"Invite a partner"** that opens the existing invite link flow ("Create invite link" / "Share link" words stay inside it).
- Today block row status for a solo challenge: **"Just you"** where a partner's mark would be.
- List row: **"Just you"** where "Waiting for a partner" would be, and only for `solo === true`; a two-person challenge still alone keeps "Waiting for a partner".
- Admin table: "Solo" after the member list when `solo` is true.
- Head to head on a solo challenge becomes **"Your season"** with your two numbers only.
- The headline is the big number from `daysLeftHeadline`, the countdown line under it with `role="timer"` (implicitly `aria-live="off"`, so a screen reader never hears every second).
