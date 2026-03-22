create table if not exists public.daily_usage (
  id bigserial primary key,
  viewer_key text not null,
  usage_date date not null default current_date,
  tier text not null default 'trial',
  credits_used integer not null default 0,
  actions_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_key, usage_date)
);

create index if not exists daily_usage_viewer_key_idx on public.daily_usage (viewer_key);
create index if not exists daily_usage_usage_date_idx on public.daily_usage (usage_date);
