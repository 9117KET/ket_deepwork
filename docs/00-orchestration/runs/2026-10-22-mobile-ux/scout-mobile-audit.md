# Scout: live mobile audit (Mode A)

*Filed by the supervisor from the scout's final message, 2026-10-22. Playwright against a dev server on :5180 (killed afterwards), guest-seeded day, dark theme. Script `audit.js`, raw data `results.json` and all screenshots under the session scratchpad folder `mobile-audit/` (outside the repo). No page errors on either viewport.*

**Caveats (scout's own):** Today's content height was not measured reliably (the scout believed the body scrolls in an inner container; the Today PNG is clipped at the viewport). The "Add a task" and Top 3 "+ Add" clicks timed out (selectors did not match), so the add field and keyboard-space behaviour were not observed. The ⋮ menu (aria-label "Task options", TaskItem.tsx:295) was not opened. The "progress" shot tapped an individual progress box and revealed a "15:00 ×" control; the progress sheet itself was not observed.

## Measurements (identical at 360x740 and 390x844 except page heights)
| route | scrollH 360 / 390 | h-overflow | sub-44 controls | <12px text nodes | fixed chrome |
|---|---|---|---|---|---|
| `/` | 904 / 904 | no | 40 | 17 | 65 (tab bar) |
| `/?tab=focus` | 740 / 844 | no | 9 | 9 | 65 |
| `/?tab=habits` | 1053 / 1053 | no | 12 | 6 | 65 |
| `/review` | 917 / 917 | no | 2 | 12 | 65 |
| `/challenge` | 740 / 844 | no | 5 | 4 | 65 |
| `/challenge/join?invite=x` | 740 / 844 | no | 1 | 0 | 0 |
| `/calendar` | 740 / 844 | no | 1 | 0 | 0 |
| `/privacy` | 4559 / 4307 | no | 8 | 0 | 0 |

Today extras (verified): first Top 3 row at y=200px, first list task row at y=365px, tab bar 65px (9% of 740, 8% of 844). With the Schedule sheet open the tab bar stays visible under it (top=675). No `opacity:0`/transparent hidden controls detected by the script (the Top 3 Remove buttons report opacity 1 because they use `text-transparent`). No horizontal overflow anywhere.

## Prioritised problems (scout's order)
1. **Today: 16x16 controls everywhere.** Reorder arrows ("Move … up/down"), Top 3 checkboxes, "Collapse section" are 16x16; 40 sub-44 controls on Today, 46 with the sheet open. Files: MustDoPinnedHeader.tsx:319, :326; TaskItem.tsx:295, :307, :314; SectionColumn.tsx:188. Shot: 360-today.png.
2. **Today: rows carry arrows + ⋮ + checkbox + schedule chip, so the title column is narrow.** 80-char titles wrap to 4 lines (~110px per row); Top 3 titles truncate ("Ship the quarterly pl…"). Arrows sit on every row with no mouse need. Files: TaskItem.tsx:284-314, MustDoPinnedHeader.tsx:319. Shots: 360-today.png, 360-i-progress.png.
3. **Today: progress row split from the title** (own line under Top 3 item 1): two 30-min boxes plus a dotted "1h15/1h30" caption in tiny text. Tapping a box selected it and showed an unexplained "15:00 ×" control instead of opening a sheet. Files: TaskProgressBoxes.tsx, TaskProgressSheet.tsx. (Conflicts with CLAUDE.md "on phones the row is one button opening TaskProgressSheet".)
4. **Today: subtask row shows a bare native "Duration" select** under "Pack the bag"; "Buy groceries" shows an unlabeled empty box plus "0m/45m". Files: TaskDurationPicker.tsx, TaskItem.tsx:392.
5. **Text under 12px:** 17 nodes on Today (10px: Top 3 heading, percent, slot numbers, "1h15/1h30", "0m/45m", tab labels; 11px: "14:00", "Schedule" chip). Tab labels 10px (MobileTabBar.tsx:73). Review week letters and "0.8h" 10–11px; Focus "Your block: 45m on · 10m off" 11px; Habits "I am" 10px. 21 uses of `text-[10px]` across src.
6. **Habits:** ten rows of 24x24 toggles (12 sub-44 total); the tap target is a small box inside a tall row (MobileHabitsPanel.tsx, HabitChecklist.tsx:142). ~1050px tall. Footer "The full month grid lives in Review" (MobileHabitsPanel.tsx:185) contradicts CLAUDE.md (grid removed). Seeded `habitCompletions {gym:true}` showed Gym unchecked (seed key probably not the habit id; to verify).
7. **Focus idle:** preset chips 36px tall, sound toggle 24x24, "?? min" custom field greyed and unclear, account menu 75x38; ~700px empty below the card at 360x740; Start left-aligned, not full width. Shot: 360-focus.png.
8. **Fixed tab bar** overlays Today's content with no visible bottom clearance in the shot; stays visible beneath the Schedule sheet (sheet covers only down to the bar top; "Clear time"/"Cancel" visible just above it at 360).
9. **Schedule sheet** otherwise sound: 44px+ chips, clear copy. Opens with the guest message while the account chip shows "U".
10. **/challenge for a guest:** sign-in form with 38px fields and a 16px-high "Sign up" link (278x16). /challenge/join and /calendar are bare one-link screens (106x20, 115x36 targets). /privacy: all links 20–22px high, 4,300–4,600px of text.

Observed OK: no horizontal overflow, header and date nav usable, Top 3 pips readable.

## Screenshots (scratchpad `mobile-audit/`, 360- and 390- variants)
`-today`, `-focus`, `-habits`, `-review`, `-challenge`, `-challenge-join`, `-calendar`, `-privacy`, `-i-menu` (menu never opened), `-i-schedule`, `-i-progress`, `-i-top3add` (plain Today), `-i-addtask` (plain Today), each also as `-full.png` for the interaction shots. The scout viewed only 360-today, 360-i-schedule, 360-i-progress, 360-focus, 360-habits; review/challenge/privacy/calendar findings are from measurements.

## Verified / to verify / conflicts
- Verified: all numbers above (`results.json`).
- To verify: real Today scroll length; menu, Top 3 add, add-task keyboard behaviour, progress sheet; habit seed mismatch; 390 shots visually.
- Conflicts: CLAUDE.md says the phone progress row is one button opening TaskProgressSheet; observed individual box buttons with an inline time control. CLAUDE.md says the monthly habit grid was removed; MobileHabitsPanel.tsx:185 says it lives in Review.
