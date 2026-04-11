-- Migration: tracking fields on planner_days + user_settings for habits and month titles.
-- Purpose: Persist habit completions, sleep, mood per day; habit definitions and chapter titles per user.

-- Extend planner_days with tracking columns (nullable so existing rows stay valid).
alter table public.planner_days
  add column if not exists habit_completions jsonb not null default '{}'::jsonb;
alter table public.planner_days
  add column if not exists sleep_hours numeric;
alter table public.planner_days
  add column if not exists mo
-- User-level settings: habit list and month chapter titles (one row per user).
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  habit_definitions jsonb not null default '[]'::jsonb,
  month_titles jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'Users can manage their own user_settings'
  ) then
    execute $policy$
      create policy "Users can manage their own user_settings"
        on public.user_settings
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;
