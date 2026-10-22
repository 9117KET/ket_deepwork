# Check 01, round 1 (scout, Mode B)

*Filed by the supervisor from the scout's final message. Checked `mobile-ux` at merge 3292f00 in a detached worktree (the branch itself is checked out in the main repo), removed afterwards.*

## Verification re-run
- `npm run lint`: exit 0. `npx tsc -b`: exit 0. `npx vite build`: `✓ built in 5.22s`.
- `npm test`: 19 files, 287 tests passed.
- `npx playwright test e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts --reporter=line`: `37 passed (1.3m)`.
- Not run: `npm run test:convex`, `e2e/crawl.spec.ts` (criterion 10 only partly re-checked; the builder's own run covered both).

## Acceptance criteria
1. Met: `tailwind.config.js:42,44,46`.
2. Met: 16px rule `src/index.css:34-39`; reduced motion `:49-57`; utilities `:127-163`.
3. Met: `useCoarsePointer.ts` + test; `npm test` green.
4. Met: `MobileTabBar.tsx:73,77,87,91-92`.
5. Met: `mobile-responsive.spec.ts:341` passes; bar at `CalendarSyncPage.tsx:308`, `CalendarCallbackPage.tsx:85`, `ChallengeJoinPage.tsx:164`, `ChallengePage.tsx:65,81`.
6. Met: `mobile-responsive.spec.ts:357`.
7. Met on classes, partly measured: `UndoToast.tsx:24`, `CompletionClaimPrompt.tsx:72` use `toast-dock`; buttons `touch-target-coarse` (`UndoToast.tsx:33,42`, `CompletionClaimPrompt.tsx:99,106`); only the undo toast is measured by a test.
8. Met: `LoginForm.tsx:85,101,121,144,152`; test at `:438`.
9. Met: `e2e/helpers/mobile.ts:16,50,134,189,216`; imported at `mobile-responsive.spec.ts:13`.
10. Partly checked (see above).
11. Met: `git show --stat d30c73c` lists 16 files, all in Deliverables; `package.json` and lockfile untouched.

## Supervisor's four checks
1. Met: both coarse rules inside `@media (pointer: coarse)` (`index.css:34-44`). 2. Met: toast 70, bar 60, sheets 80. 3. Met. 4. Met: habit ids exist (`types.ts:382-391`).

## Findings, most serious first
1. Minor: the 16px rule uses `!important` (`index.css:38`); deliberate and commented.
2. Minor: the 44px field floor (`index.css:43`) goes beyond the spec; zero specificity, a `min-h-*` utility wins.
3. Minor: `CompletionClaimPrompt.tsx:99,106` combine `touch-target-coarse` with `min-h-[32px]`; which wins depends on CSS order and nothing measures it. → FIX round.
4. Nit: `CompletionClaimPrompt.tsx:72` keeps `lg:bottom-6` beside `toast-dock` (harmless, same value). → FIX round.

No invented figures, no outward actions.
