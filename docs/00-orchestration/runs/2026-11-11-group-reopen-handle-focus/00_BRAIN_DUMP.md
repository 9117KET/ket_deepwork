# Brain dump (verbatim, 2026-11-11)

> also deplo agents to make sure that in this project challenges can be join by more than one 2
> persons, and also a closed challenged can be re-open with all information saved and then the
> drag and drop should be on the left side, also when on focus mode they should be a clear
> button to exit the focus mode, and also fix anything I might have mixed

Context: sent while the supervisor was closing gaps 1 to 3 of `docs/ENGINEERING_BASELINE.md`
on branch `chore/ci-tests-and-e2e-dates` (e2e date seeding, tests in CI). That patch is
separate from this run and is not committed yet.

## Supervisor's reading

1. A challenge can be joined by more than two people.
2. A closed (ended) challenge can be reopened with everything it recorded kept.
3. The drag handle sits on the left side of each task row.
4. Focus mode has a clear button to leave it.
5. "Fix anything I might have missed": a scout sweep for defects and gaps; findings come back
   as a list, and only clear defects are fixed in this run.

## Decisions (user, 2026-11-11, by question sheet)

1. **Group size:** a challenge allows up to 8 members.
2. **Who reopens:** the creator only.
3. **Reopen dates:** when the end date has passed, the reopen asks for a new end date from
   today onward. Past days stay as recorded; the days while it was closed are not counted as
   missed.
4. **Creator leaves a group:** the challenge runs on and the longest-standing remaining member
   becomes the creator. It ends only when the last person leaves.

5. **Quiet member in a group of three or more:** only that member drops out on day 4 (warning
   on day 3 as now); everyone is emailed; the challenge runs on. Their days, goals and don'ts
   are kept, and a new invite link puts them back with everything intact. With two people or
   one, the rule stays as today (the challenge closes).

Supervisor's assumptions (not asked; say so in the summary): leaving becomes a soft leave (the
member row is kept and marked), which is what makes "all information saved" true for someone
who left; any member may still create an invite, one seat per link; nudges are capped per
person nudged (three a day, an hour apart), not across the whole group; a reopen emails the
other members; the 366-day limit on a reopened season is measured from the reopen day; the
days a challenge was closed show as "closed" in the season grid and count for nobody; every member sees every other
member's published day, exactly what a partner sees today; a challenge that ended because the
creator left under the old rule has the creator's row kept, so the creator can still reopen it.

