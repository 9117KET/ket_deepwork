# Report 03, round 1: Focus, Habits, Review and Challenge on a phone

*Filed by the supervisor from the builder's final message. Branch `worktree-agent-a7e32674809c5f892`, commit `b5ca3d4`, one commit on top of `mobile-ux` @ 3292f00 (worktree fast-forwarded from `main` first; clean). No push, no PR.*

## Done
- **Focus idle** is its own phone layout inside a `min-h-[calc(100dvh-7.5rem)]` flex column with flexible space above and below: `.overline` "Working on" + 48px/16px select (first option "No task, just log the time"); 48px label field; 5-column grid of 48px pills (`25m 45m 60m 90m Custom`, 8px gaps; selected `bg-share-primary text-share-onPrimary`, others `bg-share-hairline`; "Custom" turns into a numeric field when tapped); 12px "Your block: 45m on · 10m off" with a 44px "Make Nm my block" text button; 62px Epilogue tabular digits with "ready" at 12px `onSurfaceDim` (after a block: "Block logged. Start another or call it done."); full-width 48px Start (`font-bold text-[15px]`); 44x44 mute button top-right. Also renders `AwayBlockClaim` when a claim is pending. All rules still come from `useDeepWorkTimer`.
- **Focus running/paused:** same column, centred with spacers; ring `stroke-share-hairline`/`stroke-share-primary`; "Working on" is `.overline`; ring has `data-testid="mobile-focus-ring"`. Controls, confirm sheet and test ids unchanged.
- **Shared pieces:** `BlockLengthLine` and `SoundToggle` extracted into `src/components/timer/BlockLengthLine.tsx` with a `compact | phone` size; desktop uses `compact`.
- **Desktop timer:** one-accent clean-up only (selected chip, custom field + focus ring, Start, "your block" dot, block-complete state on `share.primary`/`onPrimary`/`primaryContainer`).
- **Habits:** each row is one `<button>` ≥ 56px, `rounded-xl`, 28px check, 15px/600 name, 8px dots (done `primary`, missed `hairline`, broken `tertiary`), 12px tabular streak; `aria-label` "Check/Uncheck X", `aria-describedby` → streak; at-risk keeps `tertiary` border + 11px label; identity field 16px with 44px hit area; footer "Last 7 days."; Edit 44px with `aria-label="Edit habit list"`.
- **HabitEditorModal:** phone bottom sheet (`fixed inset-0 z-[80]`, `max-h-[85dvh] overflow-y-auto`, footer `pb-safe-nav`), centred card from `sm`; every control ≥ 44px; fields 16px on phones; `role="dialog"`; Save on `share.primary`.
- **Review:** `.page-title`, 12px week range, `.overline` labels, `.stat-number` with 14px/600 "/ 20h", 44px/16px goal input, 80px bar area with 11px day letters in `onSurfaceDim` (hour labels 10→11px), 12px habit dots on `tertiary`/`hairline`, cards `rounded-2xl bg-share-surfaceContainerLow` without border, loading state `50dvh`.
- **Challenge:** `.page-title`/`.overline`; countdown `.stat-number` + 14px/600 "days left"; borderless `surfaceContainerLow` cards; inputs/textarea 16px and ≥ 44px; join-page links 44px; Review "Open" link 44px on touch; invite link 12px mono `select-all`; `MemberDayCard` emerald only on ✓ stamps, "Broke:" on `tertiary`; `CheckinSheet` rows 48px with a drawn 24px box (native checkbox kept for a11y), textarea 16px; HistoryGrid cells: both `primary`, plan only `primary/40`, check-in only `tertiary`, missed `hairline`; don't ✕ marks and notices off sky/emerald/amber.
- **Docs:** one sentence in `CLAUDE.md` ("Week of habits"); `docs/design/README.md` status rows for mobile Focus and Habits.

## Files
`src/components/timer/BlockLengthLine.tsx` (new), `MobileFocusPanel.tsx`, `DeepWorkTimer.tsx`; `src/components/habits/MobileHabitsPanel.tsx`, `HabitEditorModal.tsx`; `src/pages/ReviewPage.tsx`, `ChallengePage.tsx`, `ChallengeJoinPage.tsx`; `src/components/challenge/{ChallengeDashboard,MemberDayCard,HistoryGrid,ChallengeReviewSection,ChallengeCreateForm,ChallengeJoinPanel,CheckinSheet}.tsx`; `e2e/mobile-panels.spec.ts` (new, five tests 8(a)–8(e)); `CLAUDE.md`, `docs/design/README.md`. Nothing owned by specs 01 or 02 touched.

## Verification
- `npm run lint` clean; `npx tsc -b` clean; `npx vite build` `✓ built in 2.58s`.
- `npm test` 19 files / 287 passed; `npm run test:convex` 7 / 96 passed.
- `npx playwright test e2e/mobile-panels.spec.ts e2e/mobile-responsive.spec.ts e2e/mobile-redesign.spec.ts e2e/crawl.spec.ts` (local config on port 5191, not committed): `67 passed (1.4m)`; `mobile-redesign.spec.ts` unchanged and passing.
- Full e2e: 114 passed, 1 failed (`calendar-sync.spec.ts:146` expects `redirect_uri` on `localhost:5173`; got the local port 5191).
- Acceptance greps all empty as the spec requires; `HabitEditorModal.tsx` has `z-[80]` and `85dvh`.
- Screenshots at 390x844 in the session scratchpad `shots/`: `390-focus-idle.png`, `390-habits.png`, `390-focus-running.png`, `390-habit-editor.png`, `390-review.png` (viewed by the builder and by the supervisor).

## Open questions
- The Focus tab scrolls ~93px of empty space (`scrollHeight` 937 at 844): the `7.5rem` column plus `PlannerPage`'s `pb-20` and `DayPlanner`'s `h-16` spacer both clearing the bar.
- `AwayBlockClaim` is rendered on Focus idle too (it was Today-only, hidden on the phone's Focus tab); the component still uses sky and 36px buttons and nobody owns it.
- HistoryGrid colours mapped to the one-accent rule by the builder (listed above); confirm.
- The AC3 grep is literal and matched two `border-…/40` classes (Habits Edit, Review goal input); both changed to solid `border-share-outlineVariant`.

## Known gaps
- The habit editor's panel scrolls, so `undersizedTouchTargets` skips it as a scroller; 8(b) measures its buttons and inputs directly and checks Save/Cancel are topmost via `elementFromPoint`.
- 8(b) re-applies saved state after the seed init script on reload (the seed would otherwise overwrite the toggle).
- The running state's confirm sheet still uses `amber-500`/`amber-200`.

## Suggestions
- `HabitChecklist.tsx` (desktop rail) still uses `orange-400` for the streak and amber for at-risk.
- `AwayBlockClaim.tsx` needs the one-accent and 44px pass.
- `calendar-sync.spec.ts` hard-codes port 5173.
