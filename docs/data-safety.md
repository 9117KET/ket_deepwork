# Data safety — what an ordinary action can destroy

A register of the ways normal use costs you recorded work, what guards exist,
and what is still open. Kept because the failures are asymmetric: a task can be
retyped in five seconds, but ninety minutes you actually sat and worked cannot
be recovered by any means once the record is gone.

Rules of thumb this follows:

- **Worked minutes are sacred.** Sessions and hand-logged time get protections
  the rest of the planner does not need.
- **Warn only about real loss.** A warning that overstates the damage trains
  people to click through it, which is worse than no warning.
- **Never make "destroy it" the only way forward.** If an action is blocked,
  the message names a way out that keeps the work.

Pure logic lives in `src/domain/workSafety.ts` (unit tests alongside it);
end-to-end behaviour is in `e2e/work-safety.spec.ts`.

## The failure that started this

1. Deleted a high-priority task, wanted it back — no undo.
2. Paged to the previous day and used *copy from day* to bring it back.
3. The running deep work block came out of that unusable.
4. Starting a new block said *"a block is already running — reset it first"*,
   and resetting silently binned the elapsed minutes.

Three separate defects in one sequence, all now closed.

## Closed

| # | Scenario | What used to happen | Guard |
|---|---|---|---|
| 1 | Start a block, page to another day, let it land | The whole session was written onto **the day on screen**, inflating a day that was already closed | `blockDayIso` — a block belongs to the day it *started* |
| 2 | Change your block length while a block runs | The finish line moved under the countdown and the session recorded minutes never worked | Length is pinned at `start()`; presets and custom input are inert while running *or paused* |
| 3 | Stop a block that has been running a while | Elapsed minutes were binned silently, no record, no undo | **Stop** offers *Keep 31m and stop* / *Discard* / *Cancel*. Below 1 minute it still resets in one click |
| 4 | Start a block while one is running | Dead end — the only exit named was the destructive one | Notice names the non-destructive route and reports what is at stake |
| 5 | Delete a task you have already worked on | Sessions kept a dangling `taskId`; the work lost its label | Sessions are **detached, not dropped** — minutes keep counting and the old title folds into the label |
| 6 | Bulk-delete selected tasks | Same, silently, across many tasks at once | Same detachment, plus the confirmation in #7 |
| 7 | Delete a task carrying hand-logged minutes | Destroyed with no prompt — no other record exists | Confirms, naming the amount. Timed-only work does **not** prompt (see #5 — it survives) |
| 8 | A session's start time | Synthesised as `now − duration`, so a paused or restored block recorded a fictional interval | The real start instant is carried through and stored |
| 9 | **Any destructive planner action** | Final, immediately | One step of **Undo**, offered for 12s — covers task delete, bulk delete, *copy from day*, and habit / side-quest definition edits |

## Open

Identified and reproducible, not yet fixed. Roughly in value order.

| # | Scenario | Cost |
|---|---|---|
| 10 | Finance deletes — accounts, debts, transactions, ETF holdings, savings goals, journal entries, net-worth snapshots | **No confirmation and no undo on any of them.** Undo covers the planner only. Deleting a net-worth snapshot destroys a point in a series that cannot be reconstructed |
| 11 | Deleting a habit or side-quest definition | Undo catches the mistake within 12s, but the underlying orphaning is unchanged: past `habitCompletions` keep a key nothing renders |
| 12 | *Copy from day* duplicates | Undo takes the whole copy back out, but the copy itself still adds near-duplicates differing only in case or whitespace |
| 13 | Closing the tab mid-block | The block survives (mirrored to `localStorage`), but nothing warns you, and past `AWAY_BLOCK_MAX_AGE_MS` (12h) the claim is dropped unasked |
| 14 | Editing a task's duration below what is already logged | The progress row shows overrun in amber but nothing confirms the change |
| 15 | Undo is one step, planner-only, and 12 seconds | Deliberate (see `useUndoableActions`), but a mistake noticed a minute later is still final |

Two guards already existed and are fine: deleting a trip, and disconnecting
Google Calendar.

## Testing these

```bash
npx vitest run src/domain/workSafety.test.ts         # the ledger rules
npx vitest run src/hooks/useUndoableActions.test.ts  # the undo staleness rule
npx playwright test e2e/work-safety.spec.ts          # the behaviour
```

The e2e suite seeds `deepblock_active_block_v1` directly to put a block
mid-run without waiting out a real countdown — see `seed()` in that file.

## How undo stays safe

`useUndoableActions` holds one snapshot of the state before the last
destructive action. Restoring a whole snapshot would happily revert work done
*after* the mistake — the exact failure this is meant to prevent — so every
mutation bumps a counter and the offer is void the moment the counter moves
past the one it was recorded against.

That is why the hook owns the planner's update gateway rather than sitting
beside it: **a change it cannot see is a change its snapshot could destroy.**
Any new mutation path must go through `undoable.update`.

The snapshot itself is nearly free: the planner updates state immutably, so
the previous `AppState` already exists and is about to be dropped — keeping it
costs a pointer, not a copy of the history.
