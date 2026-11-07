# Review 04, round 1 — FIX (one item; otherwise approved)

Read myself in the worktree: `challengeCommitments.ts:60-95` (`goalItemsOf`, `keptLine`), `ChallengeDetail.tsx:626-760` (`TodayCommitments`, `CommitmentToggle`), the `MemberRow.tsx` diff. Ran myself: `npx tsc -b` clean; `npm test` 25 files / 388 passed.

Open questions answered:
- Placement after the next-act button: **accepted** (rule 1 keeps the first screen as row, one button, partner row).
- "Planned time done" as a column: **accepted**.
- "Broke:" shown as soon as marked, "Kept all don'ts" only after a check-in: **accepted**; that is what a daily mark is for.
- `aria-disabled` instead of `disabled` on in-flight toggles: **accepted**, better than the spec's wording.
- One kind per `markDay` call, optimistic with rollback: matches the contract.

## FIX

1. `keptLine` must never read "Kept 2 of 1 goal". Count the denominator as the active goals plus any kept goal that is archived (`active ∪ (kept ∩ archived)`), so criterion 3's example still gives "Kept 2 of 2 goals" and a day with one active goal and one archived kept goal reads "Kept 2 of 2 goals", not "2 of 1". Pin it with a test.

Everything else: APPROVE pending the scout check (`check-04-round1.md`). After the merge the supervisor drops the `contractApi` assertion once `api.d.ts` is regenerated (human step: `npx convex dev` or `npx convex codegen`).
