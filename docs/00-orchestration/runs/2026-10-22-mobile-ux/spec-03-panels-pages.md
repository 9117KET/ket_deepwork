# Spec 03: Focus, Habits, Review and Challenge on a phone

*Run:* `docs/00-orchestration/runs/2026-10-22-mobile-ux/` · *Builder:* builder (Opus) · *Worktree:* yes (branched from the integration branch that already contains spec 01) ·
*Time box:* 120 minutes of agent work

## Goal
The Focus tab's idle screen becomes a phone screen rather than the desktop timer card: one full-width 48px Start, thumb-sized presets, centred digits. The Habits rows are tappable as whole rows. Review and the Challenge pages use the artboard type roles and thumb-sized controls, with no text under 11px and every input 16px on phones. Desktop keeps working; the one-accent rule removes sky and teal from the timer.

## Inputs (read all of these first)
- `CLAUDE.md`: "Responsive foundations", "Deep Work framework" items 1, 9, "Atomic Habits features", "Accountability challenge".
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-mobile-audit.md`: problems 5, 6, 7, 10 and the screenshots `390-focus.png`, `390-habits.png`, `390-review.png`, `390-challenge.png` in the scratchpad folder it names.
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-design-gap.md`: §0, §2 Focus, §3 Habits, §4 Review, §5 Challenge, §7 tokens.
- `docs/00-orchestration/runs/2026-10-22-mobile-ux/scout-code-survey.md`: §4, §5, §6 (HabitEditorModal), §8, §10 (iOS zoom list).
- `docs/design/mobile/Focus.dc.html`, `Habits.dc.html`, `Review.dc.html` and their PNG previews.
- Spec 01's deliverables, already on your branch: tokens `share.hairline`, `share.onSurfaceDim`, `share.barBg`; utilities `.overline`, `.page-title`, `.stat-number`, `.toast-dock`; `src/hooks/useCoarsePointer.ts`; `e2e/helpers/mobile.ts`.
- `src/components/timer/MobileFocusPanel.tsx`, `DeepWorkTimer.tsx`, `BlockLengthLine.tsx` (if present), `useDeepWorkTimer.ts`; `src/components/habits/MobileHabitsPanel.tsx`, `HabitChecklist.tsx`, `HabitEditorModal.tsx`; `src/pages/ReviewPage.tsx`, `src/pages/ChallengePage.tsx`, `src/components/challenge/*.tsx` except `ChallengeCard.tsx` (spec 02 owns it); `src/pages/ChallengeJoinPage.tsx` content (spec 01 only added its tab bar).
- `e2e/mobile-redesign.spec.ts` (Focus and Habits tests it pins), `e2e/crawl.spec.ts`.

## Deliverables (exact paths)
1. **`src/components/timer/MobileFocusPanel.tsx`, idle state:** its own layout, not the `DeepWorkTimer` card. Top to bottom inside a flex column that fills `min-h-[calc(100dvh-7.5rem)]` and centres its middle: the `.overline` "Working on" and a full-width 48px `<select>` (16px text) of the day's trackable tasks plus "No task, just log the time"; a full-width 48px label input; a preset row of five 48px pills (`25m 45m 60m 90m` and a custom minutes field that reads "Custom" until tapped, then shows a numeric input) laid out as a 5-column grid with 8px gaps, the selected pill `bg-share-primary text-share-onPrimary`, the others `bg-share-hairline text-share-onSurface`; the "Your block: 45m on · 10m off" line at 12px with its "Make Nm my block" action as a 44px text button when offered; the digits centred in `font-shareHeadline` 62px tabular (`tracking-[-0.03em]`) with "ready" under them at 12px `text-share-onSurfaceDim`; a full-width 48px Start button `bg-share-primary text-share-onPrimary font-bold text-[15px]`; the mute toggle as a 44x44 icon button in the top-right of the panel. Keep every behaviour of `DeepWorkTimer` (task attribution lock while running, block length, mute, the away-block claim, `data-testid="mobile-focus-idle"`), reusing its hooks or extracting shared pieces; do not duplicate timer logic.
2. **`MobileFocusPanel.tsx`, running/paused state:** vertical centring via the same flex column (spacers, not fixed margins); the ring track `bg`/stroke use the tokens (`share.hairline`, `share.primary`) rather than raw hex; the "Working on" label becomes `.overline`; nothing else changes (`data-testid="mobile-focus-running"`, the three controls, the confirm sheet).
3. **`src/components/timer/DeepWorkTimer.tsx` (desktop rail):** one-accent clean-up only: the selected preset chip, the Start button, the custom input focus ring, the "your block" dot and the block-complete state use `share.primary`/`share.onPrimary`/`share.primaryContainer` instead of `sky-*`/`teal-*`/`slate-950`. Layout unchanged.
4. **`src/components/habits/MobileHabitsPanel.tsx`:** each habit row is one `<button>` (min 56px tall, `rounded-xl`) that toggles the habit, with the 28px check square as a visual inside it, the name at 15px/600, the seven dots as 8px circles (done `bg-share-primary`, missed `bg-share-hairline`, broken chain `bg-share-tertiary`) and the streak at 12px tabular; the at-risk state keeps the `share.tertiary` border and an 11px "missed yesterday" label; the identity input is 16px with a 44px hit area; the footer reads "Last 7 days." (the month grid no longer exists); the Edit button stays 44px.
5. **`src/components/habits/HabitEditorModal.tsx`:** on phones a bottom sheet (`fixed inset-0 z-[80]`, `pb-safe-nav`, `max-h-[85dvh] overflow-y-auto`), on desktop the centred card; every control (reorder chevrons, delete, add, Save, Cancel) ≥ 44px; inputs 16px on phones; `dvh` not `vh`.
6. **`src/pages/ReviewPage.tsx`:** heading uses `.page-title` ("This week"), the week-range line 12px; the deep-work overline uses `.overline`; the big number uses `.stat-number` with the "/ 20h" unit at 14px/600; the goal input is 44px tall and 16px on phones; the bar chart is 80px tall with 11px day letters in `text-share-onSurfaceDim`; the habit dots are 12px with `bg-share-tertiary` for a broken chain (no hard-coded hex); the hand-logged line 12px.
7. **Challenge screens** (`src/pages/ChallengePage.tsx`, `src/components/challenge/ChallengeDashboard.tsx`, `MemberDayCard.tsx`, `HistoryGrid.tsx`, `ChallengeReviewSection.tsx`, `ChallengeCreateForm.tsx`, `ChallengeJoinPanel.tsx`, `CheckinSheet.tsx`, `src/pages/ChallengeJoinPage.tsx`): page title `.page-title`; section headings `.overline`; the countdown number `.stat-number` with "days left" at 14px/600; cards `rounded-2xl bg-share-surfaceContainerLow` without a border (the Review card language); every button, link, checkbox row and list-remove control ≥ 44px on phones; every input/textarea 16px on phones and ≥ 44px tall; no text under 11px (HistoryGrid legend and captions become 11px minimum); `MemberDayCard` keeps emerald only for the "✓ Plan"/"✓ Check-in" stamps (README exception) and uses `share.tertiary` for "Broke:"; the invite-link block's link text is 12px monospace and selectable; `CheckinSheet` rows ≥ 48px, textarea 16px.
8. **`e2e/mobile-panels.spec.ts` (new)** using `PHONE`, `seedRichDay`, `undersizedTouchTargets`, `tinyTexts` from `e2e/helpers/mobile.ts`: (a) on `/?tab=focus` idle: `undersizedTouchTargets` is `[]`, `tinyTexts(page, 11)` is `[]`, the Start button is ≥ 48px tall and its width ≥ 90% of the panel width; tapping Start shows `mobile-focus-running`; the ring and digits are vertically within the middle 60% of the viewport; (b) on `/?tab=habits`: `undersizedTouchTargets` is `[]`, `tinyTexts` is `[]`, tapping anywhere on a habit row's name toggles it (the count "1 of N today" updates) and the toggle persists on reload; "Edit habit list" opens a dialog whose Save/Cancel are ≥ 44px and above the tab bar; (c) on `/review`: `undersizedTouchTargets` is `[]`, `tinyTexts` is `[]`, the heading uses the 21px size (computed font-size 21px); (d) on `/challenge` (guest): `undersizedTouchTargets` is `[]`; (e) on `/challenge/join?invite=x` (guest): `undersizedTouchTargets` is `[]`.
9. One sentence each in `CLAUDE.md` "Atomic Habits features" (week-of-habits line) and in `docs/design/README.md` status table rows for mobile `Focus` and `Habits` describing what changed (keep it to the facts).

## Acceptance criteria (each one checkable by a scout)
1. `e2e/mobile-panels.spec.ts` passes in full; the report quotes the run.
2. In the phone context on `/?tab=focus` idle, the Start button measures ≥ 48px tall and spans ≥ 90% of the panel; `grep -n "sky-\|teal-\|slate-950" src/components/timer/DeepWorkTimer.tsx src/components/timer/MobileFocusPanel.tsx` returns nothing; raw `#23262a`/`#00daf3` are gone from `MobileFocusPanel.tsx`.
3. `MobileHabitsPanel.tsx`: each habit row is a single `<button>` ≥ 56px; the footer no longer mentions a month grid; `grep -n "outlineVariant/40\|bg-\[#" src/components/habits/MobileHabitsPanel.tsx src/pages/ReviewPage.tsx` returns nothing.
4. `HabitEditorModal.tsx` is `z-[80]`, uses `dvh`, and `undersizedTouchTargets` is `[]` while it is open (e2e 8(b)).
5. `ReviewPage.tsx` uses `.page-title`, `.overline`, `.stat-number`; the goal input is ≥ 44px and 16px in the phone context.
6. Every file under `src/components/challenge/` except `ChallengeCard.tsx`, plus `ChallengePage.tsx` and `ChallengeJoinPage.tsx`, has no `text-[10px]`; the challenge pages pass `undersizedTouchTargets` (e2e 8(d), 8(e)).
7. `e2e/mobile-redesign.spec.ts` Focus and Habits tests still pass unchanged (idle → running flow, finishing early keeps minutes, identity, "Last 7 days", "missed yesterday", toggles persist).
8. Desktop unchanged in behaviour: `npx playwright test e2e/crawl.spec.ts e2e/mobile-redesign.spec.ts e2e/mobile-responsive.spec.ts e2e/mobile-panels.spec.ts --reporter=line` passes; `npm test`, `npm run test:convex`, `npm run lint`, `npx tsc -b`, `npx vite build` pass; the report quotes the final lines.
9. No edits to files owned by specs 01 and 02 (listed under Constraints).

## Constraints
- Project rules from `CLAUDE.md` apply. Timer behaviour is pinned by `e2e/mobile-redesign.spec.ts` and `useDeepWorkTimer`; do not change what a block records.
- One accent: `share.primary` act-now, `share.tertiary` warnings, emerald only on done stamps; no sky, teal, violet, orange.
- Do not edit `MobileTabBar.tsx`, `AppChrome.tsx`, `index.css`, `tailwind.config.js`, `e2e/helpers/mobile.ts`, `e2e/mobile-responsive.spec.ts`, `LoginForm.tsx` (spec 01), nor `DayPlanner.tsx`, `DayHeader.tsx`, `TaskItem.tsx`, `MustDoPinnedHeader.tsx`, `SectionColumn.tsx`, `TaskProgressSheet.tsx`, `ChallengeCard.tsx` (spec 02). If you need a prop from `DayPlanner.tsx` for the Focus panel that does not exist, list it under Open questions and work with what `MobileFocusPanel` already receives.
- Commit on the worktree branch; no push, no PR.

## Out of scope
- The Focus running-state redesign beyond centring and tokens.
- Today, the task rows, the sheets on Today (spec 02).
- New features on Review or Challenge.

## Verification the builder must run
- `npm run lint`; `npx tsc -b`; `npx vite build`; `npm test`; `npm run test:convex`.
- `npx playwright test e2e/mobile-panels.spec.ts e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts --reporter=line`.
- Screenshots at 390x844 of `/?tab=focus` (idle) and `/?tab=habits` into the scratchpad folder, viewed, and described in one sentence each in the report.

## Report to
`report-03-round1.md` in the run folder, using `~/.claude/skills/orchestrate/templates/REPORT.md`. If the harness refuses the write, return the full report as your final message and name the worktree branch.
