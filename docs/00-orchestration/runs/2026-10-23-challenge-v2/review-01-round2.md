# Review 01, round 2: per-member, editable goals and don'ts

*Reviewer:* supervisor (main session) · *Scout check:* `check-01-round2.md` (on the integrated branch, after merge)

## Rubric
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | FIX 1 met | met | `withDraft` on every submit path (`CommitmentsSheet.tsx` save, `ChallengeCreateForm.tsx`, `ChallengeJoinPage.tsx`) is the guarantee; blur-commit is the nicety. `commitDraft` returns null on a blank draft, and `add` reads `draftRef`, so blur + click cannot add twice. 3 unit tests in `challengeCommitments.test.ts` |
| 2 | No invented facts | met | The swallowed-tap reason was reproduced in a browser (mouse and touch) rather than asserted |
| 3 | Consistent with decisions | met, design amended | The supervisor's "add on blur" was wrong for taps; the amended design meets the intent ("never lost") without the second-tap cost. Recorded here as the decision |
| 4 | Internal/public; no outward action | met | nothing pushed or deployed; harness deleted |
| 5 | Builds and tests pass | met (per report) | 108 convex / 296 unit / lint / tsc / build |
| 6 | Writing rules | met | header comment explains the why in three sentences |
| 7 | No scope creep | met | 6 files, all in the editor's orbit |

Supervisor read: the full `07067a5` diff for `ListEditor.tsx`, `challengeCommitments.ts`, `CommitmentsSheet.tsx`. The document-level `pointerdown` capture listener is a heuristic, but a miss only leaves the draft in the box, and the submit path still sends it; acceptable.

## Verdict
**APPROVE** — merge into `challenge-v2`; scout check runs on the integrated head.

## Notes for the summary
- Rounds used: 2. The one fix was a usability trap the builder itself reported.
- Tuning-log candidate: a supervisor FIX that prescribes a UI mechanism ("add on blur") should state the outcome and let the builder pick the mechanism; this one cost a reproduction to overturn.
