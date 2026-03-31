# New Supabase Migration

Create a new Supabase SQL migration file following the project conventions.

## Steps

1. Determine today's date in `YYYYMMDD` format for the filename prefix.
2. Ask the user for a short snake_case description of the migration (e.g. `add_calendar_reminders`).
3. Create the file at: `supabase/migrations/YYYYMMDD_<description>.sql`

## Migration template to follow

```sql
-- Migration: <description>
-- Created: <date>

-- ── Table alterations / creations ─────────────────────────────────────────────

-- Example: alter table
-- ALTER TABLE planner_days ADD COLUMN IF NOT EXISTS example_field text;

-- Example: new table with RLS
-- CREATE TABLE IF NOT EXISTS example_table (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );
-- ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users manage own rows" ON example_table
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- CREATE UNIQUE INDEX IF NOT EXISTS example_table_user_id_key ON example_table(user_id);
```

## Project conventions to follow

- Always use `IF NOT EXISTS` / `IF EXISTS` guards so migrations are idempotent.
- New user-scoped tables must enable RLS and include a policy scoped to `auth.uid() = user_id`.
- New JSONB columns that mirror TypeScript types should use `DEFAULT '{}'::jsonb` or `DEFAULT '[]'::jsonb`.
- The `planner_days` table is keyed by `(user_id, date text)` — date is stored as `YYYY-MM-DD` text, not a date type.
- Shared-planner access uses two RPC functions (`get_shared_planner`, `upsert_shared_day`) — extend those if adding columns to `planner_days` that should be visible to visitors.
- Edge Functions use a service role client and bypass RLS — do NOT add RLS to `google_calendar_connections` or `calendar_event_links`.

After creating the file, remind the user to apply it with:
```
supabase db push
# or for local dev:
supabase migration up
```
