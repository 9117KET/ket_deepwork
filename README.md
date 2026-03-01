# Deepblock

A daily deep-work planner with time-blocked tasks, weekly overview, and focus timer. Built for job applications, language practice, and focused work.

## Features

- **Daily sections**: 3 must-dos, Morning routine, High / Medium / Low priority, Night routine (vertical flow, Notion-style).
- **Fill your day in one click**: Copy from yesterday or fill from last same weekday (e.g. last Thursday). Click once to avoid duplicates.
- **Task time and duration**: Set start time (24h) and optional duration. Tasks highlight when due and stay highlighted until done or time elapses.
- **Three gentle beeps** per task: at start, middle, and end of the allocated time.
- **Drag to reorder** tasks within each section (grip handle).
- **Weekly overview** and **deep work timer** in a sticky sidebar; **motivation card** with rotating quotes.
- **Interactive onboarding tour** and **Help** modal. Data stored in browser (localStorage).

## Tech stack

- React 19, TypeScript, Vite 7, Tailwind CSS.

## Quick start

```
git clone https://github.com/9117KET/deepblock.git
cd deepblock
npm install
npm run dev
```

Open http://localhost:5173. Build: `npm run build`. Preview: `npm run preview`.

## Project structure

- `src/components/` - planner UI, timer, onboarding, help
- `src/domain/` - types, date utils, stats
- `src/storage/` - localStorage persistence
- `src/utils/` - tour completion

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE).
