# Scout: the mobile/touch code layer (Mode A)

*Filed by the supervisor from the scout's final message, 2026-10-22. Read-only; nothing run in a browser, so overlap findings are from source only and marked "to verify". Lines marked "~" came from partial reads; re-grep before quoting in a spec.*

## 1. Foundations
- `index.html:6` viewport = `width=device-width, initial-scale=1.0, viewport-fit=cover` (verified).
- `src/index.css:5-37` `@layer base`: `#root` `min-height:100vh` then `100dvh` (:16-17).
- `src/index.css:39-` `@layer utilities`: `.pb-safe-nav` :49 = `max(0.5rem, env(safe-area-inset-bottom))`; `.pb-safe` :55; `.px-safe` :60; `.inset-x-safe` :66 (defined, unused by the tab bar); `.touch-target` :73 (min 44x44, always); `.touch-target-coarse` :80-84 (inside `@media (pointer: coarse)`). No reduced-motion, no `touch-action` utilities.
- `tailwind.config.js`: `screens.short` = `(max-height: 500px)`, `screens.touch` = `(pointer: coarse)`. Default sm 640, md 768, lg 1024. `spacing.sidebar` = 240px (unused; code hardcodes 240px).
- Share tokens: bg #111316, onBg #e2e2e6, primary #00daf3, onPrimary #00363d, primaryContainer #00b6cb, onSurface #e2e2e6, onSurfaceVariant #bcc9ce, surfaceContainer #1e2023, surfaceContainerHigh #282a2d, surfaceContainerHighest #333538, surfaceContainerLow #1a1c1f, outlineVariant #3d494d, secondary #a1cddd, tertiary #ffb77d. Fonts: shareHeadline (Epilogue), shareSans (Manrope), display (Outfit).
- No `useIsDesktop`, `useMediaQuery` or `matchMedia` anywhere in `src`; every breakpoint switch is CSS-only.

## 2. Hover-only affordances (most consequential first)
- `MustDoPinnedHeader.tsx:395` Remove (X) on a Top 3 row: `text-transparent group-hover:text-…`, invisible on touch at all widths; deletes the task; no touch fallback (Top 3 rows are not TaskItems, so no ⋮ menu).
- `MustDoPinnedHeader.tsx:227` same Remove "✕" in the all-done expanded list. No fallback.
- `MustDoPinnedHeader.tsx:384` private/partner Eye toggle: `text-transparent group-hover:` when not private. No fallback on Top 3 rows.
- `TaskItem.tsx:294` ⋮ "Task options": when `!isReorderable` it is `sm:opacity-0 sm:group-hover:opacity-100`; when `isReorderable` it is `sm:hidden`. At ≥640px on touch (tablet, landscape phone 844x390) there is NO visible menu button; the only entry is the grip's right-click (`:282` onContextMenu). Biggest touch gap.
- `TaskProgressBoxes.tsx:175` play overlay `hidden … opacity-0 group-hover:opacity-100 sm:flex`: decorative; the chip is already a button (:196-205). `:152, :270` `group-hover:border-sky-400`: cosmetic.
- `HabitChecklist.tsx:140` `text-transparent` is a glyph colour, not a hidden control. `ScheduleChip.tsx` `group-hover/chip`: cosmetic.

## 3. Mouse-only interactions
- `TaskItem.tsx:269-270` `draggable` + `onDragStart` (HTML5 DnD, no touch). Fallback: ArrowUp/ArrowDown (~:299-316), `sm:hidden`, root tasks with `!isParent` only. ≥640px touch has no reorder at all.
- Subtasks: reorder is DnD only (`SectionColumn.tsx` ~:265+ `onReorderSubtask`). Touch fallback only re-parents via "Move to…" (`onMoveToAnotherParent`); no reordering.
- `MustDoPinnedHeader.tsx:293-294` `draggable` rows; arrows (~:318-335) `sm:hidden`; grip `hidden sm:block aria-hidden`. Same ≥640px gap.
- `TaskItem.tsx:282` `onContextMenu` on the grip ("Drag to reorder; right-click for menu"); grip `hidden … sm:block`. Fallback ⋮ visible only <640 for reorderable rows.
- `TaskItem.tsx:356` and `:368` `onDoubleClick` starts edit; fallback is the menu "Edit". Double-tap on mobile zooms or selects text.
- `MustDoPinnedHeader.tsx:~210, ~356` title edit is single click (works on touch); `truncate`, so long titles cannot be read.
- `title=`-only explanations with no touch equivalent: `DayHeader.tsx:56, 63, 78`; `HabitChecklist.tsx:109, 164, 170`; `SectionColumn.tsx:197` (overload badge); `TaskItem.tsx:381` (private badge), `:441`; `TaskDurationPicker.tsx:42`; `TaskProgressBoxes.tsx:118, 189, 203, 237, 267, 298, 336, 347`; `DeepWorkTimer.tsx:104, 149, 349, 383`; `ReviewPage.tsx:213, 247`; `HistoryGrid.tsx:51`.
- No other `onMouseEnter`/`onDoubleClick` usages.

## 4. Tap targets without touch-target / touch-target-coarse (explicit small sizes; regex upper bound)
- `MustDoPinnedHeader.tsx` (22 matches): arrows `p-0.5` + `h-3` (~:318-335); Remove X :395 (p-0.5 + h-3.5); Eye :384; "✕" :227; checkboxes `h-4 w-4` (~:214, ~:340, no `sm:` bump); collapse header button ~30px tall; Add/Cancel (`px-2 py-1 text-xs`, ~28px). "+ Add" has `touch-target-coarse` (OK).
- `TaskItem.tsx` (12): arrows `p-0.5` + `h-3 w-3` ~:299-316 (<640px, the phone path, ~16-20px); ⋮ is `touch-target-coarse` + `p-0.5` (OK on coarse); checkbox `h-5 w-5 sm:h-4 sm:w-4` (~:326), label row widens the hit area; context menu items `py-1.5 text-sm` (~32px) :411+.
- `TaskProgressSheet.tsx` (8): close X `-m-1 p-1` + `h-4 w-4` (~24px); manual-log inputs and steppers `min-h-[36px]`.
- `TaskDurationPicker.tsx` `min-h-[36px] px-1 text-xs`. `SessionAttributionPanel.tsx` select `min-h-[36px] text-xs`. `BlockAmountPicker.tsx` `min-h-[32px] … touch-target-coarse` (OK on coarse).
- `CompletionClaimPrompt.tsx` (2): "Log…"/"None" `min-h-[32px] text-xs`, no touch-target. `DayPlanner.tsx:~800` doneOffer buttons `min-h-[32px]`.
- `AwayBlockClaim.tsx` (5); `DeepWorkTimer.tsx` (6, preset chips etc.); `HabitEditorModal.tsx` (5: ChevronUp/Down/X `h-3.5`); `HabitChecklist.tsx` (6, desktop rail only); `DayHeader.tsx` nav buttons use `touch-target` (OK); `AccountMenu.tsx` (2), `AppSidebar.tsx` (2); `CalendarTimeline.tsx` (5), `ScheduleChip.tsx` (2) OK.
- The existing gate (§9) checks only `button, a, [role=button], input[type=checkbox], select` at 390x844 in default state on an empty day.

## 5. Tiny text (counts)
- `text-[10px]`: MustDoPinnedHeader 7 (header label, pips %, `+ Add`, slot numbers); TaskItem 2 (badges); TaskProgressBoxes 2 (:336); MobileHabitsPanel 2; HabitChecklist 1, CalendarTimeline 1, SectionColumn 1 (:196), TaskProgressSheet 1 (:259), FocusMode 1, MobileFocusPanel 1, ReviewPage 1; MobileTabBar 1 (tab labels).
- `text-[11px]`: ChallengeCreateForm 1, ChallengeDashboard 1, ChallengeReviewSection 2, HistoryGrid 2, MemberDayCard 3; MobileHabitsPanel 1, AccountMenu 1; BlockAmountPicker 1; CalendarTimeline 3; CompletionClaimPrompt 1, ScheduleChip 1, SessionAttributionPanel 1, DeepWorkTimer 1, ReviewPage 1.
- `text-xs` on controls/body: DeepWorkTimer 8, ChallengeCard 8, DayPlanner 8, ChallengeDashboard 4, MemberDayCard 5, CheckinSheet 5, MustDoPinnedHeader 5, ReviewPage 5, TaskProgressSheet 5, HabitChecklist 5, CalendarTimeline 4, ScheduleSheet 4, HabitEditorModal 4, AccountMenu 4, RestorePage 4, 1–3 in 18 other files.

## 6. Fixed / sticky chrome
- `MobileTabBar.tsx:83` (last in DayPlanner :948; ReviewPage :267; ChallengePage :65/:83/:125): `fixed bottom-0 left-0 right-0 z-[60] … pb-safe-nav md:left-[240px] lg:hidden`; items `touch-target … py-2 short:py-1` (~44-56px + inset). No `.inset-x-safe`.
- `AppSidebar.tsx:58` `fixed left-0 top-0 z-40 hidden h-dvh w-[240px] … md:flex`. At 768–1023px the sidebar and tab bar both show.
- AppChrome mobile header (`AppChrome.tsx` ~:48) is not fixed: plain `md:hidden` row (py-2.5, ~44px) when `trailing` is passed.
- `FocusMode.tsx:96` `fixed inset-0 z-[60] hidden … lg:flex` (desktop only).
- `TaskProgressSheet.tsx:98` `fixed inset-0 z-[60]`, panel `pb-6` (:107), no max-height/scroll, no `pb-safe-nav`. Same z as the tab bar and DOM-earlier, so the bar paints over the sheet's bottom on phones (to verify). Panel can exceed 844px with attribution open.
- `ScheduleSheet.tsx:77` `z-[80]` with `pb-safe-nav` (:86) OK. `CheckinSheet.tsx:76` `z-[80]` OK.
- `HabitEditorModal.tsx:78` `fixed inset-0 z-50`, list `max-h-[60vh]` (:92): below the tab bar (z-60); uses `vh`.
- Move-subtask picker `DayPlanner.tsx:871` `fixed inset-0 z-50`: below the tab bar.
- TaskItem context menu `TaskItem.tsx:411` `fixed z-50 min-w-[10rem]`, `clampMenu` (~:187) assumes 160x320, PAD 8; ignores the tab bar height; z-50 below the bar.
- Toasts at `bottom-20` `z-[70]` `lg:bottom-6`: `UndoToast.tsx:24`, `CompletionClaimPrompt.tsx:72`, `DayPlanner.tsx:776` (blockNotice), `DayPlanner.tsx:784` (doneOffer). Not stacked (overlap at the same bottom), no safe-area or `short:` handling.
- Sticky: only the lg rail `DayPlanner.tsx:727`. MustDoPinnedHeader comments mention "sticky" but it is not (stale).
- Spacer `DayPlanner.tsx:770` `h-16 pb-safe lg:hidden` (64px) clears the bar; the bar may exceed 64px on notched phones (to verify).

## 7. Narrow-width layout
- TaskItem row (`:~269` `group flex flex-wrap items-center gap-2 py-1.5`): leading grip/⋮/arrows; title `min-w-[8rem] flex-1 basis-0` (:~319); `span.flex.shrink-0` with ScheduleChip + TaskDurationPicker; then TaskProgressBoxes. At 390px the progress chips (`--chip-w:1.75rem`, `TaskProgressBoxes.tsx:66`; collapsed bar `w-24`) wrap to line 2. Duration select `hidden w-[7.5rem] sm:block` when `onSchedule && !isSubtask` (~:392); subtasks show it at 120px inside `ml-6 border-l pl-2`, wrapping at 320px.
- MustDoPinnedHeader row (:298 `flex-wrap gap-x-2 gap-y-1`): slot number, arrows, title `min-w-[8rem] basis-0` (:333), chip + duration (`hidden w-[7.5rem] sm:block` :373), progress boxes, Eye, Remove. At 390px the progress boxes and Eye/Remove wrap. Done-state row (:183) `basis-[55%]`, `truncate` title.
- Top 3 header bar: label `text-[10px] uppercase tracking-wider` + 3 pips (`w-5`) + % with no wrap/truncate; at 280–320px risks overflow (untested with tasks).
- `CalendarTimeline.tsx:130` time column `w-[5.5rem] shrink-0`, title truncates. `AccountMenu.tsx:94` `max-w-[180px] truncate`. `DayHeader.tsx:53` title `truncate` + right cluster of three 44px buttons (~160px) leaves ~150px at 320px for the date.
- `DeepWorkTimer.tsx:139, 220, 273` `flex-wrap`.

## 8. Mobile tab swap (`DayPlanner.tsx`)
- `:135-139` `useState<MobileTab>` reads `?tab=` once at mount; navigating to `/?tab=habits` with the planner already mounted does not switch (to verify).
- Today panel `:624` `hidden lg:block` when not active: stays mounted, CSS-hidden (AwayBlockClaim, DayHeader, ChallengeCard, CalendarTimeline, Top 3, copy button, lists keep running).
- Desktop rail `:727` `hidden … lg:block`: `DeepWorkTimer` and `HabitChecklist` mounted but hidden below lg, so two timer UIs exist in the DOM on phones.
- Focus `:747` mounted only when `mobileTab === 'focus'` (`MobileFocusPanel`, `data-testid="mobile-focus-idle"` / `"mobile-focus-running"`). Timer state lives in `useDeepWorkTimer` in DayPlanner, so it survives tab switches.
- Habits `:755` mounted only when `mobileTab === 'habits'` (`MobileHabitsPanel`, `data-testid="mobile-habits"`); identity `input text-[15px]` (:99-107, iOS zoom); check button `h-6 w-6` :144; dots `h-1.5 flex-1`.
- Review/Challenge: `ReviewPage.tsx:267` `<MobileTabBar activeTab={null} reviewActive …/>`; `ChallengePage.tsx:65` same without `reviewActive` (rendered :83 and :125, not in the :73 signed-out branch). `CalendarSyncPage.tsx:124` and `CalendarCallbackPage.tsx:71` render NO tab bar (phones have no nav on /calendar; conflicts with the gate at mobile-responsive :113, to verify). `ChallengeJoinPage.tsx:161` none. PrivacyPage `hideSidebar`.
- `?tab=` handoff: Review's items navigate to `/?tab=<id>`; Review's own item is `<Link to="/review">`.

## 9. Existing tests
- `npm run test:e2e` = `playwright test --reporter=line` (chromium Desktop Chrome, baseURL 5173, `webServer: npx vite`, reuseExistingServer). Single spec: `npx playwright test e2e/mobile-responsive.spec.ts --reporter=line` (`-g "<title>"`). `npm test` (vitest). `PW_SLOWMO` slows actions.
- `e2e/mobile-responsive.spec.ts` (390x844, isMobile, hasTouch; `injectGuestState` seeds an EMPTY day): 1. `${route} fits the mobile viewport` for `/`, `/review`, `/calendar` (:90): no "Something went wrong", `scrollWidth <= 391` (:103-107), no JS errors. 2. every app route offers a fixed bottom tab bar (:113), `width <= 391` (:133). 3. planner content clears the bar when scrolled to the end (:137, :185-189). 4. bar does not overlap the sidebar at 800px (:192). 5. device matrix 280x653, 320x568, 360x740, 844x390 × `/`, `/review` (:240): `scrollWidth <= width+1`. 6. `${route} controls are thumb-sized` for `/`, `/review` (:311): `undersizedTouchTargets` (~:270-308) over `button, a, [role=button], input[type=checkbox], select` <44, ignoring `overflow-x` scrollers and inline-in-prose siblings; expects `[]`. 7. viewport meta has `viewport-fit=cover` and a stylesheet rule with `safe-area-inset` (:325). 8. landscape 844x390: summed height of fixed nav/div/header/footer pinned to an edge `< 0.3 * innerHeight` (:352, :373-376). Gaps: empty days (no rows, Top 3, sheets, toasts, Focus/Habits); never opens a menu or sheet.
- `e2e/mobile-redesign.spec.ts` EXISTS (250 lines, 390x844, seed with 4 tasks, session, habits; describe 'mobile destinations' :127-248): 1. bar offers four destinations, Review href `/review` (:128); 2. no tab renders the monthly dashboard (:140); 3. Today height `< 2200` (:153-157); 4. Today shows one "Tasks" list, seeded titles, `Schedule in calendar` count > 0 (:160); 5. Focus idle → running (`mobile-focus-running`, "Working on", "of a 45 minute block", Pause) (:169); 6. finishing early keeps minutes (:189); 7. Habits shows identity, "Last 7 days", "missed yesterday" (:214); 8. habit toggles persist (:228); 9. Review "This week", goal input, no "Monthly tracking" (:237); 10. `/?tab=habits` → `mobile-habits` visible (:244). Header comment still says Today opens with a NOW card (stale). Helpers `openPlanner` (~:110), `tab(page, name)` scoped to `mobile-tab-bar`.
- `e2e/minimal-today.spec.ts:22` `seedAndOpen(page, path='/')`: sets guest session; seeds `version:1` state with one day (local ISO) holding `{id:'t1', title:'Write the report', sectionId:'highPriority', isDone:false}` and `activeDays:[iso]`; goto; clicks "Continue as guest" if shown. Helpers `todayIso()` :15, `readTask()` :~48. No mobile viewport itself.
- Other specs: calendar-sync, calendar-timezone, completion-claim-blocks, copy-from-day, crawl, dnd-sleep-sidebar, session-attribution, work-safety.

## 10. Other phone hazards
- iOS input zoom (<16px): only `AddTaskInput.tsx:33` is guarded (`text-base sm:text-sm`). Everything else is `text-sm`/`text-xs`: TaskItem title edit (~:335), MustDoPinnedHeader title edit (~:190, ~:345) and add (~:420), DeepWorkTimer label (:129) and task select (:96), MobileHabitsPanel identity (:107 `text-[15px]`), TaskProgressSheet time inputs (:289, :297), ScheduleSheet time (:144), TaskDurationPicker select, SessionAttributionPanel select (:80), HabitChecklist :94, HabitEditorModal :118, :137, :150, LoginForm :79, :95, Challenge forms (ChallengeCreateForm, ChallengeJoinPanel, CheckinSheet textarea, ChallengeJoinPage), CalendarSyncPage select :248, ReviewPage goal input :172. No `maximum-scale`, so users can zoom back out.
- `100vh`: `index.css:16` fallback before `100dvh` (OK). `min-h-screen` at `ErrorBoundary.tsx:56`, `RestorePage.tsx:60`; `min-h-[50vh]` at `DayPlanner.tsx:611`, `PlannerPage.tsx:53`, `ChallengePage.tsx:70`, `ReviewPage.tsx:127`; `max-h-[60vh]` at `HabitEditorModal.tsx:92`. All `vh` (CLAUDE.md says dvh).
- Scroll container at md+: `AppChrome.tsx:40` `md:h-dvh md:overflow-hidden` and :48, with `<main md:overflow-y-auto>` (~:56). From 768px the scroll container is `main`; a landscape phone (844x390) is ≥md: URL bar does not collapse, document-level `scrollWidth` checks miss overflow inside `main`, sidebar takes 240px leaving ~600px.
- `prefers-reduced-motion`: no handling anywhere. Animations: `animate-pulse` (CalendarTimeline :95-96), `animate-spin` (DayPlanner :613), `transition-[width] duration-1000` (TaskProgressBoxes), `backdrop-blur-sm` (tab bar).
- `sm:` branches: phones <640 are on the compact branch (intended). TaskProgressBoxes chips shrink at sm (`--chip-h:1.125rem --chip-w:1.5rem` :66); `-my-3 py-3 sm:-my-2 sm:py-2` (~:203, ~:296) shrinks the start hit area at sm.
- `.inset-x-safe` defined but unused by the fixed bars. CLAUDE.md claims `AppMobileNav` sets inline insets; no such component exists (only `MobileTabBar`, with none).

## Conflicts / gaps
- CLAUDE.md "AppMobileNav" vs `MobileTabBar.tsx:83` (no insets, no such component).
- "~" line numbers from partial reads.
- Not verified at runtime: tab bar covering TaskProgressSheet / HabitEditorModal / move-subtask modal; `?tab=` on an already-mounted planner; PlannerPage `trailing` header; tab bar height vs the 64px spacer.
- Not read in full: DeepWorkTimer.tsx, FocusMode.tsx, HabitEditorModal.tsx, AppSidebar.tsx, AccountMenu.tsx, ReviewPage layout beyond grep, docs/design/README.md.

Key files: `src/components/planner/TaskItem.tsx`, `MustDoPinnedHeader.tsx`, `MobileTabBar.tsx`, `DayPlanner.tsx`, `TaskProgressSheet.tsx`, `TaskProgressBoxes.tsx`, `src/components/layout/AppChrome.tsx`, `src/index.css`, `tailwind.config.js`, `e2e/mobile-responsive.spec.ts`, `e2e/mobile-redesign.spec.ts`, `e2e/minimal-today.spec.ts`, `playwright.config.ts`.
