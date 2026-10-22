# Spec 01: Mobile foundations, chrome and overlays

*Run:* `docs/00-orchestration/runs/2026-10-22-mobile-ux/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 60 minutes of agent work

## Goal
When this is done, every phone screen stands on the same base: the three missing design tokens exist, text and controls have a shared minimum size, inputs no longer zoom iOS, the tab bar matches the artboards and reaches every route, every sheet and toast sits above the tab bar and clears the home indicator, and the e2e suite has shared helpers so the next two specs can gate their own screens. Two later specs (Today; Focus/Habits/Review/Challenge) build on this one, so names defined here are a contract.

## Inputs (read all of these first)
- `CLAUDE.md`: "Responsive foundations" (the four rules), "Design".
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-code-survey.md`: §1 foundations, §6 fixed chrome, §9 tests, §10 hazards (iOS zoom, vh, reduced motion, insets).
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-design-gap.md`: §0 global artboard language, §6 chrome and tab bar, §7 tokens.
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-mobile-audit.md`: problems 8 and 10.
- `src/index.css`, `tailwind.config.js`, `index.html`.
- `src/components/planner/MobileTabBar.tsx`, `src/components/layout/AppChrome.tsx`.
- `src/components/planner/UndoToast.tsx`, `src/components/planner/CompletionClaimPrompt.tsx`.
- `src/components/auth/LoginForm.tsx`.
- `src/pages/CalendarSyncPage.tsx`, `src/pages/CalendarCallbackPage.tsx`, `src/pages/ChallengeJoinPage.tsx`.
- `e2e/mobile-responsive.spec.ts`, `e2e/mobile-redesign.spec.ts`, `e2e/minimal-today.spec.ts`.

## Deliverables (exact paths)
1. `tailwind.config.js`: three new colours under `theme.extend.colors.share`, exactly these names and values: `hairline: "#23262a"`, `onSurfaceDim: "#7d8a8f"`, `barBg: "#131518"`.
2. `src/index.css`:
   - In `@layer base`, inside `@media (pointer: coarse)`: `input, select, textarea { font-size: max(16px, 1em); }` so iOS never zooms on focus. Keep `.text-base sm:text-sm` in `AddTaskInput.tsx` working (do not edit that file).
   - In `@layer base`: a `prefers-reduced-motion: reduce` rule that sets `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important` on `*, *::before, *::after`.
   - In `@layer utilities`: `.overline` (font-size 11px, font-weight 800, letter-spacing 0.09em, uppercase, colour `share.onSurfaceVariant`), `.page-title` (`font-shareHeadline`, 21px, weight 800, line-height 1.15, colour `share.onBg`), `.stat-number` (`font-shareHeadline`, 38px, weight 800, line-height 1, `font-variant-numeric: tabular-nums`), `.toast-dock` (`position: fixed; left: 1rem; right: 1rem; z-index: 70; bottom: calc(4.5rem + env(safe-area-inset-bottom))`, and at `lg` `left: auto; right: 1.5rem; bottom: 1.5rem`). Keep the existing utilities.
3. `src/hooks/useCoarsePointer.ts`: `export function useCoarsePointer(): boolean` using `window.matchMedia('(pointer: coarse)')` with a change listener, SSR-safe (false when `window` is undefined), with a unit test `src/hooks/useCoarsePointer.test.ts` that stubs `matchMedia` (vitest, node env; use `@testing-library/react` only if already installed, otherwise test the pure `readCoarse(mql)` helper you export).
4. `src/components/planner/MobileTabBar.tsx`: bar background `bg-share-barBg`, top border `border-share-hairline`, inactive items `text-share-onSurfaceDim font-semibold`, active `text-share-primary font-bold`, labels 11px (`text-[11px]`), icon-to-label gap 5px, items keep `touch-target`; the bar sets `paddingLeft: env(safe-area-inset-left)` and `paddingRight: env(safe-area-inset-right)` inline (fixed elements cannot inherit the shell's `px-safe`). Keep the four destinations, the SVGs, `data-testid="mobile-tab-bar"`, and the `md:left-[240px] lg:hidden` behaviour.
5. `src/components/layout/AppChrome.tsx`: the mobile-only header row becomes 40px tall at most (`py-1`, wordmark `text-sm`), still only when `trailing` is passed. Nothing else changes in the shell.
6. Tab bar on every phone route: `src/pages/CalendarSyncPage.tsx`, `src/pages/CalendarCallbackPage.tsx` and `src/pages/ChallengeJoinPage.tsx` render `<MobileTabBar activeTab={null} onTabChange={(tab) => navigate(`/?tab=${tab}`)} />` and give their content `pb-24` (or equivalent) so the last control clears the bar. `ChallengePage.tsx` already renders it in two of three branches; add it to the signed-out branch too.
7. `src/components/auth/LoginForm.tsx`: inputs 48px tall (`min-h-12`) and 16px text on phones (`text-base`), the submit button `min-h-12`, the "Sign up / Sign in" toggle and "Continue as guest" buttons `touch-target` with visible padding. Desktop may keep the same sizes.
8. Toasts: `src/components/planner/UndoToast.tsx` and `src/components/planner/CompletionClaimPrompt.tsx` use `.toast-dock` instead of their own `fixed bottom-20 … z-[70]` classes, and every button inside them is at least 44px tall (`touch-target-coarse` or `min-h-11`). Keep their text and behaviour.
9. `e2e/helpers/mobile.ts` (new): export `PHONE` (the 390x844 context options used by mobile-responsive.spec.ts), `seedRichDay(page)` (an `addInitScript` seeding a guest day with: 3 `mustDo` tasks, one done, one with `durationMinutes: 90` and `scheduledAt: "14:00"`, one with an 80-character title; 5 `highPriority` tasks including one 80-character title, one subtask via `parentId`, one done, one with `durationMinutes: 45`; one finished 45-minute `deepWorkSession` with `taskId` of the 90-minute task; `habitCompletions` keyed by the real default habit ids from `src/domain/types.ts` `DEFAULT_HABIT_DEFINITIONS`), `undersizedTouchTargets(page)` (moved verbatim from mobile-responsive.spec.ts and widened to include `textarea, input:not([type=hidden]), [role=menuitem], [role=tab], label[for]`), `tinyTexts(page, minPx = 11)` (visible text nodes with computed font-size below `minPx`, returning distinct texts), and `hiddenControls(page)` (visible-in-layout buttons/links whose computed `opacity` is 0 or whose `color` is transparent). `e2e/mobile-responsive.spec.ts` imports from the helper instead of defining `undersizedTouchTargets` locally.
10. `e2e/mobile-responsive.spec.ts` gains tests: (a) `/calendar`, `/calendar/callback`, `/challenge/join?invite=x` and `/challenge` each show the fixed bottom tab bar on a phone; (b) on `/` with `seedRichDay`, after focusing the "Add a task" input every `input, select, textarea` on the page has computed font-size ≥ 16px; (c) the stylesheet contains a `prefers-reduced-motion` rule; (d) the tab bar's computed background equals `rgb(19, 21, 24)`; (e) on `/`, with the Undo toast shown (delete a seeded task via its menu if reachable, otherwise skip with `test.skip` and say why in the report), the toast's bottom edge is above the tab bar's top edge. Existing tests stay green; update the stale header comment in `e2e/mobile-redesign.spec.ts` (it still says Today opens with a NOW card).

## Acceptance criteria (each one checkable by a scout)
1. `grep -n "hairline\|onSurfaceDim\|barBg" tailwind.config.js` shows the three tokens with the exact hex values above.
2. `src/index.css` contains the coarse-pointer 16px input rule, the reduced-motion rule, and the four utilities `.overline`, `.page-title`, `.stat-number`, `.toast-dock`.
3. `src/hooks/useCoarsePointer.ts` exists, is exported, and its unit test passes under `npm test`.
4. `MobileTabBar.tsx` uses `bg-share-barBg`, `border-share-hairline`, `text-share-onSurfaceDim`, `text-[11px]`, and sets the two inline safe-area paddings.
5. On a 390x844 phone context, `/calendar`, `/calendar/callback`, `/challenge/join?invite=x` and signed-out `/challenge` each render `[data-testid="mobile-tab-bar"]` fixed at the bottom (e2e test passes).
6. On `/` with the rich seed, no `input`, `select` or `textarea` has a computed font-size under 16px in the phone context (e2e test passes).
7. `UndoToast` and `CompletionClaimPrompt` carry the `toast-dock` class and no `bottom-20`; their buttons measure ≥ 44px tall in the phone context.
8. `LoginForm` inputs and submit measure ≥ 48px tall and the two secondary buttons ≥ 44px in the phone context (`/challenge` signed out, checked with `undersizedTouchTargets` returning `[]` for that page).
9. `e2e/helpers/mobile.ts` exports `PHONE`, `seedRichDay`, `undersizedTouchTargets`, `tinyTexts`, `hiddenControls`, and `mobile-responsive.spec.ts` imports `undersizedTouchTargets` from it.
10. `npm run lint`, `npx tsc -b`, `npx vite build`, `npm test`, `npm run test:convex` and `npx playwright test e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts --reporter=line` all pass; the report quotes the final lines.
11. No file outside the Deliverables list is modified, except `package.json`/lockfile if a dev dependency is strictly needed (say which and why).

## Constraints
- Project rules from `CLAUDE.md` apply (dvh not vh; 44px targets; safe-area pairs; the `short:` and `touch:` variants).
- Do not touch `DayPlanner.tsx`, `TaskItem.tsx`, `MustDoPinnedHeader.tsx`, `SectionColumn.tsx`, `TaskProgressSheet.tsx`, `DayHeader.tsx`, `ChallengeCard.tsx`, the Focus/Habits panels, `ReviewPage.tsx`, `ChallengePage.tsx` content, or `HabitEditorModal.tsx`; later specs own them.
- Desktop (`lg+`) must look and behave as it does now; verify with the crawl spec.
- Keep the one-accent rule: `share.primary` for act-now, `share.tertiary` for warnings; do not introduce new colour names beyond the three tokens.
- Commit your work on the worktree branch with a clear message (local commit only; no push, no PR).

## Out of scope
- Row anatomy, menus, sheets on Today (spec 02).
- Focus idle redesign, Habits rows, Review and Challenge page content (spec 03).
- Removing the mobile wordmark header entirely (decided: slim it, keep it).
- Adding a fifth tab for Challenge (decided: no; 280px screens).

## Verification the builder must run
- `npm run lint && npx tsc -b && npx vite build` (on Windows run `npx tsc -b` and `npx vite build` separately).
- `npm test` and `npm run test:convex`.
- `npx playwright test e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts --reporter=line` (Chromium is installed; the config starts Vite on 5173 and reuses an existing server, so make sure no other Vite is on 5173, or start your own with `--port 5173`).

## Report to
`report-01-round1.md` in the run folder, using `~/.claude/skills/orchestrate/templates/REPORT.md`. If the harness refuses the write, return the full report as your final message and name the worktree branch.
