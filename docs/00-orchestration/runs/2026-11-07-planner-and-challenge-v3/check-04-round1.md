# Check 04, round 1 (scout, Sonnet) — filed by the supervisor

Ran from the worktree: `npx tsc -b` clean; `npm run lint` clean; `npm test` 25 files / 389 passed; `npx vite build` (scratch outDir) built. Playwright not run. Read `challengeCommitments.ts` last (the round-2 version, "2 of 3").

## Findings
1. Medium — `keptLine` gives "Kept 2 of 3 goals" for criterion 3's example, not "2 of 2". **Supervisor:** resolved before this check landed; criterion 3 amended (the builder's formula is the honest one).
2. Low — `CommitmentToggle`: `aria-label` "Kept: X"/"Not yet: X" plus `aria-pressed` says the state twice ("Not yet: Read, toggle button, not pressed"). **Supervisor:** FIX — label is the goal/don't text, `aria-pressed` carries the state; contract §B wording amended.
3. Low — `DatesSheet`: `onSubmit` exists but no submit button sits inside the form (Save is in the Sheet footer), so Enter in a field does nothing. **Supervisor:** FIX.
4. Low — `seasonDatesError` returns `field: 'end'` for every format error, so a blank Starts focuses Ends. **Supervisor:** FIX.
5. Low — planned minutes include private tasks; a partner could subtract visible lengths to estimate private minutes; no titles leak. **Supervisor:** accepted (decision 7, counted never titled); in the summary for the user.
6. Info — `buildChallengeSummary` now always sends `plannedMinutes`/`doneMinutes`; a client shipped before the backend has every `syncDaySummary` refused. Backend first. **Supervisor:** known; the summary's deploy steps say so in bold.

## Criteria
1, 2 met (tests `toBe(42)`, `toEqual({planned:200,done:150,percent:75})`); 3 see finding 1; 4 met (`ChallengeDetail.tsx:286`, `:558`; `updateSpan(challengeId, draft)`; `ErrorLine` `role="alert"`); 5 met (null with no commitments; only while `running` `:363`; one kind per call, union type); 6 met (`role="meter"` with min/max/now; `keptLine` only with a day and active goals; "Kept all don'ts" via `hasActiveDonts` + check-in); 7 met (one `PRIMARY` per state; grep for hex/`text-[`/raw colours empty); 8 met for tsc/lint/test/build, Playwright unverified (builder: 11 passed); 9 cannot tell; 10 met.

## As the user
Dates sheet: four fields; client validation via `seasonDatesError`/`seasonDeadlinesError`, `aria-invalid` + focus to the faulty field; server refusal keeps the sheet open with the sentence (error not cleared on edit); Cancel/Escape discard; unchanged save just closes; helper line only when a loaded row has an act. Commitments: optimistic `pending`, all toggles refuse taps in flight, focus kept (`aria-disabled`), rollback + `ErrorLine` on failure; nothing when no commitments; only while running; `min-h-11` (44 px); circle/✓ `share-done`, square/✕ `share-tertiary`, outline when unset.

## Copy
All sentence case with typographic apostrophes; §B strings match word for word; two additions fine ("In each person's own local time. The check-in deadline has to be later than 21:30.", "Pick a start and an end date."). "Planned time done" is a column.

## Privacy
Summary gains two integers; `isPrivate` still filtered from titles; `goalsKept` is ids. Residual inference: finding 5.

## Service vs §A
`updateSpan`, `markDay` (one-kind union), `checkIn.goalsKept?`, `updateMyCommitments` ids from `goalItems` via `goalItemsOf` (fallback `normalizeGoals`) — all match; through `contractApi`.

## Report vs code
"Criteria 1–3 literally" false for 3 (now amended); "Kept 2 of 1" gap stale (fixed); 389 not 388. No component test for `TodayCommitments`/`DatesSheet` (suggested only).
