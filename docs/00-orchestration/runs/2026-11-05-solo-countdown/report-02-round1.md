# Report 02, round 1: countdown domain

Filed by the supervisor from the builder's final message.

## Done
- `src/domain/challengeCountdown.ts`: `CountdownState`, `localDeadlineMs`, `countdownState`, `formatCountdown`, `formatCountdownCoarse`, `countdownLine`, `DaysLeftHeadline`, `daysLeftHeadline(progress, span, todayIso)`. Pure.
- `src/hooks/useSecondTick.ts`: `useSecondTick(active)` re-arms a timeout on each whole second while active and visible; `nextTickDelay(nowMs)`.
- Tests: 19 in `challengeCountdown.test.ts`, 2 in `useSecondTick.test.ts`.

## Verification
- tsc and lint clean. `VITE_CONVEX_URL=... npx vitest run`: 25 files, 366 tests. Countdown tests also pass under `TZ=America/New_York` and `TZ=Asia/Kolkata`.

## Open questions
- `owedAct` returns 'lock' when a check-in exists without a plan; `countdownState` returns 'done'. Spec 03 chooses.

## Known gaps
- The hook is not rendered in a test (node environment, no testing-library).
- Activation updates from a 0 ms timeout, not in the effect body, to satisfy `react-hooks/set-state-in-effect`.
