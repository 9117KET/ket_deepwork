# Contributing to KET Deepwork Planner

Thanks for considering contributing. Here’s how to get started.

## Before you start

- Open an **issue** to discuss bugs or features so we don’t duplicate work.
- For bugs: describe what you did, what you expected, and what happened (and your OS/browser if relevant).
- For features: describe the use case and how you’d expect it to work.

## Setup

```bash
git clone https://github.com/9117KET/ket_deepwork.git
cd ket_deepwork
npm install
npm run dev
```

Run the linter: `npm run lint`. Run the build: `npm run build`.

## Submitting changes

1. **Fork** the repo and create a branch from `main` (e.g. `fix/typo-readme` or `feat/export-tasks`).
2. **Make your changes.** Keep commits focused and messages clear (e.g. “Fix due-now highlight when duration is missing”).
3. **Ensure** `npm run lint` and `npm run build` pass.
4. **Push** your branch and open a **Pull Request** against `main`. Describe what you changed and why; link any related issue.
5. Maintainers will review and may ask for small edits.

## Code style

- TypeScript: strict types, no `any` unless justified.
- Prefer small components and clear names. Add a short file-top comment for non-obvious modules.
- Follow existing patterns (e.g. domain logic in `src/domain/`, persistence in `src/storage/`).

## Questions

Open a **Discussion** or an **Issue** with the question label. Be respectful; we follow the [Code of Conduct](CODE_OF_CONDUCT.md).
