# Report: spec 04, round 3 — filed by the supervisor from the builder's final message

All three fixes in. `npx tsc -b`, `npm run lint` clean; `npm test` 25 files / 389 passed. Only `ChallengeDetail.tsx`, `challengeList.ts`, `challengeList.test.ts` changed; nothing committed. Enter behaviour not tried in a browser (no signed-in e2e).

1. `CommitmentToggle`: `aria-label` is the commitment's text; `aria-pressed` carries the state; "Kept:/Not yet:/Broke:" wording and the `label` prop removed; visible text and shapes unchanged.
2. Enter in any of the four date/time fields saves, through an Enter handler on the form (no hidden submit); the form is `noValidate` so the app's own checks run; Enter and submit ignored while a save runs; Escape and Cancel unchanged.
3. `seasonDatesError` returns `field: 'start'` ("Pick a start date.") or `'end'` ("Pick an end date."); the dates sheet marks and focuses Starts. Adjustment: `ChallengeCreatePage` (not editable in this spec) keys its ids on the old field type with no start slot, so a wider `SeasonDateField` type was added and `seasonStepError` still reports a start problem as `'end'` for the create form. Tests cover blank/malformed start and end and the create-form mapping.
