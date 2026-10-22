# Scout: mobile artboards vs the app today (Mode A)

*Filed by the supervisor from the scout's final message, 2026-10-22. Nothing edited by the scout.*
*Artboard measurements verified from the .dc.html inline styles. Only mobile-Main.png was opened; it matches Main.dc.html.*

## 0. Global artboard language (docs/design/mobile/*.dc.html)

- **Frame and gutters:** 390x844, 20px side gutters. Ground #111316, text #e2e2e6.
- **Surfaces:** cards and rows #1a1c1f; borders #3d494d; hairlines and tracks #23262a; tab bar ground #131518 with a #23262a top border.
- **Type roles:** page title Epilogue 800 21px (Main:21, Habits:21, Review:20). Card title Epilogue 700, 19px on the NOW card, 15–18px elsewhere. Big number Epilogue 800 38px (Review:38). Timer digits Epilogue 800 62px (Focus:40). Body Manrope 14px at 500–600. Meta 12px #bcc9ce. Tertiary 11px #7d8a8f. Overline 10px/800/0.09em uppercase. Tab labels 10px, 700 active, 600 inactive.
- **Radii:** hero card 18px, list rows 13–14px, primary button 12px, checkbox 6–8px, chips 7px.
- **Accent rule:** cyan #00daf3 marks act-now only (NOW overline, progress fill, Start, active tab, done habit check and done dots; "Due Friday" in Review:82). Amber #ffb77d marks warnings only (missed-yesterday habit border/label, broken-chain dot, Habits:58-66; also the streak flame, Main:23). No emerald, sky, violet or red anywhere.
- **Tap-through pattern:** a row is a title plus one short meta value plus a chevron (#3d494d stroke), detail behind a tap. Rows separated by a #23262a hairline or an 8px gap. Nothing is inline-editable.
- **Touch sizes:** primary CTA 48px high (Main:55); OneThing CTA 56px, secondary 48px. Overflow button 48x48. Focus circles 56px, primary 82px. Avatar 36px. Tab items ≈52px with 22px bottom pad. Habit check box 24px in a 12px/14px-padded row (below 44px unless the row is the target).

## 1. TODAY

**Artboard (Main.dc.html):** header (18/20px pad): date Epilogue 800 21px; 12px meta line with a 13px amber flame, "12 day streak", "3 of 7 done"; 36px avatar right. A 2px day-progress line (#23262a track, cyan fill, Main:32). NOW card (margin 20, padding 18, radius 18, 1px #3d494d border, Main:36-63): overline "NOW · HIGH PRIORITY" with 6px cyan dot and time range; title 19px; segmented 8px progress bars per 30-min block; "1h 30m done of 2h 15m planned" 12px; 48px CTA "Start 45m block" plus a 48px kebab. THEN: overline, next two tasks as 14px-padded card rows (20px checkbox, 14px/500 title, right-aligned 11px duration chip on #23262a). REST OF DAY: one line per section (46px tabular time, name, count, chevron). Fixed 4-item tab bar.

Only NOW is expanded; THEN is two cards; everything else one line. Task row = checkbox, title, duration chip. Not on the row: schedule chip, grip, move arrows, progress boxes, delete, menu. Start belongs to the NOW card only.

NOW/THEN after the rewrite: NOW was "the current time-block section"; blocks are gone. A fit is `CalendarTimeline`'s Now event plus the first undone Top 3 or Tasks item as the NOW card (inference). REST OF DAY times came from section blocks and the sleep window, both deleted: obsolete as designed.

**App now (DayPlanner.tsx:620-724, `space-y-3`):** AwayBlockClaim (:626), DayHeader (:640), ChallengeCard when `isToday && challengeActive` (:654), CalendarTimeline (:661), "Reconnect Google" note (:664), MustDoPinnedHeader (:690), copy-from-day button (:709), one "Tasks" SectionColumn (:721) then legacy sections if they hold tasks (:722).

**Deltas:**
- No hero: no NOW card, THEN or REST OF DAY, no page-level Start CTA. Start is a per-row progress-box action (TaskItem.tsx:399-406).
- DayHeader (DayHeader.tsx:51-104): title `text-xl font-semibold` in the default font, not Epilogue 800 21px (`font-shareHeadline` unused, :53). Meta `text-xs` matches. Flame `text-amber-400` (:57). A bordered 3-button "‹ Today ›" capsule (:86-103) where the artboard has an avatar; no 2px progress line; the artboard has no day navigation.
- Cards: CalendarTimeline `rounded-2xl` on `surfaceContainer` (CalendarTimeline.tsx:77); SectionColumn `rounded-2xl surfaceContainerLow p-3 sm:p-4` (SectionColumn.tsx:182); MustDoPinnedHeader `rounded-lg surfaceContainerLow/95 px-3 py-2` (MustDoPinnedHeader.tsx:242). Three radii and two backgrounds on one screen.
- Overlines: app uses `text-xs font-semibold uppercase tracking-wide` (12/600/0.025em: CalendarTimeline:79, ReviewPage:167, ChallengeDashboard:23). Artboard 10/800/0.09em. MobileFocusPanel:85 matches exactly; Top 3 header is 10/600/`tracking-wider` (MustDoPinnedHeader:250).
- Task row (TaskItem.tsx:272): `flex flex-wrap gap-2 py-1.5`, no row background; can carry kebab (:290), up/down arrows (:300-317, `sm:hidden`), desktop grip (:278), 20px native checkbox (:327), `text-sm` title, shallow/private badges, ScheduleChip, duration picker (`hidden sm:block` when scheduling, :395) and TaskProgressBoxes, which wrap onto a second line.
- Top 3 (MustDoPinnedHeader): title "Your Top Three Priorities for today", three `h-1.5 w-5` pips and a percent (:250-269); pips `bg-emerald-500` done / `bg-sky-500` undone (:262-263), sky focus rings (:301, :351, :432); all-done state emerald (:164-173); rows `flex-wrap` with the TaskItem control set plus the Eye toggle (:377).
- AddTaskInput (AddTaskInput.tsx:27-34): always-visible, `rounded-md px-3 py-1.5` (~34px tall), no `touch-target`.
- Collapsing: SectionColumn chevron collapse persisted (SectionColumn:101); header shows title, summary ("2 tasks · ~1h left", :108-124) and an amber "N open" badge past 7 (:194). No chevron-right row-link, no time column.

**Still applies:** single-accent rule; one hero task (derivable); 48px primary CTA; 12/14/19px scale; row = checkbox + title + duration chip with detail behind a tap; hairline lists; THEN limited to two.
**Obsolete:** REST OF DAY times and Sleep line; "NOW · HIGH PRIORITY" as a time block; six-section collapse; "Top 3 folded into NOW/THEN".
**Alternates:** TimelineDay.dc.html (40px time gutter, 1px #23262a rail, 9px nodes, 11px tabular times in #7d8a8f, now-node with 4px 15%-cyan halo, NOW card with 1px cyan border; rows 13px/600 title, 11px #7d8a8f subtitle, 18px gap) is the nearest cousin of CalendarTimeline (min-h 36px rows, `text-sm`) and could be rebuilt on calendar events. OneThing.dc.html (single task Epilogue 800 32px, 10px segmented bar, 56px CTA, 48px Done/Next, swipe hint) has no counterpart and needs a gesture that does not exist.

## 2. FOCUS

**Artboard (Focus.dc.html):** header with 40px back chevron and 12px/600 "Block 3 of 5 today"; spacer; "WORKING ON" overline + task title Epilogue 700 18px; 260px ring (r=120, stroke 4, cyan over #23262a); Epilogue 800 62px `-0.03em` tabular digits + "of a 45 minute block" 12px/600; controls 44px below: 56px reset, 82px pause, 56px minus; spacer; "Finishing this fills one box on the task" 12px #7d8a8f; 34px bottom pad.

**App now (MobileFocusPanel.tsx):** running/paused state matches almost line for line (ring :93-113, :37; digits :115; controls :125-164; footer :207). Differences: no back chevron; caption "Block {n} today" (:81) with no "of N" (no data for it); right button is a checkmark `stopAndBank` (:155-164), left resets with a confirm sheet (:169-205), both for data safety; ring track hard-coded #23262a (:101) and stroke #00daf3 (:107); layout top-aligned (`mt-3 … mt-10`) rather than flex-grow centred, so content sits high on tall phones.
Idle state is not an artboard: it renders the full `DeepWorkTimer` card (:65-71) inside `lg:hidden`: `rounded-lg`, `text-sm sm:text-base font-semibold` heading (DeepWorkTimer.tsx:84), `font-mono text-2xl sm:text-3xl` digits (:206), sky-500 selected chip, Start `border-sky-500 bg-sky-500 text-slate-950` (:224), custom input focus ring (:176), teal-400 "your block" dot (:158, :340), teal block-complete (:193-201). Start is `min-h-[44px]` 14px text, not 48px/15px 800.

## 3. HABITS

**Artboard (Habits.dc.html):** header Epilogue 800 21px "Habits" + "4 of 9 today" 12px; identity card (margin 18/20, padding 15/16, radius 14, #1a1c1f, 2px cyan left border, Habits:25) with overline "I AM" + Epilogue 700 15px; habit rows (gap 8, radius 13, padding 12/14): 24px rounded-8px check (cyan when done, 14px check stroke 3.2), 14px/600 name, seven 7px dots at 4px gap (cyan done, #23262a missed, amber broken chain), 12px/700 tabular streak; at-risk row 1px amber border + amber 10px/700 "missed yesterday"; footer "Last 7 days. The full month grid lives in Review." 11px #7d8a8f. No Edit button, no stack anchor.

**App now (MobileHabitsPanel.tsx):** very close: title (:78), count (:79-81), identity card `border-l-2 border-share-primary` (:94), overline (:95), rows `rounded-xl p-3 gap-3` with 24px checkbox (:135-155), at-risk border/label (:136, :161), dots `h-1.5 flex-1 rounded-full` (:170), `tabular-nums` streak (:176), footer (:184).
Deltas: an Edit button (44px `touch-target`, :83-89) not in the artboard; dots are flex-1 bars (~40px wide at 390px, arithmetic) not 7px circles; missed dot `bg-share-outlineVariant/40` (:45) since #23262a is not a token; the 24px check button is `h-6 w-6` with no larger hit area (:144); mounted only for the habits tab (DayPlanner.tsx:755). HabitChecklist.tsx (desktop rail): `rounded-lg`, `text-sm font-semibold` heading, 16px check (:137), `text-orange-400` streak with Flame (:170), amber AlertTriangle (:163), no dots row, renders `stackAnchor` "After: …" (:156).

## 4. REVIEW

**Artboard (Review.dc.html):** header Epilogue 800 21px "Review" + month stepper capsule (12px/700, 32px chevrons); DEEP WORK THIS WEEK card (radius 18, padding 18): overline + "goal 20h" 11px #7d8a8f, 38px number + "hours" 14px/600, 7-column 64px bar chart (cyan done, #23262a empty), M–S labels 10px #7d8a8f; BLOCK COMPLETION card; three hairline link rows (padding 15/2, 18px icon, 14px/600 title, 11px subtitle, chevron) + "Goals & North Star".

**App now (ReviewPage.tsx):** week stepper (:138-162) `font-shareHeadline text-lg font-black` (18/900 not 21/800), 44px chevrons; deep work card (:165-229) `surfaceContainer rounded-2xl p-4`, overline `text-xs font-semibold uppercase tracking-wide`, goal number input (:172-182), big number `text-3xl font-black` (30/900 not 38/800, :185), new `h-2` goal bar (:189-197), 7-bar chart `h-28` (112px vs 64px) with `bg-share-primary/80` (:200-222), hand-logged line (:224-228); habits card (:232-263) with 12px `h-3 w-3` dots and `bg-[#ffb77d]` hard-code (:252); ChallengeReviewSection (:265). Block completion, month grid, journal, reviews, goals, North Star are gone by decision (ReviewPage.tsx:7-12).

## 5. CHALLENGE (no artboard)

**App now:** ChallengeCard.tsx:79 `rounded-xl border border-share-primary/30 bg-share-primary/5 p-3` (a tinted-cyan surface the artboards never use); 12px/600 title with Flag (:81-93), "Open" link (:95); buttons `text-xs font-semibold touch-target-coarse` (:26-29); emerald-300 on emerald-500/15 pills for "✓ Plan locked" (:104) and "✓ Checked in" (:119), emerald ticks for the partner (:142-143); partner line + Nudge (:137-158); red-400 error (:161), emerald-300 notice (:166). ChallengeDashboard (:22-23) `rounded-2xl border outlineVariant/25 surfaceContainer p-4`, overline as ReviewPage; countdown `text-4xl font-black` (36/900, :77); `h-1.5` cyan bar (:92); cyan ◆ goals, amber ✕ don'ts (:130, :143). MemberDayCard `rounded-xl text-sm` with emoji ✅/⬜ (MemberDayCard.tsx:47, :67). ChallengePage header `text-lg font-black` + 12px subtitle (:94-95). Challenge and Review share `mx-auto max-w-xl px-4 py-5 pb-28`.

**Artboard language implies (scout's reading):** cards #1a1c1f, radius 14–18, 18px padding, no border, or a 2px cyan left border for a quoted item; the cyan-tinted card fill has no precedent and uses cyan for a standing state. Type: page title Epilogue 800 21px; overlines 10/800/0.09em ("TODAY", "PARTNER", "THE SEASON SO FAR"); countdown 38/800 with 14px/600 unit; list 14/600; meta 11–12px. One accent: cyan on the single act-now button (as `primary` is picked, ChallengeCard:130); done = cyan fill with dark check rather than emerald pills (README line 194 tolerates emerald "completed"); amber only for a warning (broken don't, partner overdue); red absent from artboards. Row pattern: 2px day line or 8px segmented bar, 12/600 caption, 48px CTA, hairline list with chevron for dashboard sub-sections. On Today, the full ChallengeCard adds a fifth stacked card ahead of Top 3; the artboard-like shape is a single row/chip in the header that opens a sheet (DayHeader already carries "Day 22/92 · 70 left", DayHeader.tsx:77-82).

## 6. Chrome and tab bar

**Artboard:** 4-column grid, #131518 ground, 1px #23262a top border, padding 8/8/22/8, 21px icons, 5px gap, 10px labels; active cyan 700, inactive #7d8a8f 600.
**App (MobileTabBar.tsx):** same SVG paths (:40-70, :114-116), 21px; `gap-1` (4px); labels `text-[10px]`, `font-bold`/`font-medium` (:96-97, artboard 700/600); inactive `text-share-onSurfaceVariant/60` not #7d8a8f (:97); bar `border-share-outlineVariant/30 bg-share-bg/95 backdrop-blur-sm` (:83) not #131518/#23262a; `touch-target` per item (:73), `pb-safe-nav` (:83); hidden at `lg`, offset 240px at `md`; mounted on planner (DayPlanner.tsx:948), Review (:267), Challenge (:65, `activeTab={null}`, nothing lit on /challenge).
**AppChrome.tsx:55-60:** mobile-only `px-4 py-2.5` header with "Deepblock" wordmark and the account menu, bottom border, ≈44px before the date header. Artboards have no app-name bar; the avatar is the account affordance.

## 7. Tokens and utilities the artboards use that the app lacks

- **#23262a** (hairline, track, chip fill, missed dot): not in tailwind.config.js (colors, lines 17-35); used raw in MobileFocusPanel.tsx:101. Nearest: `surfaceContainer` #1e2023, `surfaceContainerHigh` #282a2d.
- **#7d8a8f** (tertiary text): not a token; approximated with `text-share-onSurfaceVariant/60` and `/70`.
- **#131518** (tab bar ground): not a token; app uses `bg-share-bg/95`.
- `share.tertiary` #ffb77d exists but ReviewPage.tsx:252 hard-codes `bg-[#ffb77d]`; DayHeader.tsx:57, SectionColumn.tsx:196 and others still use `amber-400/500`.
- Type utilities: the 10/800/0.09em overline exists inline (MobileFocusPanel.tsx:85, MobileHabitsPanel.tsx:95) but not shared; no 38px stat, 62px timer or 21px page-title utility; no `rounded-[18px]`.
- Not used but in artboards: 48px CTA (`h-12`; app `min-h-[44px]`, DeepWorkTimer:224), 2px header progress line, segmented 8px block bar, `border-l-2` cyan quote card (Habits only), hairline row lists with chevron.
- Present and matching: `share.*` colours, `font-shareHeadline`, `font-shareSans`, `touch-target`, `touch-target-coarse`, `pb-safe-nav`, `short:` and `touch:` screens.
- Off-palette Tailwind colours remaining (sky, violet, emerald, teal, orange) in: ChallengeCard, ChallengeDashboard, ChallengeReviewSection, CheckinSheet, HistoryGrid, MemberDayCard, ErrorBoundary, HabitChecklist, HabitEditorModal, AccountMenu, AwayBlockClaim, DayPlanner, MustDoPinnedHeader, TaskItem, TaskProgressBoxes, TaskProgressSheet, DeepWorkTimer, CalendarSyncPage, RestorePage (contents checked only for files quoted above; the rest to verify).

## Verified / to verify
- Verified: every artboard measurement above, every app file:line cited, the token list.
- To verify: rendered heights / scroll length of Today (README's 1,786px is stale); whether rows wrap at 390px; Habits dot sizes; that `e2e/mobile-redesign.spec.ts` still passes; off-palette usage in unopened files; PNG previews other than Main.

## Conflicts
- README Status says mobile Main is "done" via the NOW card and Review via `MobileReviewPanel`; neither is on the render path (DayPlanner renders no NowCard; ReviewPage mounts no MobileReviewPanel). README lines 164, 169-170 stale.
- README says the tab bar links to `/planner/review`; actual `/review` (MobileTabBar.tsx:106).
- README rule 3 "SectionColumn defaults to collapsed unless its block is running"; code has `defaultCollapsed = false` (SectionColumn.tsx:69).
- README line 194: emerald only for "completed"; it is also on Top 3 pips (MustDoPinnedHeader:262) beside sky-500 (:263); teal on the timer.
- Artboard Main has a 4-tab bar with Review; "Challenge" is absent from the bar (sidebar and account menu only).
- Artboard Focus "Block 3 of 5 today"; app "Block {n} today" (MobileFocusPanel.tsx:81), no data for "of N".

## Gaps
- No artboard for Challenge, calendar timeline, schedule sheet, progress sheet, idle timer form, Top 3 card, add-task input, empty state, away-block claim, doneOffer/completionClaim toasts, CalendarSyncPage, signed-out state.
- Task-level actions behind a tap are unspecified beyond the NOW-card kebab (schedule, shallow, subtask, abandon, delete, move).
- No spec for many tasks or legacy sections.
- Not reviewed: AwayBlockClaim, TaskProgressBoxes, ScheduleChip, the sheets; app and tests not run.

## Scout's suggested order (judgement, not a requirement)
1. Add tokens #23262a, #7d8a8f, #131518; replace raw hex at MobileFocusPanel:101 and ReviewPage:252.
2. Tab bar and chrome: inactive text/ground tokens, 5px gap, 700/600 weights, wordmark bar vs avatar.
3. Type roles: one overline utility, 21px/800 page titles on Today, Review, Challenge.
4. One-accent clean-up: remove sky, teal, violet; decide emerald "done" and amber for non-warnings.
5. Today hero (NOW/THEN from the calendar's current event or the first undone task) with the task row slimmed to checkbox, title, duration chip. Biggest change; needs a mapping decision.
