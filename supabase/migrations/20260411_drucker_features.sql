-- Migration: Drucker "Effective Executive" features
-- Adds global not-doing list, per-day not-doing items, and abandoned tasks.

alter table public.user_settings
  add column if not exists not_doing_list jsonb default '[]'::jsonb;

comment on column public.user_settings.not_doing_list is
  'Global persistent not-doing commitments (Drucker). Array of { id, text, createdAt }.';

alter table public.planner_days
  add column if not exists not_doing_items jsonb default '[]'::jsonb;

comment on column public.planner_days.not_doing_items is
  'Per-day not-doing decisions. Array of { id, text, createdAt }.';

alter table public.planner_days
  add column if not exists abandoned_tasks jsonb default '[]'::jsonb;

comment on column public.planner_days.abandoned_tasks is
  'Tasks consciously abandoned this day (Drucker). Array of { id, title, sectionId, abandonedAt }.';
