# Deepblock redesign — source of truth

Design source for the mobile and desktop redesign. These are the files the
implementation should be built against; the published canvases are rendered
from exactly these.

| Canvas | Link |
|--------|------|
| Mobile | https://claude.ai/code/artifact/edc2840b-89be-4097-ab70-73e535b91b0c |
| Desktop | https://claude.ai/code/artifact/beafdda0-915e-483a-b56f-9397582b6dc5 |

```
docs/design/
  mobile/     8 artboards + canvas.json   — 390x844, plus the diagnosis and IA boards
  desktop/    3 artboards + canvas.json   — 1440x900
  previews/   PNG of every artboard       — regenerate, do not hand-edit
```

Each `.dc.html` is one artboard. `Main.dc.html` is the entry artboard of its
canvas (mobile: the Today screen; desktop: the Today screen). `canvas.json`
holds positions, pages and the sticky notes.

## What problem this solves

Measured on the running app with Playwright at 390x844, touch emulation, guest
planner, **two tasks seeded**:

| Mobile tab | Scroll height | Controls | Monthly tracking | Top 3 | Desktop tip | Journal |
|---|---|---|---|---|---|---|
| Plan | 3273px (3.9 screens) | 126 | yes | yes | yes | yes |
| Timer | 2615px (3.1) | 134 | yes | yes | yes | yes |
| Habits | 2709px (3.2) | 139 | yes | yes | yes | yes |
| Stats | 2580px (3.1) | 130 | yes | yes | yes | yes |

With seven tasks the Plan tab reached 3,525px.

**The tab bar does not partition anything.** ~2,500px is identical on all four
tabs; only ~700px swaps. `MobileTabBar` hides the task sections
(`DayPlanner.tsx`, `mobileTab !== 'plan' ? 'hidden lg:block'`) and nothing else,
so `MonthlyTrackingDashboard`, `DayJournalCard`, `MustDoPinnedHeader` and the
bulk-select tip render on every tab.

## The rules the redesign is built on

1. **A screen renders only what its own destination owns.** Today stops
   painting the month grid; Focus stops painting the task list. This one change
   removes ~2,500px from every mobile tab and is the whole point.
2. **Month-scale views live in Review, on both breakpoints.** This is the only
   structural rule shared across sizes.
3. **Sections earn their space.** The current block is expanded; the other five
   collapse to one line each.
4. **One accent.** `#00daf3` means "act now" and nothing else uses it. Amber
   (`#ffb77d`) is reserved for warnings (missed habit, overrun). The violet /
   sky / emerald / red accents currently in use go away.
5. **Desktop is not mobile stretched.** Width is real space, so the four phone
   destinations become two views plus a rail — Focus and Habits sit *beside* the
   day rather than instead of it.

## Screens

### Mobile (390x844) — each artboard fits the frame exactly, so it fits the phone with no scrolling

| Artboard | Screen | Replaces |
|---|---|---|
| `Main` | Today — NOW card, THEN (next two), REST OF DAY (one line per section) | the Plan tab |
| `Focus` | the countdown alone | the Timer tab |
| `Habits` | identity, today's checks, 7-day dots | the Habits tab |
| `Review` | week scoreboard, journal, reviews, goals, month grid behind a tap | the Stats tab |
| `TimelineDay` | **alternate** — the day as a time rail | — |
| `OneThing` | **alternate** — one task fills the screen | — |
| `Diagnosis`, `IA` | the measurements and the feature-to-destination map | — |

### Desktop (1440x900)

| Artboard | Screen |
|---|---|
| `Main` | Today — sidebar, NOW card over the day, rail with Focus / Habits / One Thing |
| `DesktopReview` | Review — stat cards, the 31-column month grid at full width, review + goal entries |
| `DesktopFocus` | Focus mode — starting a block hides the sidebar and the day entirely |

The empty lower-left of desktop Today is a fixture artifact: that day has two
tasks. A real day fills the open section.

## Where every existing feature lands

Nothing is removed except one thing. Full map on the `IA` artboard; in short:

- **Today** — date nav, streak, progress, Top 3 (folded into NOW/THEN, not a
  separate panel), all six task sections, focus-block progress boxes, duration
  pickers, time anchors, sleep window, shutdown ritual, plan-tomorrow, side
  quests (only once unlocked).
- **Focus** — deep work timer, block length, task attribution, away-block claim,
  manual logging.
- **Habits** — identity statement, checklist, per-habit streaks,
  never-miss-twice warning.
- **Review** — weekly deep work scoreboard and goal, both month grids, day
  journal, weekly and monthly review, goal cascade, North Star, One Thing,
  depth philosophy.
- **Removed** — the "Ctrl/Cmd-click tasks to select several" tip. It describes a
  gesture phones do not have.

## Design tokens

Lifted from `tailwind.config.js` (`theme.extend.colors.share`) — the designs use
the app's existing palette, not a new one.

| Token | Value | Use |
|---|---|---|
| `share.bg` | `#111316` | page ground |
| `share.surfaceContainerLow` | `#1a1c1f` | cards |
| `share.surfaceContainer` | `#1e2023` | inputs, raised chrome |
| `share.outlineVariant` | `#3d494d` | borders |
| `share.primary` | `#00daf3` | the single accent — "act now" |
| `share.onPrimary` | `#00363d` | text on primary |
| `share.onBg` | `#e2e2e6` | body text |
| `share.onSurfaceVariant` | `#bcc9ce` | secondary text |
| `share.tertiary` | `#ffb77d` | warnings only |

Two values in the artboards are not yet tokens and should become them:
`#23262a` (hairline / track fill, between `surfaceContainer` and
`outlineVariant`) and `#7d8a8f` (tertiary text, dimmer than
`onSurfaceVariant`).

Type: **Epilogue** 700/800/900 for headings (`font-shareHeadline`), **Manrope**
400–800 for body (`font-shareSans`). Both already load in `index.html`.

Icons in the artboards are inline stroke SVG on a 24px grid. The app uses
Material Symbols — keep Material Symbols when implementing; the SVGs are
stand-ins for shape and weight only.

## Regenerating a canvas

Requires the `design` skill's `seed-canvas.mjs` and `payload.template.html`.
From `docs/design/mobile` or `docs/design/desktop`:

```bash
node <skill>/seed-canvas.mjs \
  --template <skill>/payload.template.html \
  --out <somewhere outside the repo>/deepblock-mobile-redesign.html \
  --title "Deepblock Mobile Redesign" \
  --artboard Main.dc.html --artboard Focus.dc.html ... \
  --canvas canvas.json
```

Then publish that file with the Artifact tool, passing the canvas URL above so
it updates in place rather than creating a second one. The seeded output is
~2 MB of editor payload — keep it out of the repo.

## Status

The artboards are **static mockups** — no working controls, no state. They stay
the reference; the list below is how much of them the app has actually grown.

| Rule | State | Where |
|---|---|---|
| 1. A screen renders only what it owns | **done** | the dashboard and journal left `DayPlanner` |
| 2. Month-scale views live in Review | **done** | `src/pages/ReviewPage.tsx` at `/planner/review` |
| 3. Sections earn their space | **done** | `SectionColumn` defaults to collapsed unless its block is running |
| 4. One accent | **done** | see the note below |
| 5. Desktop is not mobile stretched | **done** | rail leads with Focus / Habits / One Thing; Focus mode covers the day |

| Artboard | State | Where |
|---|---|---|
| desktop `Main` | **done** | `NowCard.tsx` + `nowFocus.ts`, collapsed sections, reordered rail |
| desktop `DesktopReview` | **done** | `ReviewPage` layout, `ReviewStatTiles.tsx`, `ReviewRail.tsx`, `reviewStats.ts` |
| desktop `DesktopFocus` | **done** | `src/components/timer/FocusMode.tsx` |
| mobile `Main` | **done** | the same NOW card; the Today tab is the day alone |
| mobile `Focus` | **done** | `src/components/timer/MobileFocusPanel.tsx` |
| mobile `Habits` | **done** | `src/components/habits/MobileHabitsPanel.tsx` + `habitWeek.ts` |
| mobile `Review` | **done** | `src/components/tracking/MobileReviewPanel.tsx` |
| `Diagnosis`, `IA` | reference boards, nothing to build | — |
| `TimelineDay`, `OneThing` | alternates, not chosen | — |

**Gated by `e2e/mobile-redesign.spec.ts`.** Two of its ten tests are the
diagnosis kept as a regression gate: no tab may render the monthly dashboard,
and the Today tab must stay under 2,200px. They fail first if a month-scale
card is put back onto the day. Measured now, with four tasks seeded: the Today
tab scrolls well under that, against 3,273px with two tasks before.

**The tab bar changed shape.** `MobileTab` is `today | focus | habits`; Stats
is gone and Review is a route, so the bar links to `/planner/review` rather
than toggling a panel. Review carries the same bar, and hands the chosen tab
back through `?tab=`.

**The phone does not mount what it does not show.** `useIsDesktop` gates the
month-scale content on Review, so a phone builds neither 31-column grid until
"Open the month grid" is tapped. `lg:hidden` would have hidden it while still
building every node.

**On rule 4.** The sky, violet and orange accents are gone from the Review
screen and the day: the running block, the grids, the goal cascade, the review
cards and the review reminders all wear `share.primary`. Amber and red survive
only where they mean act-now (over capacity, critical overload, discarding
worked minutes). One deliberate exception: emerald still marks *completed* —
shutdown done, a review written. "Finished" and "urgent" sharing one colour
would be worse than the rule it satisfies, and no artboard shows a done badge.

**Deviation from `DesktopReview`.** The artboard puts the block-completion grid
alone in the left column with everything else behind rail links. The build
keeps the full dashboard scrolling under the stat tiles and makes the rail a
table of contents into it, so nothing that used to be reachable stopped being
reachable. Same shape at the top, more under it.

Measured after the above, at 390x844 with eight tasks seeded: the Plan tab
scrolls 1,786px, against 3,273px with two tasks before.
