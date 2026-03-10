-- Migration: store all open dates for streak (active_days) so previous days are not lost.
-- Streak is computed from active_days; streak/last_open_date kept for one-time migration when reading.

alter table public.user_settings
  add column if not exists active_days jsonb not null default '[]'::jsonb;
