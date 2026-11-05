# Report 03, round 1: client

Filed by the supervisor from the builder's final message. Full text in the session; the parts that matter:

## Done
- Create page: "Who is taking part" radio group, "With a partner" (default) / "Just me", 44px options, helper "You can invite someone later."; solo step-2 copy; `solo: true` sent only when chosen.
- Dashboard: days-left headline (`text-numeral`, existing token) and `<p role="timer">` countdown; per-second tick armed only for lock/checkin; a second minute clock wakes at the check-in deadline so the tick disarms; solo partner slot is "Share my plan" + "Invite a partner" disclosure revealing the existing invite UI; "Your season" with one row; two-person path untouched.
- Today block: `[partnerWho, countdownLine(..., false)]`; list row "Day 22 of 92 · 70 days left" and "Just you"; admin "Solo" caption.
- New helpers `partnerWho`, `headlinePhrase` in `challengeList.ts` (+5 tests). CLAUDE.md extended.

## Verification
- tsc, lint clean; unit 371; convex 180; `vite build` 2.37s; guest e2e 11 passed on a 5191 scratch config (deleted).
- Fixture render at iPhone 14: header 179.75px; Today surface starts ≈269px; timer ticked "6:55:52" → "6:55:50" over ~2.1s. Screenshots in the session scratchpad.
- HIG: `typography.md › Conveying hierarchy`, `typography.md › Ensuring legibility`, `segmented-controls.md › Content` (sentence case kept over the HIG's title case, per project rules).
- web-design-guidelines: `aria-controls` target now always mounted (`hidden`); Title Case and `Intl` time findings kept with reasons.

## Open questions
- "Sam ✓ plan locked" (existing `stateMark`) vs the spec example "locked in": kept the existing label.

## Known gaps
- No e2e for the signed-in surfaces (guest-only seeding).
