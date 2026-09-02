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

- The focus block length is set from under the deep work timer's preset chips
  ("Make 60m my block") rather than at the bottom of the tracking dashboard,
  which now shows a readout. The timer is also the first card in the sidebar.

### Fixed

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
