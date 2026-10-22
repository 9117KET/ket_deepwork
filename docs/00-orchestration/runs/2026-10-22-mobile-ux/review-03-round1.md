# Review 03, round 1: Focus, Habits, Review and Challenge on a phone

*Reviewer:* supervisor (main session) · *Scout check:* after the fix round, on the merged branch

Read: the builder's three screenshots (`390-focus-idle.png`, `390-habits.png`, `390-review.png`), the commit stat, and the `MobileHabitsPanel.tsx` diff.

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met except a layout gap | 1: `mobile-panels.spec.ts` passes (67 of 67 across four specs). 2: Start is full width and 48px in the screenshot; greps empty. 3: rows are single `<button min-h-[56px]>`, footer fixed, greps empty (diff). 4: `z-[80]`, `85dvh`, test 8(b). 5: `.page-title/.overline/.stat-number` visible in the Review screenshot. 6: no `text-[10px]` in challenge files; 8(d)/(e) pass. 7: `mobile-redesign.spec.ts` unchanged and green. 8: all suites quoted green; the single full-suite failure is the port hard-code in `calendar-sync.spec.ts`, not this change. 9: stat shows no spec-01/02 files. **Gap:** the Focus tab scrolls 93px into empty space, which defeats "fits the phone with no scrolling" for the one screen that should. |
| 2 | No invented facts | met | Measurements from the builder's probe; nothing fabricated. |
| 3 | Consistent with CLAUDE.md and recorded decisions | met | Timer logic untouched; one-accent applied; emerald kept only for done stamps; README rows updated with facts. |
| 4 | Internal vs public; no outward action | met | Local commit only; `.env` copies not committed; local Playwright port config deleted. |
| 5 | Build and tests pass | met | Quoted; re-checked by the scout after merge. |
| 6 | Writing rules followed | met | Docs sentences are factual and short. |
| 7 | No scope creep | met, with accepted judgment calls | `AwayBlockClaim` on Focus idle (accepted: the phone's Focus tab is where a returning user lands after a block); HistoryGrid colour mapping to the one-accent rule (accepted); two `border-…/40` → solid (accepted). |

## Verdict
**FIX**

## FIX list (one checkable sentence each)
1. On a 390x844 phone context, `/?tab=focus` idle does not scroll: `document.documentElement.scrollHeight <= window.innerHeight + 1`; adjust the idle column's height for the existing bar clearances (for example `min-h-[calc(100dvh-13rem)]`, or measure) and add that assertion to test 8(a) in `e2e/mobile-panels.spec.ts`.
2. In `MobileFocusPanel.tsx`, the running state's confirm sheet uses `share.tertiary`-based classes (`border-share-tertiary`, `text-share-tertiary`, a `bg-share-tertiary/10` tint) instead of `amber-500`/`amber-200`; `grep -n "amber-" src/components/timer/MobileFocusPanel.tsx` returns nothing.

## Notes for the summary
- The idle Focus screen, the habit rows and Review now match the artboards' type roles and sizes; this is the most visible change of the run after Today.
- `AwayBlockClaim.tsx` and the desktop `HabitChecklist.tsx` keep off-palette colours and small buttons; neither was in scope. Candidates for a follow-up spec.
- `calendar-sync.spec.ts` hard-codes port 5173; harmless on the default config.
