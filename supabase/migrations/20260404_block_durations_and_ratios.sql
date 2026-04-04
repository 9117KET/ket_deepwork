-- Per-day block duration overrides (minutes per section) + global default ratios for "all days".

alter table public.planner_days
  add column if not exists block_durations jsonb;

comment on column public.planner_days.block_durations is
  'Optional JSON object: morningRoutine, highPriority, mediumPriority, lowPriority, nightRoutine (minutes).';

alter table public.user_settings
  add column if not exists block_duration_ratios jsonb;

comment on column public.user_settings.block_duration_ratios is
  'Optional JSON: fractional split of awake time across blocks (sums to 1). Used when per-day block_durations is null.';
