# Report 05, round 1 (filed by the supervisor from the builder's final message)

Builder worktree branch: `worktree-agent-a9a3ca32a1d014067`. Nothing committed.

## What changed
- `src/components/timer/FocusMode.tsx`: "Leave focus" link → outlined, filled "Exit focus" button, same top-left spot (`min-h-[44px] rounded-xl border border-share-outlineStrong bg-share-surfaceContainerLow text-share-onBg`, hover and focus-visible). Footer: "Exit focus or press Esc to bring them back."
- `src/components/timer/MobileFocusPanel.tsx`: optional `onExit`; running state top row has "Exit focus" (44px, outlined, worded) left, "Block N today" right.
- `src/components/timer/DeepWorkTimer.tsx` (not in the spec's list; the sidebar card is where criterion 5 lives): optional `onReturnToFocus`; "Back to focus" shown while the block is live and Focus was put away, `lg:` and up.
- `src/components/planner/DayPlanner.tsx`, Focus render sites only: `onReturnToFocus` and `onExit={() => setMobileTab("today")}`.
- `e2e/focus-exit.spec.ts` (new, 5 tests).

## Criteria (builder's evidence)
1 met: button named "Exit focus", border, opaque fill, contrast about 13:1, top-left, at least 44px; click shows the planner. 2 met: running keeps ticking, paused stays paused, sessions unchanged, stored status unchanged. 3 met: first Esc closes the discard question, second leaves. 4 met: phone button 44x44 in view, at least 200px above the block controls, goes to Today, block still running. 5 met: "Back to focus" brings Focus back; absent when idle. 6 met: no existing test edited. 7 met: 4 of 5 new tests fail on the old source (the idle-absent test passes on both, as expected).

## Commands
lint clean; `npx tsc -b` exit 0; `npm test` 401 passed; `npm run test:convex` 193 passed; `npx vite build` ok. Playwright port 5195, `--retries=0`, `focus-exit`, `work-safety`, `crawl`, `mobile-panels`, `mobile-redesign`, `mobile-responsive`: 83 passed, 0 failed. After the last focus-ring edit: lint, tsc, `focus-exit` and `mobile-panels` 10 passed.

## Design
`apple-design` (`modality.md`, `going-full-screen.md`), `frontend-design` (existing tokens only), `web-design-guidelines` (missing focus-visible fixed; its Title Case rule overridden by the project's sentence case).

## Open and hazards
- The shared scratchpad: builder 06 overwrote this builder's `pw.config.ts`; re-run with a uniquely named config. **To add to `02_COMMON.md`:** per-spec scratch config names.
- The builder ran `git checkout -- src` for the fails-before check and redid the edits by hand after a PowerShell encoding failure; all checks ran after that. The reviewer should read the diff itself.
- Suggestion: one line in CLAUDE.md "Deep Work" saying Exit focus and Back to focus change only the view.
