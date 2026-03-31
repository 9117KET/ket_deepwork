# Debug Supabase Sync

Diagnose and fix issues with planner data not syncing between localStorage and Supabase.

## Diagnostic checklist

### 1. Check environment
```bash
# Verify env vars are set
cat .env | grep VITE_SUPABASE
```

### 2. Check Supabase connection
In browser DevTools → Network tab, filter by `supabase`. Look for:
- 401 → invalid anon key
- 403 → RLS policy blocking the user
- 404 → wrong project URL or table name
- 500 → database error (check Supabase dashboard logs)

### 3. Check localStorage state
In browser DevTools → Application → Local Storage:
```js
// Run in console:
JSON.parse(localStorage.getItem('deepblock_state_v1'))
```
If this is null but old data exists under `ket_deepwork_state_v1`, the legacy migration in `localStorageState.ts` should handle it on next load.

### 4. Sync flow in `src/storage/localStorageState.ts`
- **Initial load** (line ~273): `Promise.all([fetchPlannerState, fetchUserSettings])` — runs when user signs in
- **Write debounce** (800ms): triggered by `updateState()` calls
- **Flush on unload**: `beforeunload` + `visibilitychange` events
- **Refetch on focus**: `visibilitychange` → re-fetches Supabase on tab activation

If data is lost on reload: the debounced write likely didn't flush. Check if `beforeunload` fired.
If data is stale: the merge logic prefers Supabase over local for existing dates. Local-only dates are preserved.

### 5. Supabase table structure
```sql
-- planner_days: one row per (user_id, date)
SELECT * FROM planner_days WHERE user_id = auth.uid() ORDER BY date DESC LIMIT 10;

-- user_settings: one row per user
SELECT * FROM user_settings WHERE user_id = auth.uid();
```

### 6. RLS policies
```sql
-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename IN ('planner_days', 'user_settings', 'share_tokens');
```

### 7. Share token issues
- Token validation: `validateShareToken()` in `src/storage/supabaseSharing.ts`
- RPC `get_shared_planner` runs as `SECURITY DEFINER` — bypasses RLS to read owner's days
- RPC `upsert_shared_day` validates `permission = 'edit'` before writing

## Common fixes
- **Data not saving**: user not signed in (guest mode uses localStorage only)
- **Wrong data after sign-in**: stale local cache; clear localStorage key and reload
- **Share link shows empty planner**: token invalid/expired or RPC function not deployed
- **Habits not syncing**: stored in `user_settings.habit_definitions` jsonb, separate from `planner_days`
