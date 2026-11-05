# Spec 01: the `solo` flag on a challenge (backend)

*Run:* `docs/00-orchestration/runs/2026-11-05-solo-countdown/` · *Builder:* builder (Opus) · *Worktree:* yes, from `main` ·
*Time box:* 40 minutes of agent work

## Goal
A challenge can be created for one person. The backend records that choice as `solo: true` on the `challenges` row, returns it in every view a client reads, and clears it the moment a partner accepts an invite. Nothing else about a challenge changes: lock-in, check-in, inactivity, reminders, nudges and deletion behave exactly as they do today for a one-member challenge.

## Inputs (read all of these first)
- `C:\Users\kinlo\code\personal\ket_deepwork\docs\00-orchestration\runs\2026-11-05-solo-countdown\02_COMMON.md`: setup and the contract (section "Backend"). The field and function names there are fixed.
- `convex/_generated/ai/guidelines.md`: Convex rules.
- `CLAUDE.md` section "Accountability challenge": how the tables and functions fit.
- `convex/schema.ts` (the `challenges` table, ~line 161), `convex/_shared/challengeValidators.ts`.
- `convex/challenges.ts`: `challengeView` (~line 219), `createChallenge` (~line 630), `acceptInvite` (~line 702), `createInvite`, `AdminChallengeRow` and `adminListChallenges` (~line 545).
- `convex/challengesMulti.test.ts`: the test helpers (`signUp`, `start`, `join`, `refusal`) to copy from; and `convex/challenges.test.ts` for the `pair` helper style.

## Deliverables (exact paths)
- `convex/schema.ts`: `solo: v.optional(v.boolean())` on `challenges`, with a one-line doc comment.
- `convex/challenges.ts`: the `createChallenge` arg; the insert; `acceptInvite` patching `solo: false` when the second member joins; `challengeView` returning `solo: boolean`; `AdminChallengeRow.solo` filled in `adminListChallenges`.
- `convex/challengesSolo.test.ts` (new): the tests below. Do not edit the existing test files.
- `CLAUDE.md`: one short paragraph under "Accountability challenge" saying a challenge may be solo, what the flag means, and that joining clears it. Keep the file's voice.

## Acceptance criteria (each one checkable by a scout)
1. `createChallenge({ ..., solo: true })` stores `solo: true`; `myChallenges` for the creator returns `challenge.solo === true`; `dayCards` and `todayCards` return the same.
2. `createChallenge` without `solo`, or with `solo: false`, stores no `solo` field or `false`, and every view returns `solo: false`. Every existing row (no field) reads as `solo: false`.
3. On a solo challenge, `createInvite` returns a token, and `acceptInvite` by a second user succeeds and leaves the row with `solo: false`; both members then see `solo: false` in `myChallenges`.
4. A third person cannot join (the two-seat cap holds), as before.
5. A solo challenge still runs through `lockInPlan`, `checkIn`, `leaveChallenge` (ending it as `allLeft`) and `deleteChallenge` once ended; one test walks that path.
6. `nudgePartner` on a solo challenge fails with "Nobody has joined yet".
7. `adminListChallenges` rows carry `solo: boolean`.
8. No view returns a `userId` that was not returned before; `JSON.stringify` of `myChallenges` for a member contains no user id (copy the assertion style from `challengesMulti.test.ts`).
9. `npx tsc -b` and `npm run lint` are clean; `npm run test:convex` passes everything, including the new file; `npm test` still passes.
10. The inactivity, reminders and nudge modules in `convex/_shared/` are not changed (`git diff --stat` shows no file under `convex/_shared/`).

## Constraints
- Project rules from `CLAUDE.md` apply.
- The field is named `solo`, nothing else; spec 03 is written against it.
- `acceptInvite` must patch the challenge in the same mutation that inserts the member row (one transaction).
- Do not change arguments of any other public function. This is already a two-sided deploy because `createChallenge` gains an optional arg; keep the blast radius to that.
- Edit with the Edit tool, never `sed`.

## Out of scope
- Any client code.
- A "convert to solo" action (a two-person challenge whose partner left stays a two-person challenge).
- Changing the admin page.

## Verification the builder must run
- `npx tsc -b`
- `npm run lint`
- `npm run test:convex`
- `npm test`
- `git diff --stat` and confirm nothing under `convex/_shared/` or `src/` changed except `CLAUDE.md`.

## Report to
Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`. The supervisor files it as `report-01-round1.md`.
