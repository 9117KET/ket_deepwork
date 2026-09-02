# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Focus blocks survive the tab: a running block is stored against the wall clock
  and resumes on reload. One that ran out while the app was closed comes back as
  a claim you confirm or discard, so starting a block before you leave is now a
  real way to record work done away from the screen.
- Hand-logging takes a whole stretch at once — a block stepper or a "from → to"
  clock range — instead of one block per trip through the sheet.
- Completing a task with an unlogged remainder offers to log it by hand. Offered,
  never automatic; it fills faded like anything else self-reported.
- The weekly deep work card shows hand-logged hours beside the earned figure,
  marked as not counted, instead of hiding them entirely.

### Changed

- Live sync no longer subscribes to the whole planner history. It reads a hot
  window (last 14 days) and a cold archive separately, so editing today costs a
  fortnight of reads instead of a lifetime and stops growing with the history —
  the read amplification behind the June 2026 quota blowout. Uploads are capped
  at 25 days per call and drain in paced batches.
- The focus block length is set from under the deep work timer's preset chips
  ("Make 60m my block") rather than at the bottom of the tracking dashboard,
  which now shows a readout. The timer is also the first card in the sidebar.

### Fixed

- **Cross-device sync had been dead since 2026-06-15.** A client change added an
  `updatedAt` field to the day payload, but the Convex backend was never
  deployed, so every write was rejected with an ArgumentValidationError and no
  device had received an update in ~2.5 months. Backend deployed; the queued
  days upload on next load. Nothing was lost — the error path never cleared the
  pending flags.
- Settings sync was broken the same way (`focusBlockMinutes` /
  `focusBreakMinutes` missing from the deployed validator).
- Days stranded on a single device — present locally, never uploaded, invisible
  everywhere else — are now detected on hydration and queued. Four such days
  were recovered on the development account.
- `convex deploy` had been failing its typecheck gate on a Vitest-only file
  (`convex/calendar.test.ts` uses `import.meta.glob`), which is what allowed the
  backend to fall behind in the first place. Test files are excluded from the
  Convex tsconfig.
- A running block was lost entirely on reload, tab eviction, or the phone
  locking the browser out — the minutes worked disappeared with no trace.
- "Skip for today" on the day-setup modal did not survive a reload, so the modal
  blocked the planner on every refresh until a wake time was filled in.

## [1.0.0] - 2026-02-27

### Added

- Daily planner with sections: 3 must-dos, morning routine, high/medium/low priority, night routine.
- Fill day from yesterday or from last same weekday (e.g. last Thursday).
- Task start time (24h) and optional duration; due-now highlight and three beeps (start, mid, end).
- Drag-to-reorder tasks within sections.
- Weekly overview and deep work timer in sticky sidebar; motivation card with rotating quotes.
- Interactive onboarding tour and Help modal.
- LocalStorage persistence; no backend.

### Tech

- React 19, TypeScript, Vite 7, Tailwind CSS.
