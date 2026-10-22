# Summary: mobile UX overhaul (run 2026-10-22-mobile-ux)

*Supervisor:* Fable · *Integration branch:* `mobile-ux` (local, HEAD 7dbf382, not pushed) · *Base:* `main` @ 7753c82

## What was built and approved
| Spec | What a phone user gets | Branch / commits | Rounds |
|---|---|---|---|
| 01 Foundations | Three design tokens (`share.hairline`, `onSurfaceDim`, `barBg`), `.overline/.page-title/.stat-number/.toast-dock`, 16px + 44px fields on coarse pointers (no iOS zoom), reduced-motion rule, `useCoarsePointer()`, tab bar on the artboard ground with 11px labels and landscape insets, tab bar on every route, slimmer header, 48px sign-in form, toasts docked above the bar, shared e2e fixtures (`e2e/helpers/mobile.ts`) | d30c73c, f872f35 | 2 (APPROVE at 1, fix for a CSS-order ambiguity) |
| 02 Today | Row = 24px checkbox in a 44px area, 15px two-line title, one chip, ⋮ → `TaskActionSheet` (every action incl. Delete, Hide from partner, Move, Set duration), one-button segmented progress bar → progress sheet, no arrows/grip/select/drag/right-click/double-tap, 48px add field, sheets and toasts above the bar, `?tab=` honoured after mount, ChallengeCard in the quoted-card shape, Today with 8 tasks at 989px (was clipped past the viewport) | a871408, 4c6084a | 2 (FIX: subtask duration, title tap) |
| 03 Panels and pages | Focus idle as a phone screen (full-width 48px Start, 48px pills, 62px digits, fits one screen), running state centred on tokens, desktop timer on the one accent, Habits rows as 56px whole-row toggles, habit editor as a bottom sheet, Review and Challenge on the artboard type roles with 44px controls and 16px inputs | b5ca3d4, d2b4f53, f072f50, f24e190 | 4 (FIX: no-scroll idle + tertiary tokens; one-line timer notice; integration fix after 02's spacer change) |

Every spec had an independent scout check on the merged branch (`check-0N-round1.md`); all criteria met.

## Verification on the final head (supervisor, main checkout, 2026-10-22)
- `npm run lint`, `npx tsc -b`, `npx vite build`: clean.
- `npm test`: 287 passed. `npm run test:convex`: 96 passed.
- `npx playwright test` (full suite, 128 tests incl. the new `mobile-today`, `mobile-panels` and the extended `mobile-responsive`): **128 passed**.

Before/after evidence (session scratchpad, outside the repo): `mobile-audit/390-today.png`, `390-focus.png`, `390-habits.png` (before); `b02/390-today-top.png`, `390-sheet.png`, `390-progress.png`, `shots/390-focus-idle.png`, `390-habits.png`, `390-review.png` (after).

## Decisions made during the run (recorded for CLAUDE.md / design README)
- The artboards' NOW/THEN/REST OF DAY hero is obsolete (its time blocks are gone); only the row language, type roles, radii and the one-accent rule were applied. `docs/design/README.md` status rows updated.
- One accent: `share.primary` act-now, `share.tertiary` warnings, emerald only on done stamps and the Top 3 all-done banner, red only on Delete/discard.
- Phone vs desktop is decided by pointer (`useCoarsePointer`, `touch:`), not width; desktop rows, popup menu and drag are unchanged.
- The mobile wordmark header stays (slimmed to 53px, bounded by the 44px account target). No fifth tab for Challenge.
- `CLAUDE.md` "Responsive foundations" rule 1 now names `MobileTabBar` and the z-order (bar 60, toasts 70, sheets 80) and the coarse-pointer field rules.

## Still open (not done in this run)
- `AwayBlockClaim.tsx` keeps sky and 36px buttons; `HabitChecklist.tsx` (desktop rail) keeps orange/amber; `FocusMode.tsx` has raw hex and a 10px label; amber survives in `CalendarTimeline`, `ScheduleSheet`, `SectionColumn` (drop target) and `DayPlanner`'s error block. Nobody owned them; a short follow-up spec would close them.
- Two toasts shown at once still overlap (pre-existing).
- `ChallengeCard` and the challenge pill have no e2e coverage (need a signed-in user with a challenge).
- On a subtask, "Set duration…" opens the full schedule sheet (time controls included); a length-only mode would be cleaner.
- `playwright.config.ts` reuses any server on 5173; a port override would make parallel worktrees safe.
- `convex/_generated/*` show uncommitted modifications in the main checkout from the earlier prod deploy's codegen (outside this run; harmless).

## Decisions needed from the human
1. Review `mobile-ux` on a phone (or the screenshots above) and decide whether to open a PR to `main`. Nothing was pushed or committed to `main` in the loop; the run-folder files and the three doc edits are uncommitted on `mobile-ux`.
2. Whether to run the follow-up spec for the leftovers listed above.

## Agents and rounds
Scouts: 3 research (audit, design gap, code survey) + 3 checks. Builders: 3 (Opus), 8 rounds in total (01: 2, 02: 2, 03: 4). Worktrees: 3, merged into `mobile-ux` after approval.
