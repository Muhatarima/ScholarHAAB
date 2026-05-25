## ScholarHAAB admin dashboard SQL

Run this in the Supabase SQL Editor before using `/admin`.

```sql
create table if not exists public.query_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  user_email text,
  message text,
  query_type text,
  subject text,
  tokens_used int default 0,
  from_cache boolean default false,
  cost_usd float default 0,
  response_ms int,
  created_at timestamp default now()
);

create table if not exists public.daily_stats (
  date date primary key,
  total_queries int default 0,
  total_users int default 0,
  total_tokens int default 0,
  total_cost_usd float default 0,
  cache_hits int default 0
);

alter table public.profiles
  add column if not exists is_admin boolean default false;

update public.profiles
  set is_admin = true
  where email = 'your@email.com';

alter table public.query_logs enable row level security;

drop policy if exists "admin only" on public.query_logs;
create policy "admin only" on public.query_logs
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
```

Notes:
- Replace `your@email.com` with the real admin email you use in ScholarHAAB.
- `daily_stats` is reserved for future aggregation jobs. The dashboard currently reads directly from `query_logs` so the numbers stay live.
