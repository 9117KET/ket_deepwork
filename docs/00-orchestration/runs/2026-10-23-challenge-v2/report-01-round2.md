# Report 01, round 2: per-member, editable goals and don'ts

*Filed by the supervisor from builder-01's final message.* New commit `07067a5` on `worktree-agent-ae2b7026e3f8da523`.

## Done
Text left in a `ListEditor`'s Add box is no longer lost: one tap on Save, Create or Join sends it; a tap on Add adds it once. The builder changed the supervisor's design: adding on blur alone swallows the tap that caused the blur (the new row moves the Save button under the pointer before the press ends — reproduced with mouse and touch). Now: leaving the box commits the draft as a row, unless the blur comes from a button press; for those, the parent folds the draft in itself (`onDraftChange` + `withDraft`). Cancel or × on another row leaves the draft in the box.

## Files
- `src/domain/challengeCommitments.ts`: `commitDraft(items, draft, max)`, `MAX_COMMITMENTS = 10`, `withDraft(items, draft)`; 3 new tests (helpers and the blur-then-Add sequence adds once).
- `src/components/challenge/ListEditor.tsx`: draft read from a ref; blur commits unless within 1 s of a `pointerdown` on a button/link (document capture listener); `onDraftChange` prop.
- `CommitmentsSheet.tsx`, `ChallengeCreateForm.tsx`, `ChallengeJoinPage.tsx`: a draft per list, `withDraft(...)` on submit.

## Verification
`npm run test:convex` 108 passed; `npm test` 296 passed (was 293); lint clean; `tsc -b` exit 0; `vite build` ok. Hand check through a temporary Vite harness mounting the real `ListEditor` as the three parents wire it, run in Playwright with mouse and with touch (390×844, `hasTouch`): Save with text in the box includes it; Add once adds one row; tapping plain text commits the draft; Enter adds; blank adds nothing. Harness deleted, not committed. e2e not re-run this round (only the editor changed; the gates render the signed-out form).

## Open questions
- The 1 s window: a keyboard Tab out of the box within a second of tapping an unrelated button leaves the draft in the box; it is still sent on submit.

## Fixes applied
- Fix 1: done, with the design change above. Commit `07067a5`.
