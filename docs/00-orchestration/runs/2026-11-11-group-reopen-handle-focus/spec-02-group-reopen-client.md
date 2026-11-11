# Spec 02: group challenges and reopening, client

*Run:* `docs/00-orchestration/runs/2026-11-11-group-reopen-handle-focus/` · *Builder:* builder ·
*Worktree:* yes · *Playwright port:* 5197 · *Time box:* 180 minutes of agent work

## Goal

Every challenge screen works for a group of up to eight people, the creator of an ended
challenge can reopen it from the dashboard, and no screen says something the new backend
makes false ("ends it for both", "two members", "your partner" in a group). A two-person
challenge looks and reads as it does today.

## First step

Your worktree is on `main` without the new backend. Apply it before anything else:

```
git apply --3way <run folder>\patch-01-round1.patch
git add -A && git reset -q
```

It touches only `convex/`, `CLAUDE.md` and `docs/DEPLOYMENT.md`. A round-2 fix to `updateSpan`
may land later; it changes no shape you use. Do not edit anything under `convex/`; a backend
gap goes in your report.

## Inputs (read all of these first)

- `02_COMMON.md` (run folder): setup, rules, checks, report.
- `03_CONTRACT.md` (run folder): the shapes you read (`others`, `memberView.key`,
  `isCreator`, `memberCount`, `capacity`, `warning.memberKey`/`displayName`, `reopenedDate`,
  `closedSpans`, `nudgesByMember`, `otherDates`, `otherToDates`) and the sentences.
- `00_BRAIN_DUMP.md` (run folder): the user's decisions and the supervisor's assumptions.
- `scout-two-member.md` (run folder): every client site with line numbers.
- `scout-reopen.md` (run folder), "Client".
- `report-01-round1.md` (run folder): what the backend actually does, including the
  builder's resolved gaps (warned former member reads "A former member"; inactivity counts
  from the day after the reopen; the check-in deadline phrase).
- `CLAUDE.md` "Accountability challenge" (as the patch leaves it) and "Responsive
  foundations"; `docs/design/README.md`; the 2026-11-02 design rules
  `docs/00-orchestration/runs/2026-11-02-duration-dnd-multichallenge-design/scout-design-review.md`.
- Skills: `apple-design`, `frontend-design`, `web-design-guidelines`.

## Deliverables

Client changes under `src/` (hooks, services, domain, challenge components and pages), new
pure helpers with unit tests in new files, `e2e/challenge-group.spec.ts`, and `CLAUDE.md`
"Accountability challenge" brought in line with the screens.

## Acceptance criteria

**Data**
1. `useChallenges`, `useChallengeDetail`, `useTodayCards` and `useChallengeHistory` read
   `others` and pass each other member's own local date (`otherDates`, `otherToDates`, from
   that member's `timezone`), so a member a day ahead never leaves a hole. Two-person
   challenges keep working whether or not `others` is present.
2. Every per-member element is keyed by `memberView.key`, never by display name or index.

**Dashboard (`ChallengeDetail`)**
3. Today surface: your row and your next act as today; then one `MemberRow` per other active
   member, in join order, each with its own Nudge (calling `nudgePartner` with `memberKey`, its
   availability judged from `nudgesByMember[key]` with the existing pure nudge rules) and the
   warning sentence on the warned member's row. Share stays one action for the group. While
   seats remain (`memberCount < capacity`) any member sees the invite link ("Invite someone",
   with how many seats are left); at 8 it is gone.
4. Head to head shows a row per member, you first, then the others in join order; no ranking
   or medal. "Planned time done" and the two numbers per row stay as defined.
5. The season grid stays readable for 2 to 8 members on a 320px-wide phone: you decide the
   layout with the design skills (for example a row per member, or the grid for one member at
   a time with a member picker), with these rules: each state keeps its shape (filled, ring,
   dot, dash), a screen reader reads every member's state per day, two people keep a layout
   at least as clear as today's, and the closed stretches (`closedSpans`) show as "closed" for
   everybody, never as missed. Justify the choice in the report with the skill pages you used.
6. Goals and don'ts: yours, then each other member's, read-only.
7. Leave copy says what will happen: alone → it ends; creator with others → "<earliest-joined
   member> becomes the creator and the challenge goes on"; anyone else → "You can come back
   with a new invite link, and everything you recorded comes back with you."
8. **Reopen:** on an ended challenge the creator sees "Reopen challenge" beside Delete. It
   opens a `Sheet`: if the end date is today or later, one verb reopens it; if it has passed,
   the sheet asks for a new end date (date input, min today, at most 366 days ahead) and the
   verb is disabled until one is set. A `needsEndDate` or any other refusal shows the server's
   sentence with `ErrorLine`. On success the dashboard is live again with no reload, for every
   member viewing it. A non-creator sees no Reopen, and the ended sentence tells them the
   creator can reopen it.
9. A reopened challenge's header says so once ("Reopened 11 Nov") under the day line.

**Other screens**
10. `/challenge` list: each running row shows your mark and, for a group, "3 of 5 locked in"
    style counts instead of one partner mark; two people keep today's marks. Ended rows keep
    their sentences; `allLeft` reads "everyone left"; legacy `creatorLeft` still reads as
    today.
11. Today block (`ChallengeTodayBlock`) and the `DayHeader` pill: one compact row per
    challenge as today; for a group the partner mark becomes the same "3 of 5" count. Review
    (`ChallengeReviewSection`) shows one week row per member.
12. Create page: "With a partner" becomes "With others" (or the wording you justify), the
    invite copy says a link seats one person and a group holds up to 8. Join page: `full`
    reads "This challenge is full (8 members)"; a returning member's join works with no extra
    step.
13. Every "your partner" string in the challenge screens and sheets (`CheckinSheet`,
    `CommitmentsSheet`, `MemberRow`, join panel, delete and leave sheets) reads right for two
    people and for a group. List the strings you changed.

**Quality**
14. Unit tests for every new pure helper (counts, per-member dates, leave sentence, grid
    model with closed spans, reopen date bounds).
15. `e2e/challenge-group.spec.ts`: what a guest can reach (as `challenge-guest.spec.ts`
    does), plus component-level checks you can make without a signed-in backend. Say plainly
    in the report which criteria have no browser test because the e2e suite is guest-only.
16. `e2e/challenge-guest.spec.ts`, `e2e/mobile-responsive.spec.ts` (44px gates on
    `/challenge`) and `e2e/mobile-today.spec.ts` pass unchanged.
17. Lint, `npx tsc -b`, `npm test`, `npm run test:convex`, `npx vite build` pass.

## Constraints

- Cyan is only the one primary button on challenge screens; "done" is `share.done`; sheets
  use `ui/Sheet` / `ActionSheet`; quiet actions are `ui/TextButton`; errors are `ErrorLine`.
- Interface copy: sentence case, buttons say what happens, no em dashes.
- Nothing under `convex/`, the planner rows, the timer or Focus (other builders' files).

## Out of scope

- Admin page changes beyond copy; a member removing another member; more than one warning.

## Verification the builder must run

The checks in `02_COMMON.md`, plus Playwright on port 5197 for the three files in criterion 16
and the new file.

## Report to

Your final message; the supervisor files it as `report-02-round1.md`. Include the grid layout
decision with its skill references, the strings changed, and every backend gap found.
