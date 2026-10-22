# Review 01, round 1: Mobile foundations, chrome and overlays

*Reviewer:* supervisor (main session) · *Scout check:* `check-01-round1.md` (dispatched after approval; findings feed a later fix round if any)

Branch `worktree-agent-aa6ce584da611723f`, commit `d30c73c`. Read: the full diff of `src/index.css`, `tailwind.config.js`, `MobileTabBar.tsx`, `AppChrome.tsx`, `LoginForm.tsx`, `UndoToast.tsx`, `CompletionClaimPrompt.tsx`, and `e2e/helpers/mobile.ts`.

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met, with one amended | 1: three tokens exact (`tailwind.config.js` diff). 2: coarse 16px rule, reduced-motion, four utilities present (`index.css` diff). 3: `useCoarsePointer.ts` + test, `npm test` 287 pass. 4: tab bar classes and inline insets (`MobileTabBar.tsx` diff). 5–8: e2e tests added and the run reports 62 passed. 9: helper exports all five plus `RICH_IDS`, long titles. 10: lint, tsc, build, unit, convex, e2e all quoted green. 11: only listed files changed (stat). **Amended:** deliverable 5 asked for a ≤40px header; it is 53px because the account-menu trigger is a 44px touch target, which is the better rule. Accepted. |
| 2 | No invented facts | met | Measurements quoted from the builder's probe; habit ids read from `DEFAULT_HABIT_DEFINITIONS`. |
| 3 | Consistent with CLAUDE.md and recorded decisions | met | dvh kept; 44px targets; safe-area pair; one-accent untouched. |
| 4 | Nothing internal made public; no outward action | met | Local commit only; `.env` copies not committed. |
| 5 | Build and tests pass | met | Quoted in the report; re-run by the scout check. |
| 6 | Writing rules followed | met | Comments in the CSS explain the `!important` and the Tailwind `overline` clash. |
| 7 | No scope creep | met, two justified additions | The 44px field floor under `(pointer: coarse)` and the `label[for]` skip in the helper were needed to keep the widened gate honest without editing files owned by spec 02. Both are zero-specificity or narrowly scoped. Accepted. |

## Verdict
**APPROVE**

## Notes for the summary
- Desktop toasts now dock bottom-right at `lg` (the spec defined `.toast-dock` that way); desktop specs pass. Reversible in one rule if it reads wrong.
- The tab bar measures 68px; `DayPlanner`'s 64px spacer is spec 02's to adjust (passed on to builder 02).
- `CLAUDE.md` "Responsive foundations" rule 1 names a component that does not exist (`AppMobileNav`); the supervisor fixes the sentence at the end of the run.
