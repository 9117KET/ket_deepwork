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
| 1b | Start a block, page to another day, close the tab, let it land, claim it | The stored record (`deepblock_active_block_v1`) carried the day **on screen** when it was last written, so the away claim filed the minutes there; its fallback was a UTC date, the previous day for the first hours after midnight east of Greenwich | The record stores the local day the block started (`persistedBlockDayIso` in `useDeepWorkTimer.ts`), and the claim reads the day from `startedAt` (`blockDayIso`), so a record written by an older build is filed right too. A block that crosses midnight stays on the day it started. Gate: `e2e/away-block-day.spec.ts` (running, paused and restored, in flight on return) and `src/components/timer/useDeepWorkTimer.test.ts` |
| 1c | Start a block for a task, page to another day, let it land (live or claimed later) | The timer looked its task up in the day on screen, found nothing there, and recorded the block against **no task**: the minutes were kept, what they were for was lost | The timer holds the task from the moment the block starts (`blockTask` in `useDeepWorkTimer.ts`, restored with the stored record). When the session is filed, `attributedTaskOnDay` keeps the id only while the task still exists on the block's day, so a task deleted mid-block leaves the session unattributed, never dangling. Gate: `e2e/away-block-day.spec.ts` and `src/domain/blockAttribution.test.ts` |
| 2 | Change your block length while a block runs | The finish line moved under the countdown and the session recorded minutes never worked | Length is pinned at `start()`; presets and custom input are inert while running *or paused* |
| 3 | Stop a block that has been running a while | Elapsed minutes were binned silently, no record, no undo | **Stop** offers *Keep 31m and stop* / *Discard* / *Cancel*. Below 1 minute it still resets in one click |
| 4 | Start a block while one is running | Dead end — the only exit named was the destructive one | Notice names the non-destructive route and reports what is at stake |
| 5 | Delete a task you have already worked on | Sessions kept a dangling `taskId`; the work lost its label | Sessions are **detached, not dropped** — minutes keep counting and the old title folds into the label |
| 6 | Bulk-delete selected tasks | Same, silently, across many tasks at once | Same detachment, plus the confirmation in #7 |
| 7 | Delete a task carrying hand-logged minutes | Destroyed with no prompt — no other record existed | Hand-logged time is now a `DeepWorkSession` (`source: 'manual'`), so it is **detached, not dropped**, exactly like timed work. What still dies with the task is the legacy `Task.manualLoggedMinutes` total from before that change, and only that still raises the confirmation (`summarizeTaskWork.irrecoverableMinutes`) |
| 8 | A session's start time | Synthesised as `now − duration`, so a paused or restored block recorded a fictional interval | The real start instant is carried through and stored |
| 9a | Pick the wrong task in "Working on" and work a full block | The minutes were stuck on the wrong task for good; the only lever that touched a session's task was deleting the task, so the remedy for a mislabelled record was destroying the label | `reattributeSession` — the sheet's *Worked against the wrong task?* moves a block to any trackable task on the day (done ones included) or to none, changing nothing but the attribution |
| 9 | **Any destructive planner action** | Final, immediately | One step of **Undo**, offered for 12s — covers task delete, bulk delete, *copy from day*, and habit / side-quest definition edits |
| 9b | *Fill from yesterday* (*copy from day*) | A copy kept the legacy `manualLoggedMinutes`, so a fresh row showed logged time nobody worked that day, and kept `scheduledAt` with no calendar event behind the new id | The fill copies the source's Top 3 roots into today's free slots (the rest to Tasks) and its list roots, subtasks with their root, all **unticked**; `cloneTasksForDay` clears `scheduledAt` (`resetSchedule`) and **drops `manualLoggedMinutes`**; `deepWorkSessions` are never read or written by it. A fill with nothing new is not offered, so it never leaves an empty Undo. Gate: `e2e/fill-from-yesterday.spec.ts` |

## Open

Identified and reproducible, not yet fixed. Roughly in value order.

| # | Scenario | Cost |
|---|---|---|
| 10 | Finance deletes — accounts, debts, transactions, ETF holdings, savings goals, journal entries, net-worth snapshots | **No confirmation and no undo on any of them.** Undo covers the planner only. Deleting a net-worth snapshot destroys a point in a series that cannot be reconstructed |
| 11 | Deleting a habit or side-quest definition | Undo catches the mistake within 12s, but the underlying orphaning is unchanged: past `habitCompletions` keep a key nothing renders |
| 12 | *Copy from day* duplicates | A root already on the day (same section, title trimmed and case-folded, judged where the copy would land) is skipped, and Undo takes the whole copy back out; titles that differ in inner spacing or punctuation still copy as near-duplicates |
| 13 | Closing the tab mid-block | The block survives (mirrored to `localStorage`), but nothing warns you, and past `AWAY_BLOCK_MAX_AGE_MS` (12h) the claim is dropped unasked |
| 14 | Editing a task's duration below what is already logged | The progress row shows overrun in amber but nothing confirms the change |
| 15 | Undo is one step, planner-only, and 12 seconds | Deliberate (see `useUndoableActions`), but a mistake noticed a minute later is still final |

Two guards already existed and are fine: deleting a trip, and disconnecting
Google Calendar.

## Testing these

```bash
npx vitest run src/domain/workSafety.test.ts         # the ledger rules
npx vitest run src/hooks/useUndoableActions.test.ts  # the undo staleness rule
npx vitest run src/components/timer/useDeepWorkTimer.test.ts  # the stored block's day
npx playwright test e2e/work-safety.spec.ts          # the behaviour
npx playwright test e2e/away-block-day.spec.ts       # a block claimed after the tab closed
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
