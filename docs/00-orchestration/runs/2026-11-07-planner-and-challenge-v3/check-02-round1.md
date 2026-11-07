# Check 02, round 1 (scout, Sonnet) — filed by the supervisor

Ran from the worktree: `npx tsc -b` clean; `npm run lint` clean; `npx vitest run durations taskUtils dayCompletion` 3 files / 46 passed; no import of `TaskDurationPicker` remains. Playwright, `vite build`, full `npm test` not re-run.

## Findings
1. Low — `DurationChip.tsx:189-195`: Escape closes the popover only while focus is inside the panel; with the popover open and focus on the chip, Escape does nothing. **Supervisor:** FIX.
2. Low — `DurationChip.tsx:200-201`: the popover stops click/dblclick/mousedown/pointerdown/contextmenu/keydown from reaching the row, not `touchstart`/`dragstart`; harmless today (portalled to `<body>`, desktop only). **Supervisor:** accepted.
3. Low — no e2e for outside click with valid text (saved), invalid text (dropped), Tab away, or the Top 3 add line taking a length; by code reading the behaviour is right (`typed()` null for invalid, `:132`; `onDismiss` saves only `minutes !== null && minutes !== value`, `:70`). **Supervisor:** FIX — add the four cases.
4. Info — `e2e/day-completion.spec.ts` edited outside the listed deliverables (disclosed). Accepted.
5. Info — `playwright.scratch02.config.ts` untracked; delete before merging. Supervisor excludes it from the patch.

## Criteria
1 met (`durations.test.ts:6-8`, `:20`, all 15 values and 5 rejects); 2 met (`:31`, `:43`, `:44`, `:32`); 3 covered (`duration-chip.spec.ts:97`, 1280x900, 5 chips visible reading "Time"); 4 covered (`:110` Enter → 90 stored, chip text, gauge changed; `:134` off-ladder 100 in order and `aria-pressed`); 5 covered (`:110` focus on field, `#root` not inert, chip focused after Enter; `:162` Escape no change; "traps nothing" by code `:126-141`); 6 covered (`:212`); 7 partly (tsc/lint clean, rest not re-run); 8 cannot tell; 9 met (`useTouchReorder.ts`, `taskUtils.ts` diffs empty; every hunk in the two shared files is a duration hunk; `draggable={isReorderable}` `TaskItem.tsx:538` and `onDragStart` `:542` unchanged).

## DurationChip as the user
Open: portalled z-75, anchored, flips above when needed, clamped; field focused with text selected (`:123-124`). Enter: valid → `onChoose`, saves if different, closes, focus to chip; empty + Enter → `onChoose(undefined)` (implicit Clear, not in the spec; accepted); invalid → `ErrorLine`, `aria-invalid`, `aria-describedby`, nothing saved. Escape: `onDismiss(null, true)` when focus is inside (finding 1). Outside click: capture-phase `pointerdown`, valid text saved, invalid dropped silently, unchanged value not rewritten, no focus return. Pill: saves, closes, focus returns. Clear only when set. Tab away: `focusin` outside dismisses and saves a valid draft. `#root` never inert. Done rows keep an editable duration chip (`TaskItem.tsx:637` under `canEditTime`); accepted. ARIA: chip `aria-haspopup="dialog"`, `aria-expanded`, `aria-label="How long: …"`, `title`; panel `role="dialog" aria-label="How long"`; input `aria-label="Type how long"`; pills `role="group" aria-label="Pick a length"`, each `aria-pressed`.

## ScheduleSheet
Shared parser and constants (`:22`); typing a valid length selects the pill; "Save length" enabled when empty, error on submit; Enter submits; the time and next-free-slot paths untouched by the diff.

## Add line
"Call 911", "Standup 10:30", "2h" → plain titles; "Write report 2h" 120, "Plan 1:30" 90, "Deep work 2h 30m" 150 (traced); Top 3 `handleAdd` uses the same function (`:279-281`), untested by e2e (finding 3).

## Copy and tokens
"Time", "Set", "Clear", "Pick a length", "Type how long", "How long", "How long this will take", "Save length", placeholder "2h 30m, 45m or 1:30", error "Try 2h 30m, 45m or 1:30": sentence case, matching §C. No hex, `text-[` or raw colour classes; `z-[75]`, `touch:min-h-[44px]` are not colours.

## Report vs code
Line ranges, inert, focus return, one-digit-hour rule, the "2h 30m" pair, the deletion: all supported. Not mentioned in the report: empty + Enter clears. Test counts (378/35/65) unverified by the scout.
