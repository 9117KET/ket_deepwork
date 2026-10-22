# Review 02, round 1: Today on a phone

*Reviewer:* supervisor (main session) · *Scout check:* after the fix round, on the merged branch

Read: the four viewport screenshots, the commit stat, the head of `TaskActionSheet.tsx`.

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met, one usability gap | 1–3, 6, 7, 9, 10, 12: `mobile-today.spec.ts` 11 tests pass; screenshots show 24px checks in 44px areas, two-line titles, one chip, ⋮, the bar button, the sheets above the bar; Today 989px. 4: sheet used by both row kinds (Top 3 rows show ⋮). 5: phone branch has no arrows/grip/select/drag/right-click/double-tap (grep + e2e 10(i)). 8: grep empty. 11: all named suites green via an equivalent private-port config (accepted; 5173 was shared). **Gap:** with the duration `<select>` gone from phone rows and Schedule… root-only, a subtask's duration cannot be set by touch. |
| 2 | No invented facts | met | Measurements from the builder's runs. |
| 3 | Consistent with CLAUDE.md and recorded decisions | met | Undo gateway and logging untouched; worked minutes safe; one accent; CLAUDE.md item 6 updated to describe the bar. |
| 4 | Internal vs public; no outward action | met | Local commit only. |
| 5 | Build and tests pass | met | Quoted; re-checked by the scout after merge. |
| 6 | Writing rules followed | met | |
| 7 | No scope creep | met, with two justified additions | `TouchCheckbox.tsx` (needed so the gate measures the real checkbox) and the Top 3 desktop card's `rounded-2xl`/blur removal (consistency). Segments per block rather than per 30 minutes: accepted, consistency with the chips wins. All-done rows with a visible Remove: accepted. |

## Verdict
**FIX**

## FIX list (one checkable sentence each)
1. On phones, every task's action sheet offers a way to set its duration: root tasks keep "Schedule…" (the schedule sheet carries the picker), and subtasks get a "Set duration…" row that opens the same `ScheduleSheet` for that subtask (its "Set how long" save already exists); `e2e/mobile-today.spec.ts` gains a test that opens the subtask "Pack the bag"'s sheet, taps "Set duration…", and sees the schedule sheet dialog.
2. On phones, tapping the title text of a row opens that row's action sheet (the checkbox and the ⋮ keep their own hit areas); `e2e/mobile-today.spec.ts` asserts that tapping the long list title opens a dialog whose header contains the full title.

## Notes for the summary
- This is the largest visible change of the run; the screenshots are the before/after the user should see.
- Pre-existing and out of scope: two toasts at once overlap; `ChallengeCard` has no e2e coverage (needs a signed-in user with a challenge).
