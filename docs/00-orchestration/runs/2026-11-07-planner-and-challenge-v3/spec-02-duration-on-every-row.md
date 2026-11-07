# Spec 02: A duration on every row, typed or picked

*Run:* `docs/00-orchestration/runs/2026-11-07-planner-and-challenge-v3/` · *Builder:* builder (Opus) · *Worktree:* yes ·
*Time box:* 90 minutes of agent work

## Goal

The user wants to put hours on a task "as in the first version" and chose: a field visible on every row that accepts typed hours and minutes. Today the ladder `<select>` is invisible on desktop until the row is hovered and lives inside the schedule sheet on a phone. When this is done every root row (Top 3 and Tasks, desktop) shows a quiet duration chip without hover — "Time" when unset, the length when set — and tapping it opens a small popover with a text field that understands "2h", "2h 30m", "1.5h", "90m", "1:30" and "45", with the existing ladder under it as one-tap pills. On a phone the schedule sheet gets the same typed field above its ladder. Typing "Write report 2h" in the add line creates the task with 2h set.

## Inputs (read all of these first)

- `02_COMMON.md` (setup, contract §C: shared-file rule with spec 01, the fixed words).
- `scout-planner.md` §2: the current picker, its hiding rule, the phone chip, the first version (a select, never free typing).
- `CLAUDE.md` › "Deep Work framework" item 7 ("One ladder, one gauge") and item 6.
- `src/domain/durations.ts`, `src/domain/taskProgress.ts` (`formatMinutes`, `parseClockRangeMinutes` for style), `src/components/planner/TaskDurationPicker.tsx`, `TaskItem.tsx` (`:373-380` phone chip, `:631` desktop picker), `MustDoPinnedHeader.tsx` (`:639`), `ScheduleSheet.tsx` (`:71-72`, `:118`), `AddTaskInput.tsx`, `src/components/ui/Sheet.tsx` (focus and dismiss conventions to mirror in the popover).
- Design: `~/.claude/skills/apple-design/SKILL.md` (popovers, text fields, 44 px), `~/.claude/skills/frontend-design/SKILL.md` (a chip must not compete with the title), `~/.claude/skills/web-design-guidelines/SKILL.md` (run over the changed files).

## Deliverables (exact paths)

- `src/domain/durations.ts`: `parseDurationInput(raw: string): number | null` (whole minutes, `null` when unparseable or ≤ 0 or > 24h). Accepts, case-insensitive, with optional spaces: `2h`, `2 h`, `2hr`, `2 hours`, `30m`, `30 min`, `30 minutes`, `2h30`, `2h 30m`, `1.5h`, `1,5h`, `1:30` (h:mm), bare numbers: an integer ≥ 10 is minutes (`45` → 45), a number below 10 or with a decimal is hours (`2` → 120, `1.5` → 90, `0.5` → 30). Also `extractTrailingDuration(title: string): { title: string; minutes: number } | null`: only a *trailing* token with a unit or the h:mm form, separated by a space (`"Write report 2h"` → `{ "Write report", 120 }`; `"Call 911"` → null; `"2h"` alone → null, a title is required). Document the rules in the file comment.
- `src/components/planner/DurationChip.tsx` replacing `TaskDurationPicker.tsx` (delete the old file): a button chip, always rendered on every root row on desktop (no `opacity-0`, no `hidden sm:block`), reading `formatMinutes(value)` when set and "Time" (dim, `text-share-onSurfaceDim`) when unset, `aria-label="How long: 1h30"` / `"How long: not set"`. Click opens an anchored popover (not a sheet; a `role="dialog"` with `aria-label`, closes on Escape, on outside click and after a choice; focus moves to the field on open and returns to the chip on close): a text input (autofocus, placeholder from the contract, `inputMode="text"`, Enter saves, invalid input shows the `ErrorLine` "Try 2h 30m, 45m or 1:30"), the ladder as pills (`durationOptions(value)`, the current one marked `aria-pressed`), and "Clear" when set. Use it in `TaskItem.tsx` (desktop branch) and `MustDoPinnedHeader.tsx`, in the place the old picker sat.
- `src/components/planner/ScheduleSheet.tsx`: the same typed field above the ladder in the duration section, same parser and error line; the phone chip (`TaskItem.tsx:373-380`) keeps opening the sheet and now reads "Time" when nothing is set so it is visible on every row too.
- `src/components/planner/AddTaskInput.tsx` and the `onAdd` path (`useTaskHandlers` add handler, `MustDoPinnedHeader.handleAdd`): a trailing duration token sets `durationMinutes` on the new task and is removed from the title. If `onAdd` only takes a title, extend it to `onAdd(title, options?: { durationMinutes?: number })` and thread it through; keep the placeholder text and add a one-line hint only if the design skills say so.
- Tests: `src/domain/durations.test.ts` (every example above, plus rejects: `""`, `"abc"`, `"0"`, `"25h"`, `"-5m"`; `extractTrailingDuration` positives and negatives). `e2e/duration-chip.spec.ts`: desktop — every root row shows a chip reading "Time" without hover; typing `1h 30m` + Enter sets the chip to the formatted value and the day gauge (`role="meter"`) changes; a pill sets it; Clear unsets it; Escape closes without change; adding "Write report 2h" yields a task titled "Write report" with the chip set. Phone (`PHONE` fixture) — the chip reads "Time", opens the sheet, typing `45` saves 45m.
- `CLAUDE.md` › item 7: replace the sentence about the hidden desktop chip with the new rule (always visible; typed or picked; add-line token), two or three sentences.

## Acceptance criteria (each one checkable by a scout)

1. `parseDurationInput` returns, in order, for `["2h","2 h","2hr","2 hours","30m","30 min","2h30","2h 30m","1.5h","1,5h","1:30","45","2","1.5","0.5"]`: `[120,120,120,120,30,30,150,150,90,90,90,45,120,90,30]`; and `null` for `["","abc","0","25h","-5m"]`. Pinned in `durations.test.ts`.
2. `extractTrailingDuration("Write report 2h")` → `{title:"Write report", minutes:120}`; `("Call 911")` → `null`; `("2h")` → `null`; `("Plan 1:30")` → 90.
3. At 1280x900 with three Top 3 and two Tasks seeded, five chips with `aria-label` starting "How long" are visible without any hover.
4. Typing in the popover and pressing Enter updates the stored task's `durationMinutes` (read back from `localStorage`) and the chip text; an off-ladder typed value (e.g. 100) is stored as 100 and shown in the pills list in order (`durationOptions` rule).
5. The popover traps nothing outside itself but returns focus to the chip on close; Escape closes it; `#root` is *not* made inert (it is a popover, not a sheet).
6. On the phone viewport the row chip reads "Time" when unset and the schedule sheet's typed field saves 45m.
7. `npx tsc -b`, `npm run lint`, `npm test`, `npx playwright test e2e/duration-chip.spec.ts e2e/day-completion.spec.ts e2e/minimal-today.spec.ts e2e/mobile-today.spec.ts` pass; `npx vite build` builds. No remaining import of `TaskDurationPicker`.
8. `web-design-guidelines` over the changed `.tsx`: zero open findings or each listed with a reason.
9. No change to the grip, `draggable`, pointer handlers or `useTouchReorder` (spec 01 owns them); no change to `taskUtils.ts` or `handleCopyFromDay`.

## Constraints

- Project rules from `CLAUDE.md`; minutes stay the stored truth; off-ladder values are kept, never rewritten.
- One format for a shown duration: `formatMinutes` (whatever it yields today, used everywhere; the contract's "1h 30m" means that format).
- Phone rows stay one line (CLAUDE.md item 7): the popover is desktop only; the phone path is the sheet.
- Edit with the Edit tool. Say in the report the line ranges you changed in `TaskItem.tsx` and `MustDoPinnedHeader.tsx`.

## Out of scope

- Changing the ladder's values; durations on subtasks beyond what rows have today; the challenge summary (spec 04 reads `durationMinutes` through `computeDayCompletion`, no change needed here).

## Verification the builder must run

- The commands in criterion 7, in your worktree.

## Report to

Your final message, in the shape of `~/.claude/skills/orchestrate/templates/REPORT.md`; the supervisor files it as `report-02-round1.md`.
