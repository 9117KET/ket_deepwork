-- Migration: streak and last_open_date on user_settings.
-- Purpose: Track consecutive days the app is opened for streak display.

alter table public.user_settings
  add column if not exists streak integer not null default 0;
alter table public.user_settings
  add column if not exists last_open_date text;
