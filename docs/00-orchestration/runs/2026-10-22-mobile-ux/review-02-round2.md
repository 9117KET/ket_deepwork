# Review 02, round 2: Today on a phone

*Reviewer:* supervisor · *Builder report:* `report-02-round2.md` · *Scout check:* `check-02-round1.md` on the merged branch

| Fix | Result | Evidence |
|---|---|---|
| 1. Subtask duration reachable by touch | done | `onSetDuration` row for subtasks → `ScheduleSheet`; new e2e test passes. |
| 2. Title tap opens the sheet | done | 44px title button on coarse pointers in both row kinds; new e2e test passes. |

Open question accepted as is: the schedule sheet's time controls are reachable for a subtask on phones. Scheduling a subtask into the calendar is harmless (it writes an event like any task) and a length-only mode is a refinement for later.

## Verdict
**APPROVE** (merged into `mobile-ux`)
