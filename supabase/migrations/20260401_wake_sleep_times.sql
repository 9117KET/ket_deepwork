-- Migration: add wake_time and sleep_target_time to planner_days
-- Purpose: Support per-day dynamic time blocks based on the user's actual wake/sleep schedule.

alter table public.planner_days
  add column if not exists wake_time text;

alter table public.planner_days
  add column if not exists sleep_target_time text;

comment on column public.planner_days.wake_time is
  'Local time user woke up (HH:MM 24h), e.g. 06:30. NULL if not set for this day.';

comment on column public.planner_days.sleep_target_time is
  'Local time user plans to sleep (HH:MM 24h), e.g. 23:00. NULL if not set for this day.';
