# Brain dump (verbatim), 2026-11-05

> now I also want there to be a posiblity of actually creating a challege for myself and also a count down sort of implementation, let brainstorm on this and see how to implement it, use loop to do this

Supervisor's brainstorm offered three countdown readings (days left; a standalone countdown to a date; a live hh:mm:ss to the daily lock-in and check-in deadlines) and asked two questions. The user answered:

> Go with option 3 and days left, and yes to inviting later

## Decisions fixed at intake

1. **Solo challenges exist.** A challenge may be created for one person ("Just me"). It behaves like today's one-member challenge: same lock-in and check-in, same inactivity rule (warn at 3 missed days, close at 4), same email reminders. It never says "waiting for a partner".
2. **A solo challenge may invite a partner later**, through the existing invite flow. Once someone joins, it is an ordinary two-person challenge.
3. **The countdown is live, to the next daily deadline** (option 3): hours, minutes and seconds to the lock-in deadline while the plan is not locked, then to the check-in deadline while the check-in is not made, judged on the viewer's own clock. Plus a **days-left headline** on every challenge ("70 days left", "Last day").
4. A standalone countdown to an arbitrary date (option 2) is out of scope for this run.
5. Deploy order is backend first (`npx convex deploy` from a real terminal with `npx.cmd`, since PowerShell's script policy blocks `npx.ps1`), then push `main`. The loop itself never deploys, pushes or commits; the user asks for those at the end.
