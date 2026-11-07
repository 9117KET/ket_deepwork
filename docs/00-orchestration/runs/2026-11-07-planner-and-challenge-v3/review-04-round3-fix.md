# Review 04, round 2 → FIX list for round 3 (from `check-04-round1.md`)

Round 2 was APPROVE on the `keptLine` item; the scout check that followed found three small usability defects worth one more round (MAX_ROUNDS 3 allows it).

## FIX

1. `CommitmentToggle`: the `aria-label` is the goal's or don't's text only; `aria-pressed` carries the state (no "Kept:/Not yet:/Broke:" prefix in the label). Keep the visible text as it is. Contract §B's spoken-label wording is withdrawn.
2. `DatesSheet`: pressing Enter in any of the four fields submits the form (a visually hidden submit button inside the form, or the Sheet's Save wired as the form's submit via `form=` id). Escape and Cancel unchanged.
3. `seasonDatesError`: a format error names the field that is wrong (`field: 'start'` when Starts is blank or malformed, `'end'` when Ends is), so the error and the focus land on the right input. Pin with a test in `challengeList.test.ts`.

`npx tsc -b`, `npm run lint`, `npm test` green; same worktree; touch only `ChallengeDetail.tsx`, `challengeList.ts` and its test.
