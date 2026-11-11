# Plan

Tier (per `/sdlc`): Feature for 1 and 2 (data shape, two-sided deploy, privacy rules), Patch
for 3 and 4.

## Workstreams

| # | Workstream | Worktree | Depends on | Agent |
|---|---|---|---|---|
| 01 | Group challenges, backend: member cap, invites, views, reminders, inactivity, nudges for N members | yes | scout-two-member, user's cap decision | |
| 02 | Group challenges, client: dashboard, list, Today block, season grid, head to head for N members | yes | 01's contract | |
| 03 | Reopen an ended challenge: mutation, rules, UI | yes | scout-reopen, user's decision on who and dates | |
| 04 | Drag handle on the left of every task row | yes | scout-planner-ui | |
| 05 | Focus mode: a clear exit button | yes | scout-planner-ui | |
| 06 | Fixes from the sweep (clear defects only) | yes | scout-sweep | |

## Scouts (Mode A, read-only, no servers)

| File | Question |
|---|---|
| `scout-two-member.md` | Every place in backend, client, emails and tests that assumes at most two members |
| `scout-reopen.md` | How a challenge ends, what each end state leaves behind, what a reopen must restore or decide |
| `scout-planner-ui.md` | Where the drag handle is rendered and positioned; how Focus mode is entered and left today |
| `scout-sweep.md` | Defects and gaps in the current head worth fixing |

## Out

- Commit, push, deploy: only on the user's word. 01 to 03 are a two-sided deploy, backend first.
- The CI patch on `chore/ci-tests-and-e2e-dates` (separate change).
