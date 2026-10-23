# Review 01, round 1: per-member, editable goals and don'ts

*Reviewer:* supervisor (main session) · *Scout check:* none yet (runs on round 2)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every acceptance criterion met | met, one usability defect | AC1–5 in `convex/challengeCommitments.test.ts` (12 tests, pass); AC5 `challengeView` at `challenges.ts` no longer returns `goals`/`donts`, `memberView(challenge, m)` does; AC6 `ChallengeDashboard.tsx` `CommitmentsColumn` ×2 with partner, ×1 without, `editing` → `CommitmentsSheet` → `updateMyCommitments`; AC7 `MemberDayCard` → `resolveDontTexts` over the full list; AC8 108 convex / 293 unit / lint / tsc / build / 32 e2e per report; AC9 additive fields only |
| 2 | No invented facts | met | Caps mirror the server's (`ListEditor.tsx` MAX_ITEMS/MAX_LENGTH comment points at `MAX_LIST`/`MAX_ITEM`) |
| 3 | Consistent with CLAUDE.md and decisions | met | Archive-not-delete follows the data-safety rule; legacy fallback is one function (`memberCommitments`); CLAUDE.md paragraph added in the section's voice |
| 4 | Internal/public separation; no outward action | met | Partner sees lists via `memberView` only; `dayView` untouched; `invitePreview` exposes active texts only for `ok`/`full`; nothing pushed or deployed |
| 5 | Builds and tests pass | met (per report) | see AC8 |
| 6 | Writing rules | met | Copy short and plain ("Set your goals and don'ts.", "Sam hasn't set theirs yet.", "Your partner can read these. Only you can change them.") |
| 7 | No scope creep | met | `nudgePartner`, `dayCards` untouched; no un-archive UI |

Supervisor read: the full `challenges.ts`, `challengeValidators.ts` and `schema.ts` diffs; `CommitmentsSheet.tsx`, `ListEditor.tsx`, `challengeCommitments.ts` whole; the `ChallengeDashboard.tsx`, `ChallengeJoinPage.tsx` and `CLAUDE.md` diffs.

## Verdict
**FIX**

## FIX list
1. `ListEditor`: a draft typed into the "Add" field is never lost — add it on the input's `blur` (and keep Enter/Add as they are), so tapping Save, Join or Create with text still in the box commits that text instead of dropping it. Cover it with a small unit test if the domain helpers can carry it, otherwise state in the report how it was verified by hand (the three mounts: create form, join page, sheet).

## Notes for the summary
- Merge order: spec 02 is already on `challenge-v2`; `ChallengeCard.tsx` and `challenges.test.ts` are touched by both branches in different hunks — the supervisor resolves any conflict at merge.
- Known, accepted: an archived don't named by an older check-in has no checkbox in the sheet when that check-in is edited (the id is preserved; only the share text says "a don't").
- Two-sided deploy: the client reads `me.donts`, which the old backend does not return.
