-- Migration: Google Calendar two-way sync tables.
-- Stores an encrypted refresh token server-side and a mapping between planner tasks and Google events.

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_refresh_token text not null,
  selected_calendar_id text,
  selected_calendar_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_event_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  task_date text not null,
  google_calendar_id text not null,
  google_event_id text not null,
  etag text,
  updated_at timestamptz not null default now(),
  primary key (user_id, google_calendar_id, google_event_id),
  unique (user_id, task_date, task_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;

-- Do not allow direct client access. Edge Functions use service role.
-- (No policies defined intentionally.)

