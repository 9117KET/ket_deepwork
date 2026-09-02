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

These are **static mockups**, not a prototype: no working controls, no state.
Nothing in `src/` has been changed to match them.
