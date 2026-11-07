# Review 03, round 2 — APPROVE (scout check pending, `check-03-round2.md`)

Read myself in the worktree: `assertSpan` (370-387), `cleanMarks` (404-424), `upsertDay` (438-463, `goalsKept` added to `extra`), `updateSpan` (932-972), `checkIn` (1130-1161), `markDay` (1173-1207). Ran myself: `npm run test:convex` → 16 files, 193 passed; `npx tsc -b` → clean.

Against the contract (§A as amended):
- `updateSpan` check order matches (member → creator → `assertSpan` → end vs every member's today → start vs first stamped row); patches only dates and the deadlines given; day rows untouched; `status` untouched. The refusal sentence names the day ("24 Oct").
- `markDay` writes only the lists given, inserts a bare row with `emptySummary()` and no acts, never calls `recordAct`, never touches `summary`/`checkinAt`/`planSetAt`/`note`. On an existing row it patches only the given fields (not `summaryUpdatedAt`), so the client's next summary sync is unaffected.
- `checkIn`: `dontsBroken` keeps its full-set semantics; `goalsKept` written only when given.
- `memberView.goals` back to `string[]`; `goalItems` carries ids; the four `src/` type errors are gone, so the live client renders through the deploy window.
- Partner view gains `goalsKept` and nothing else; no `userId`.

Acceptable gaps (recorded, not FIX): rule 5's walk passes unstamped rows (bounded by one season per member, two members); the partner-clock leg of rule 4 is code-covered, test-covered from one clock only. Old clients saving goals before spec 04 ships churn goal ids (archived, never deleted; marks still resolve).

Verdict: APPROVE. Integration: this worktree's patch applies first; spec 04 drops its `// contract: spec 03` assertions after the merge once `npx convex dev` regenerates `api.d.ts` (a human step, since the loop does not start Convex).
