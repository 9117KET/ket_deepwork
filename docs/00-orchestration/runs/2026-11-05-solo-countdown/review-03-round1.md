# Review 03, round 1: "Just me" challenges, days-left headline, live countdown (client)

*Reviewer:* supervisor (main session) · *Scout check:* `check-03-round1.md`

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met | Scout: criteria 1 to 7 and 11 PASS with file:line; 8 completed by the supervisor (`npx vite build` built in 2.4s on the merged head; the builder ran the guest e2e, 11 passed, on a 5191 scratch config it then deleted); 9 is in the builder's report (one finding fixed: `aria-controls` now points at an always-mounted `hidden` region; two kept with reasons); 10 PASS (scout grep for cyan, hex and `bg-share-primary` over the added lines found nothing) |
| 2 | No invented facts | met | the measured header height (179.75px of a 664px viewport) and the live-tick observation come from the builder's fixture render; screenshots `solo-lock.png`, `with-partner.png` read by the supervisor |
| 3 | Consistent with CLAUDE.md and decisions | met | per-second tick only on the dashboard and only while a deadline is ahead; Today block and list stay on the minute; cyan still only the one primary; sentence case throughout |
| 4 | Internal vs public; no outward action | met | nothing deployed or pushed |
| 5 | Builds and tests pass | met | merged head `6508e43`: tsc, lint clean; 371 unit, 180 convex; build clean |
| 6 | Writing rules | met | every new string is one of the fixed words; two additions outside the contract are fine: the legend "Who is taking part" (a radio group needs one) and the solo helper "Optional. You can change them any time." |
| 7 | No scope creep | met | 9 files, 227 insertions; nothing under `convex/` or in the spec-02 modules |

## Verdict
**APPROVE**

## Notes for the summary
- The builder's open question: the partner mark reads "Sam ✓ plan locked" (existing `stateMark` label), not "locked in" as the spec's example had it. Kept; the example was loose, the existing label is the one in the list too.
- Scout notes accepted as is: a challenge past its end date that the sweep has not yet closed shows "Season over" and no timer (correct); the arming decision is minute-granular, so the tick can run up to a minute past a deadline while the text stays right.
- Nit left alone: `ChallengeListPage.tsx` calls `todayIso()` in render for the headline; the active branch never reads it.
- Not done: a signed-in click-through in Chrome. e2e seeds guests only, and a guest sees the sign-in form on every challenge route. The builder's fixture render at iPhone 14 width stands in for it; the first real check is the user's, on the deployed build.
