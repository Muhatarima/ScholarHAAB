create extension if not exists pgcrypto;

create table if not exists public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_log_endpoint_created
  on public.rate_limit_log (endpoint, created_at desc);

create index if not exists idx_rate_limit_log_user_endpoint_created
  on public.rate_limit_log (user_id, endpoint, created_at desc);

create or replace function public.cleanup_rate_limit_log(p_keep_hours integer default 24)
returns bigint
language plpgsql
as $$
declare
  deleted_count bigint;
begin
  with deleted_rows as (
    delete from public.rate_limit_log
    where created_at < now() - make_interval(hours => greatest(p_keep_hours, 1))
    returning 1
  )
  select count(*) into deleted_count from deleted_rows;

  return deleted_count;
end;
$$;
