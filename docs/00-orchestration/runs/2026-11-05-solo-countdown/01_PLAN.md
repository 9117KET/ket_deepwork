# Plan: solo challenges and the deadline countdown

*Branch:* `run/2026-11-05-solo-countdown` (from `origin/main` at `a23ab7c`, which holds PR #37). *Supervisor:* Fable (main session). *Knobs:* defaults from the skill; WORKTREE on for every spec.

## Workstreams

| # | Spec | What | Worktree | Depends on | Builder |
|---|---|---|---|---|---|
| 01 | `spec-01-solo-backend.md` | `solo` flag on `challenges`: schema, `createChallenge` arg, cleared on `acceptInvite`, in every view and the admin row; tests | yes, from `main` | – | (dispatch) |
| 02 | `spec-02-countdown-domain.md` | Pure countdown rules (`src/domain/challengeCountdown.ts`), the days-left headline strings, a `useSecondTick` hook; unit tests | yes, from `main` | – | (dispatch) |
| 03 | `spec-03-client.md` | Create page "Just me", solo copy on every challenge surface, the days-left headline and the live countdown on the detail page and Today block, admin "Solo" marker, CLAUDE.md | yes, from `main` then `git merge run/2026-11-05-solo-countdown` | 01 and 02 merged | (dispatch after 01 and 02 APPROVE) |

01 and 02 run in parallel and touch disjoint files. 03 starts once both are merged onto the run branch, so it type-checks against the real `solo` field and the real countdown module.

## Explicitly out

- A standalone countdown to an arbitrary date.
- Any change to the inactivity, reminder or nudge rules.
- Deploying, pushing, committing (the user asks at the end).
- Design changes outside the challenge surfaces.

## Checks

- 01: scout check (backend tests, privacy: nothing new leaks a partner's `userId`).
- 02: supervisor runs the unit tests; scout check for the deadline arithmetic across DST and the local-time construction.
- 03: scout check (lint, build, unit and convex suites, every solo string), then the supervisor reads the diff and, if `npm run dev` can come up, clicks through the create page in Chrome.

## Agents (filled in at dispatch)

- 01: builder a387d611 (worktree `worktree-agent-a387d6114e0b000f6`), APPROVE round 1, merged `4a46bc5`
- 02: builder aabd517f (worktree `worktree-agent-aabd517f1a35c65d1`), APPROVE round 1, merged `625b839`
- 03: builder af6c9401 (worktree `worktree-agent-af6c9401b0b4ec83f`), scout a80e40c9 checked, APPROVE round 1, merged `6508e43`
