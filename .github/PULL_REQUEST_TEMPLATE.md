## What changed

<!-- Brief description of what this PR does -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Migration (Supabase schema change)

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Tested in guest mode (localStorage only)
- [ ] Tested signed in (Supabase sync)
- [ ] If adding a new `sectionId`: updated `types.ts`, `stats.ts` weights, and migration if stored in DB
- [ ] If changing `planner_days` columns: updated `supabasePlanner.ts` fetch/upsert and the `get_shared_planner` / `upsert_shared_day` RPCs
- [ ] If adding an Edge Function: documented secrets needed in `deploy-functions` skill

## Screenshots (if UI change)

<!-- Paste before/after screenshots -->
