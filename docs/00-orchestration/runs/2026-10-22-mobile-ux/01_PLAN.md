# Plan: mobile UX overhaul

*Run:* `docs/00-orchestration/runs/2026-10-22-mobile-ux/` · *Supervisor:* Fable · *Started:* 2026-10-22

## Intake decision
The brief is broad ("terrible in every regard"), so facts come first: three scouts measure the
app as it is on phone viewports, read the artboards against the current code, and map the
mobile code layer. Workstreams are cut from their findings.

## Scouts (Mode A)
| Scout | Brief | Output |
|---|---|---|
| mobile-audit | Run the app at 360x740 and 390x844 with touch emulation on a seeded guest day; screenshot every screen and sheet; measure scroll height, sub-44px controls, tiny text, overflow, hover-only controls | `scout-mobile-audit.md` |
| design-gap | Artboards (`docs/design/mobile/*.dc.html`, previews) vs the current screens; which rules still apply after the minimal rewrite | `scout-design-gap.md` |
| code-survey | Every breakpoint/pointer branch, hover-only affordance, drag-only interaction, fixed chrome, tiny text, and the existing e2e mobile gates | `scout-code-survey.md` |

## Workstreams (cut from the scout reports, 2026-10-22)
| # | Spec | Worktree | Depends on |
|---|---|---|---|
| 01 | `spec-01-foundations.md`: tokens (`hairline`, `onSurfaceDim`, `barBg`), `.overline/.page-title/.stat-number/.toast-dock`, 16px inputs on coarse pointers, reduced motion, `useCoarsePointer`, tab bar restyle + insets + on every route, slim chrome header, LoginForm sizes, toasts, `e2e/helpers/mobile.ts` + gates | yes | scouts |
| 02 | `spec-02-today.md`: phone row anatomy (checkbox / title / one chip / ⋮), `TaskActionSheet` bottom sheet for every row incl. Top 3, segmented progress bar as one button, no arrows/grip/select/drag/right-click/double-tap on phones, sheets and toasts above the bar, ChallengeCard shape, `e2e/mobile-today.spec.ts` | yes | 01 merged |
| 03 | `spec-03-panels-pages.md`: Focus idle as a phone screen (48px Start), running state centred + tokens, timer one-accent clean-up, Habits whole-row toggles, HabitEditorModal as a sheet, Review and Challenge type roles + 44px + 16px inputs, `e2e/mobile-panels.spec.ts` | yes | 01 merged |

**Sequencing decision:** 01 runs alone first. 02 and 03 use the token and utility names 01 defines; Tailwind silently ignores unknown class names, so running them in parallel with 01 would ship invisible styling. 02 and 03 run in parallel from an integration branch that contains 01. Gates are folded into each spec (separate spec files, so no merge conflicts); the supervisor runs the full suite after merging.

**Integration branch:** `mobile-ux` (local). Builders commit on their worktree branches; the supervisor merges approved branches into `mobile-ux`. Nothing is pushed or merged to `main` inside the loop.

## Explicitly out
- Desktop layout changes beyond what a shared component forces.
- New features. This run changes how existing features behave on a phone.
- Native apps, PWA install flow, push notifications.

## Agents dispatched
| Role | Spec / brief | Agent | Status |
|---|---|---|---|
| scout | mobile-audit | scout-mobile-audit | done, filed |
| scout | design-gap | scout-design-gap | done, filed |
| scout | code-survey | scout-code-survey | done, filed |
| builder | spec-01-foundations | builder-01 (branch `worktree-agent-aa6ce584da611723f`, d30c73c) | round 1 APPROVED; merged into `mobile-ux` as 3292f00 |
| scout | check-01 (Mode B) | check-01 | dispatched after approval; findings go to a fix round if any |
| builder | spec-02-today | builder-02 (branch `worktree-agent-a99d740f54a18a71d`, a871408 + 4c6084a) | round 2 APPROVED; merged 534734a; check-02 clean |
| builder | spec-03-panels-pages | builder-03 (branch `worktree-agent-a7e32674809c5f892`, b5ca3d4 + d2b4f53 + f072f50 + f24e190) | round 4 APPROVED; merged 6e86e43, 9374404, 7dbf382; check-03 clean |
| scout | check-02, check-03 (Mode B) | check-02, check-03 | done, filed |

**Closed 2026-10-22.** Final head `mobile-ux` 7dbf382: lint, tsc, build, 287 unit, 96 convex, 128 e2e all green. See `99_SUMMARY.md`.
