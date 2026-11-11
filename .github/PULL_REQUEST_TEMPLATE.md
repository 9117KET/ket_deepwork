## What changed

<!-- Brief description of what this PR does -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Convex schema or function arguments change (two-sided deploy)

## Checklist

- [ ] CI is green (lint, unit, Convex, build, end-to-end)
- [ ] Tested in guest mode (localStorage only)
- [ ] Tested signed in (Convex sync)
- [ ] A changed sync payload, function argument or return shape: backend deployed first with `npx convex deploy`, then this PR merged (`docs/DEPLOYMENT.md`)
- [ ] Touches a delete path, the timer or `deepWorkSessions`: read `docs/data-safety.md` and kept worked minutes safe
- [ ] `CLAUDE.md` updated if a rule or pattern changed

## Screenshots (if UI change)

<!-- Paste before/after screenshots, phone and desktop -->
