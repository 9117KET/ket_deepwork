-- Migration: add bed_time to planner_days
-- Purpose: Persist the "went to bed last night" time so it survives cross-device syncs and refreshes.

alter table public.planner_days
  add column if not exists bed_time text;

comment on column public.planner_days.bed_time is
  'Local time user went to bed the previous night (HH:MM 24h), e.g. 23:00. NULL if not set.';
