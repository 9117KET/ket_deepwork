# Plan: challenge v2 — editable, per-member goals and don'ts; capped nudges; bug audit

*Run:* `docs/00-orchestration/runs/2026-10-23-challenge-v2/` · *Supervisor:* Fable · *Started:* 2026-10-23

## Intake decision
Three asks, two of them already designed in chat (per-member editable lists, a nudge cap with
a UI state instead of an error) and one open ("verify any bug"). The bug hunt needs facts
first, so a scout audits the feature before specs are cut; a second scout maps every reader of
`challenge.goals` / `challenge.donts` / dont ids and the whole nudge path so the two build
specs name exact files and cannot miss a consumer.

What the supervisor already knows from reading `convex/challenges.ts`:
- Goals and don'ts live on the `challenges` row (`goals: string[]`, `donts: {id,text}[]`) and
  there is no mutation that edits them after `createChallenge`. Dont ids are referenced by
  `challengeDays.dontsBroken`, so history must survive a dont being edited or removed.
- `nudgePartner` stores one `nudgeSentAt` on the nudger's own day row and throws
  `"You have already nudged them today"` on the second call. That is the "error" the user hit:
  a once-a-day rule surfaced as a raw error, not a bug in the email path. To verify.

## Scouts (Mode A)
| Scout | Brief | Output |
|---|---|---|
| bug-audit | Static audit of the whole challenge feature (backend, client, tests): list concrete bugs with file:line and the failing scenario; run the existing unit and convex suites; confirm or refute the nudge diagnosis above | `scout-bug-audit.md` |
| code-map | Every reader of goals / donts / dont ids; the full nudge path (UI → service → mutation → email); the test harness for convex functions and the e2e gates on `/challenge`; how `dayCards.mine` is typed on the client; the join page and `invitePreview` | `scout-code-map.md` |

## Workstreams (provisional; cut after the scouts report)
| # | Spec | Worktree | Depends on |
|---|---|---|---|
| 01 | `spec-01-commitments.md`: goals and don'ts move to the member (`challengeMembers.goals?`, `.donts?`, additive; `challenges.goals/donts` kept as the creator's legacy source); `updateMyCommitments` mutation; `acceptInvite` takes the invitee's own lists; `invitePreview` shows the inviter's; `checkIn` validates against the caller's donts; dashboard shows "Yours" (editable) and the partner's (read-only); dont ids preserved on edit so `dontsBroken` history still resolves | yes | code-map |
| 02 | `spec-02-nudges.md`: `nudgesSentAt: number[]` on the nudger's day row (legacy `nudgeSentAt` read as one), cap 3 a day, 60 min apart, server-enforced; pure `nudgeAvailability` in the domain; the button states "Nudge · 2 left today", "Nudge again in 42 min", "Nudged 3/3 today", "They've locked in"; no red error for a rule | yes | code-map, bug-audit |
| 03 | `spec-03-bugfixes.md`: whatever the audit finds that is real and not already covered by 01/02 | yes | bug-audit |

**Sequencing decision:** 01 and 02 run in parallel from the integration branch. They touch the
same files (`convex/challenges.ts`, `convex/schema.ts`, `src/services/challengeService.ts`)
but different functions and different schema tables, so git merges them hunk by hunk. To keep
the two from colliding on test files, each spec puts its new tests in its own file
(`convex/challengeCommitments.test.ts`, `convex/challengeNudges.test.ts`) and its new domain
helpers in its own module. 03 runs after both are merged, in the main tree, so bug fixes land
on the integrated code.

**Integration branch:** `challenge-v2` (local, from `main` 95ec54a). Builders commit on their
worktree branches; the supervisor merges approved branches into `challenge-v2`. Nothing is
pushed, merged to `main`, or deployed inside the loop.

**Deploy note for the human:** both specs change Convex function signatures and the schema.
Per `docs/DEPLOYMENT.md` this is a two-sided deploy: `npx convex deploy` must run before (or
with) the Vercel push. Builders run `npx convex codegen` and the mocked convex test suite only;
they never run `convex dev` or `convex deploy`.

## Explicitly out
- Comments on a partner's day (the user floated "view, edit or comment"; view-only on the
  other person's lists is the decision for this run; a note on a partner's card is a later
  feature).
- Editing the span, deadlines or name of a challenge (only goals and don'ts were asked for).
- Push or WhatsApp delivery of nudges; email stays the channel.
- Any change to planner sync, Google Tasks or calendar code.

## Agents dispatched
| Role | Spec / brief | Agent | Status |
|---|---|---|---|
| scout | bug-audit | scout-bug-audit | done, filed (18 findings; F8 refuted by the supervisor: `DayPlanner.tsx:617` spinner; F9/F16 confirmed at the right lines) |
| scout | code-map | scout-code-map | done, filed |
| builder | spec-01-commitments | builder-01 (branch `worktree-agent-ae2b7026e3f8da523`, 6b95360 + 4ed3811) | round 1 FIX (draft lost on Save); round 2 (07067a5) APPROVED; merged into `challenge-v2` as 2696932; integrated head: 129 convex / 296 unit / lint / tsc green |
| scout | check-01 (Mode B, on the worktree at 07067a5) | check-01 | dispatched |
| builder | spec-03-bugfixes | builder-03 (main tree, 280c68d + 5ff4b87) | round 1 APPROVED; check-03 clean |
| scout | check-03 (Mode B) | check-03 | done, filed |

**Closed 2026-10-23.** Final head `challenge-v2` 5ff4b87: 139 convex, 304 unit, lint, tsc, build green; e2e `/challenge` gates 32 passed (builders). See `99_SUMMARY.md`.
| builder | spec-02-nudges | builder-02 (branch `worktree-agent-ab3b7b0e44fb5f226`, edb00ad) | round 1 APPROVED; check-02 clean (117 convex / 287 unit / lint / tsc); merged into `challenge-v2` as 463d6e4 |
| scout | check-02 (Mode B) | check-02 | done, filed |
| builder | spec-03-bugfixes | — (main tree, after 01+02 merge) | spec written, waiting |

## Workstream 03 (cut from the audit)
F1 ConvexError + `challengeErrorMessage`; F6 ended season readable; F5 `partnerToDate`;
F9 Review maths; F11 publish only today; F4 366-day cap; F7 check-in deadline after 21:30;
F13/F14/F16 small client fixes. F2/F3/F18 went into spec 02. F8 is not a bug.
Open for the human: F10, F12, F15, F17, showing deadlines on the card.
