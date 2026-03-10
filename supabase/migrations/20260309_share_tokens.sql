-- Migration: share_tokens table and RPC functions for planner sharing.
-- Allows owners to generate view/edit links for their planner space.

create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique default gen_random_uuid()::text,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists share_tokens_token_idx on public.share_tokens (token);

alter table public.share_tokens enable row level security;

-- Owners can fully manage their own tokens.
create policy "Users can manage their own share_tokens"
  on public.share_tokens
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Anyone (including anon) can read a token by token value to validate it when opening a share link.
create policy "Anyone can read share_tokens by token"
  on public.share_tokens
  for select
  using (true);

-- RPC: fetch all planner days for a given share token.
-- Runs as the function owner (security definer) so anon users can read owner's planner_days.
create or replace function public.get_shared_planner(p_token text)
returns table (
  date text,
  tasks jsonb,
  deep_work_sessions jsonb,
  habit_completions jsonb,
  sleep_hours numeric,
  mood text
)
language sql
security definer
set search_path = public
as $$
  select
    pd.date,
    pd.tasks,
    pd.deep_work_sessions,
    pd.habit_completions,
    pd.sleep_hours,
    pd.mood
  from planner_days pd
  join share_tokens st on st.owner_user_id = pd.user_id
  where st.token = p_token;
$$;

-- RPC: upsert a planner day via a share token that has 'edit' permission.
-- Validates permission before writing; raises an error if token is invalid or view-only.
create or replace function public.upsert_shared_day(
  p_token text,
  p_date text,
  p_tasks jsonb,
  p_deep_work_sessions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_user_id into v_owner_id
  from share_tokens
  where token = p_token and permission = 'edit';

  if v_owner_id is null then
    raise exception 'Invalid share token or insufficient permission';
  end if;

  insert into planner_days (user_id, date, tasks, deep_work_sessions)
  values (v_owner_id, p_date, p_tasks, p_deep_work_sessions)
  on conflict (user_id, date) do update set
    tasks = excluded.tasks,
    deep_work_sessions = excluded.deep_work_sessions,
    updated_at = now();
end;
$$;
