# Report 03, round 4 (integration FIX): Focus idle column vs spec 02's spacer

*Filed by the supervisor from the builder's final message. Commit `f24e190` on `worktree-agent-a7e32674809c5f892`, on top of a fast-forward to `mobile-ux` 9374404. Merged as 7dbf382.*

- Fix 1: done. `IDLE_COLUMN` is `min-h-[calc(100dvh-14rem-env(safe-area-inset-bottom))]`; the inset is subtracted because spec 02's spacer grows by it. Measured at 390x844: `scrollHeight` 844 vs `innerHeight` 844 (no scroll, 0px spare); Start bottom 568px, tab bar top 776px. Comment names the new spacer size.

Verification: `npx tsc -b` clean; `npm run lint` clean; `npx playwright test e2e/mobile-panels.spec.ts e2e/mobile-redesign.spec.ts --reporter=line` `15 passed (24.3s)`. Supervisor: full suite on the merged head, 128 passed.
