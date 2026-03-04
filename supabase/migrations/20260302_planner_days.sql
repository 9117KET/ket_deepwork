-- Migration: planner_days table for Deepblock
-- Purpose: Persist per-user planner days (tasks + deep work sessions) in Supabase.

create table if not exists public.planner_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  tasks jsonb not null default '[]'::jsonb,
  deep_work_sessions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Ensure one row per user per date for safe upserts.
create unique index if not exists planner_days_user_date_idx
  on public.planner_days (user_id, date);

alter table public.planner_days enable row level security;

-- RLS: users can manage only their own rows.
create policy if not exists "Users can manage their own planner_days"
  on public.planner_days
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

