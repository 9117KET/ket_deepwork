# Report: spec 04, challenge client (round 1) — filed by the supervisor from the builder's final message

**Worktree:** `.claude\worktrees\agent-a4a05e1e13db12b16`. Uncommitted. Nothing under `convex/` changed. Typed against contract §A as amended (`goalItems`). Setup: merge "Already up to date" (`3ea502e`); `node_modules` junction; the main tree's `.env` copied in (gitignored).

## Done
- `challenge.ts`: `ChallengeSummary` + `plannedMinutes`/`doneMinutes`; `buildChallengeSummary` fills them from `computeDayCompletion` (planned rounded, done floored and capped; private tasks included, comment says why); `dayCompletionPercent`, `seasonCompletion` (minutes-weighted).
- `challengeCommitments.ts`: `Commitment`, `activeCommitments`, `resolveCommitmentTexts`, `keptLine`, `commitmentsToRows`, `rowsToCommitmentPayload`; beyond §B: `normalizeGoals` and `goalItemsOf(member)` (reads `goalItems`, falls back to `normalizeGoals(goals)` on an older backend); old names kept as wrappers.
- `challengeList.ts`: `seasonStepError` split into `seasonDatesError` + `seasonDeadlinesError`, recombined; `ChallengeCreatePage` untouched.
- `challengeService.ts`: `updateSpan`, `markDay` (one kind per call), `checkIn({goalsKept})`, goals sent as `{id?, text}`; one `contractApi` assertion marked `// contract: spec 03`.
- `useChallenges.ts`: day views gain optional `goalsKept`; compiles before and after the generated types change.
- `ChallengeDetail.tsx`: "Edit dates" beside Rename (creator, not read-only) → "Dates and deadlines" sheet (Starts, Ends, Plan by, Check in by, "Save dates"; client checks each field and moves focus to the faulty one; server sentence in `ErrorLine`; helper line when any day has an act; unchanged form just closes). "Today's commitments" under your row after the next-act button: one 44 px `aria-pressed` toggle per active goal (circle, `share-done` fill, ✓) and don't (square, warning fill, ✕), outline when unset; each tap sends the full set of one kind to `markDay`, optimistic with rollback and `ErrorLine`; nothing renders with no active commitments. Head to head: "Planned time done" column ("64%" or "–" with SR text) and the new note. Goals section reads goal objects.
- `MemberRow.tsx`: meter line (`role="meter"`, label, min/max/value) + "64% of planned time" + "Kept 2 of 3 goals"; neither without data; "Kept all don'ts" needs active don'ts and a check-in; "Broke:" shows as soon as marked.
- `CheckinSheet.tsx`: "Which goals did you keep today?" above the don'ts, seeded from `existing.goalsKept`, sent only when goals are offered. `CommitmentsSheet` edits goals with ids; `ListEditor` comment only; `ChallengeTodayBlock` passes goals into its sheet.
- Tests in `challenge.test.ts`, `challengeCommitments.test.ts`, `challengeList.test.ts` (criteria 1–3 literally; "absent day" `toEqual` now expects the two zero fields). CLAUDE.md sentences added.

## Verification (builder)
`npx tsc -b` clean; `npm run lint` clean; `npm test` 25 files / 388 passed; `npx vite build` ok; `npx playwright test e2e/challenge-guest.spec.ts` 11 passed (scratch config on 5194, deleted). web-design-guidelines: fixed `autoComplete="off"` on four inputs; kept: sentence case, no unsaved-changes warning on the four-field sheet, state-changing labels with `aria-pressed` (contract wording). No hex, no `text-[Npx]`; one cyan control.

## Open questions
Placement after the next-act button (design rule 1); "third row" read as a column; "Broke:" visible as soon as marked.

## Known gaps
No signed-in render possible; toggles use `aria-disabled` + guard, not `disabled`; drop `contractApi` after the merge; backend first; `keptLine` can read "Kept 2 of 1 goal" when a kept goal is archived the same day.

## Suggestions
A fixture-rendered component test for `ChallengeDetail`.
