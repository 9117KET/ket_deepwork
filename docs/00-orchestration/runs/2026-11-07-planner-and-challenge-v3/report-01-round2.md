# Report: spec 01, round 2 — filed by the supervisor from the builder's final message

Fix 1 done. `flick()` sends the touch-start and both moves together (no round trip between them), so they arrive inside the 300 ms hold however busy the machine is. The in-page timer, its log line and `expect(span).toBeLessThan(100)` (old line 184) are removed; the tests check only the result: a finger on the handle moves T3 to the top (`[T3,T1,T2]`), the same gesture on the body leaves `[T1,T2,T3]`. The full-Top-3 refusal test shares `flick()`.

Only `e2e/drag-handle.spec.ts` changed; nothing committed. `npx tsc -b` clean; `npx eslint e2e/drag-handle.spec.ts` clean; `npx playwright test e2e/drag-handle.spec.ts --workers=4 --repeat-each=3 --retries=0` → 27 passed (18.5 s), 9 tests × 3.
