# Report 01, round 1: Mobile foundations, chrome and overlays

*Filed by the supervisor from the builder's final message (the harness does not let builders write report files). Branch `worktree-agent-aa6ce584da611723f`, commit `d30c73c`, merged into `mobile-ux` as `3292f00`.*

## Done
All ten deliverables are in, and every check the spec names passes. Two decisions go slightly past the spec's wording, and one acceptance target is not met:
- Two deviations, both needed so the existing tests stay green (Open questions 1 and 2): the 16px field rule needs `!important`; a 44px minimum height for text fields on touch was added.
- Not met: the mobile header is 53px, not 40px or less (Known gaps).

## Files
- `tailwind.config.js`: adds `share.hairline` `#23262a`, `share.onSurfaceDim` `#7d8a8f`, `share.barBg` `#131518`.
- `src/index.css`: base layer, touch only: the 16px field rule plus a `:where(...)` 44px field minimum height; base layer: the reduced-motion rule; utilities: `.overline` (also `text-decoration-line: none`, because Tailwind ships a core `overline` class), `.page-title`, `.stat-number`, `.toast-dock` (bottom-right at 1024px and up).
- `src/hooks/useCoarsePointer.ts` (new): `useCoarsePointer()`, `readCoarse(mql)`, `coarsePointerQuery()`, `COARSE_POINTER_QUERY`. `src/hooks/useCoarsePointer.test.ts` (new): pure helpers only (`@testing-library/react` not installed; no dependency added).
- `src/components/planner/MobileTabBar.tsx`: `bg-share-barBg`, `border-share-hairline`, inline safe-area left/right padding, `backdrop-blur` removed; items `gap-[5px] text-[11px]`, inactive `font-semibold text-share-onSurfaceDim`, active `font-bold text-share-primary`. Destinations, SVGs, test id, `touch-target`, `md:left-[240px] lg:hidden` unchanged.
- `src/components/layout/AppChrome.tsx`: mobile header `py-1`, wordmark `text-sm`.
- `src/pages/CalendarSyncPage.tsx`, `CalendarCallbackPage.tsx`: render `MobileTabBar` (already `pb-28` on phones). `src/pages/ChallengeJoinPage.tsx`: renders it; padding `pt-8 pb-24 md:pb-8`. `src/pages/ChallengePage.tsx`: `{tabBar}` added to the loading branch (the signed-out branch already had it).
- `src/components/auth/LoginForm.tsx`: inputs `min-h-12 text-base`; submit `min-h-12`; the two secondary buttons `touch-target -mx-2 px-2 py-2 rounded-lg`; gap `gap-3` → `gap-1`.
- `src/components/planner/UndoToast.tsx`: `toast-dock pointer-events-none flex justify-center`. `CompletionClaimPrompt.tsx`: `toast-dock mx-auto max-w-sm`; both buttons `touch-target-coarse`.
- `e2e/helpers/mobile.ts` (new): `PHONE`, `seedRichDay`, `undersizedTouchTargets` (widened selector), `tinyTexts`, `hiddenControls`, plus `RICH_IDS`, `LONG_TITLE_TOP`, `LONG_TITLE_LIST` (both exactly 80 characters). Habit ids from `DEFAULT_HABIT_DEFINITIONS`: `habit-gym`, `habit-deep-work`, `habit-journal`.
- `e2e/mobile-responsive.spec.ts`: imports from the helper (`test.use(PHONE)`); new tests (a) four route tab-bar checks, (b) 16px fields on Today with the rich seed, (c) reduced-motion rule, (d) tab bar background `rgb(19, 21, 24)`, (e) Undo toast above the tab bar (deletes "Buy groceries" via "Task options", so not skipped; also asserts toast buttons ≥ 44px), plus a `/challenge` sign-in check (fields and submit ≥ 48px, `undersizedTouchTargets` `[]`).
- `e2e/mobile-redesign.spec.ts`: header comment no longer says Today opens with a NOW card.

## Verification
- `npm run lint`: no output. `npx tsc -b`: exit 0. `npx vite build`: `✓ built in 2.26s`.
- `npm test`: 19 files, 287 tests passed. `npm run test:convex`: 7 files, 96 passed.
- `npx playwright test e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts --reporter=line`: `62 passed (1.2m)`, none skipped.
- Extra: `e2e/work-safety.spec.ts e2e/completion-claim-blocks.spec.ts e2e/minimal-today.spec.ts`: `23 passed`.
- A temporary probe (deleted, not committed) measured the phone header at 53px on `/`, `/challenge`, `/review`, and the tab bar at 68px.
- e2e in the worktree needed `npm ci` and copies of the gitignored `.env` and `.env.local` (not committed).

## Open questions
1. The 16px rule needs `!important` (a base-layer rule loses to `text-xs`/`text-sm` on fields; test (b) caught `TaskDurationPicker`'s select at 12px). Side effects, touch only: a field larger than its parent's text drops to `max(16px, parent size)`; `sm:text-sm` on `AddTaskInput` gives 16px on touch tablets.
2. A 44px field minimum height on touch was added (`:where(input…, select, textarea) { min-height: 44px }`) because widening the gate to `input` made the "controls are thumb-sized" test fail on the 38px "Add a task" input, which spec 02 owns. Zero specificity, so a field's own `min-h-*` wins.
3. `ChallengePage` already had the tab bar in the signed-out branch; the loading branch was the missing one.
4. `undersizedTouchTargets` skips a `label[for]` whose field is visible and ≥ 44x44 (the sign-in labels are 308x20 with 48px fields). A label for a hidden or small control is still measured.
5. `.toast-dock` moves desktop toasts from bottom-centre to bottom-right at 1024px+, as the spec defined.

## Known gaps
- Header height: 53px, not ≤ 40px (was ~65px). The account-menu trigger is a 44px touch target, so `py-1` gives 44 + 8 + 1. `AccountMenu.tsx` was outside the spec.
- The tab bar measures 68px (scout measured 65 before); `DayPlanner`'s spacer is `h-16` (64px). The "content clears the bar" test still passes; spec 02 should check the spacer.

## Suggestions
- `e2e/mobile-redesign.spec.ts:35` still has a seed comment about "the NOW card".
- A probe with the rich seed on `/` found 8 texts under 11px, 3 hidden controls and 27 undersized targets (spec 02's baseline); on `/challenge` all three are 0.
- `CLAUDE.md` "Responsive foundations" rule 1 names `AppMobileNav`, which does not exist; `MobileTabBar` now sets the inline insets.
- `.overline`, `.page-title`, `.stat-number` do not appear in the built CSS until something uses them (Tailwind drops unused classes).
