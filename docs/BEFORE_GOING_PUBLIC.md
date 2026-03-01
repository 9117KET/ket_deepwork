# Before going public – checklist

Use this list before you make the repo public or announce it.

## Must-do

- [ ] **License** – `LICENSE` file is in the repo (MIT added).
- [ ] **README** – Describes the project, how to run it, and links to CONTRIBUTING and CoC.
- [ ] **No secrets** – No API keys, passwords, or `.env` with real values in the repo. `.gitignore` includes `.env` and `.env.*.local`.
- [ ] **Build passes** – Run `npm run build` and `npm run lint` locally; fix any errors.
- [ ] **Copyright in LICENSE** – Replace "KET (ket_deepwork contributors)" in `LICENSE` with your name or preferred attribution.

## Recommended

- [ ] **Demo link** – Add a live demo URL (e.g. Vercel) to the README.
- [ ] **Screenshot** – Add a screenshot or short GIF to the README so people see the UI.
- [ ] **GitHub repo settings** – Add description and topics (e.g. `react`, `productivity`, `planner`, `deep-work`, `vite`).
- [ ] **First release** – Create a GitHub release (e.g. v1.0.0) with a short note and tag.

## Optional

- [ ] **Issue templates** – Already added under `.github/ISSUE_TEMPLATE/`.
- [ ] **CI** – `.github/workflows/ci.yml` runs on push/PR; ensure it passes after going public.
- [ ] **Sponsor link** – Add GitHub Sponsors or “Buy me a coffee” to the README if you want donations.

## After going public

- Watch the first issues/PRs and respond in a friendly way.
- Keep `CHANGELOG.md` updated when you ship notable changes.
